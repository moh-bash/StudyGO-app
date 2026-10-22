/**
 * Unit tests for the pure team-contact helpers.
 *
 * These assert the security-critical behaviour: only allowlisted `https`
 * destinations are ever produced, and no untrusted scheme can leak through.
 */
import { describe, expect, it } from 'vitest';
import {
  buildContactUrl,
  DEFAULT_CONTACT_MESSAGE,
  isOpenableUrl,
  normalizeGroupLink,
  normalizePhoneDigits,
  normalizeTelegram,
  withMessage,
} from './contact-action';

describe('normalizePhoneDigits', () => {
  it('accepts international numbers with + and 00 prefixes', () => {
    expect(normalizePhoneDigits('+966501234567')).toBe('966501234567');
    expect(normalizePhoneDigits('00966501234567')).toBe('966501234567');
  });

  it('strips separators', () => {
    expect(normalizePhoneDigits('966 50 123 4567')).toBe('966501234567');
    expect(normalizePhoneDigits('+966-50-123-4567')).toBe('966501234567');
  });

  it('rejects non-numeric and out-of-range values', () => {
    expect(normalizePhoneDigits('')).toBeNull();
    expect(normalizePhoneDigits('tel:+966501234567')).toBeNull();
    expect(normalizePhoneDigits('12345')).toBeNull();
    expect(normalizePhoneDigits('1'.repeat(16))).toBeNull();
  });
});

describe('normalizeTelegram', () => {
  it('lower-cases and strips leading @', () => {
    expect(normalizeTelegram('@StudyGroup')).toBe('studygroup');
    expect(normalizeTelegram('@@StudyGroup')).toBe('studygroup');
  });

  it('rejects invalid usernames and URLs', () => {
    expect(normalizeTelegram('abcd')).toBeNull();
    expect(normalizeTelegram('1group')).toBeNull();
    expect(normalizeTelegram('https://t.me/group')).toBeNull();
  });
});

describe('normalizeGroupLink', () => {
  it('accepts and canonicalizes allowlisted hosts', () => {
    expect(normalizeGroupLink('http://chat.whatsapp.com/ABC')).toBe(
      'https://chat.whatsapp.com/ABC',
    );
    expect(normalizeGroupLink('https://t.me/group')).toBe('https://t.me/group');
    expect(normalizeGroupLink('https://telegram.me/group')).toBe('https://telegram.me/group');
  });

  it('preserves the query string', () => {
    expect(normalizeGroupLink('https://t.me/joinchat/ABC?invite=xyz')).toBe(
      'https://t.me/joinchat/ABC?invite=xyz',
    );
  });

  it('rejects dangerous schemes', () => {
    expect(normalizeGroupLink('javascript:alert(1)')).toBeNull();
    expect(normalizeGroupLink('data:text/html,x')).toBeNull();
    expect(normalizeGroupLink('tg://resolve?domain=g')).toBeNull();
    expect(normalizeGroupLink('ftp://t.me/g')).toBeNull();
  });

  it('rejects hosts outside the allowlist, including look-alikes', () => {
    expect(normalizeGroupLink('https://evil.example.com/g')).toBeNull();
    expect(normalizeGroupLink('https://t.me.evil.com/g')).toBeNull();
    expect(normalizeGroupLink('https://wa.me/966501234567')).toBeNull();
  });

  it('rejects credentials and bare hosts', () => {
    expect(normalizeGroupLink('https://user:pass@t.me/g')).toBeNull();
    expect(normalizeGroupLink('https://t.me')).toBeNull();
    expect(normalizeGroupLink('https://t.me/')).toBeNull();
  });
});

describe('buildContactUrl', () => {
  it('builds a wa.me chat for a valid phone', () => {
    expect(buildContactUrl('WHATSAPP_PHONE', '+966501234567')).toEqual({
      url: 'https://wa.me/966501234567',
      label: 'واتساب',
    });
  });

  it('builds a t.me link for a valid username', () => {
    expect(buildContactUrl('TELEGRAM', '@StudyGroup')).toEqual({
      url: 'https://t.me/studygroup',
      label: 'تلغرام',
    });
  });

  it('builds an allowlisted group link', () => {
    expect(buildContactUrl('GROUP_LINK', 'https://chat.whatsapp.com/ABC')).toEqual({
      url: 'https://chat.whatsapp.com/ABC',
      label: 'رابط المجموعة',
    });
  });

  it('returns null for missing or invalid values', () => {
    expect(buildContactUrl(null, 'anything')).toBeNull();
    expect(buildContactUrl('TELEGRAM', null)).toBeNull();
    expect(buildContactUrl('GROUP_LINK', 'javascript:alert(1)')).toBeNull();
    expect(buildContactUrl('WHATSAPP_PHONE', 'not-a-number')).toBeNull();
  });
});

describe('withMessage', () => {
  it('appends the message to a WhatsApp chat', () => {
    const action = buildContactUrl('WHATSAPP_PHONE', '+966501234567')!;
    const url = withMessage(action, 'مرحبا');
    expect(url).toContain('https://wa.me/966501234567');
    expect(url).toContain(encodeURIComponent('مرحبا'));
  });

  it('appends the message to a Telegram chat', () => {
    const action = buildContactUrl('TELEGRAM', 'studygroup')!;
    expect(withMessage(action, 'مرحبا')).toContain('text=');
  });

  it('does not mutate a group link destination', () => {
    const action = buildContactUrl('GROUP_LINK', 'https://t.me/joinchat/ABC')!;
    // A group link is a share target, not a chat: appending text would silently
    // change the destination, so the helper refuses.
    expect(withMessage(action, 'مرحبا')).toBeNull();
  });

  it('returns the bare URL when the message is empty', () => {
    const action = buildContactUrl('TELEGRAM', 'studygroup')!;
    expect(withMessage(action, '   ')).toBe(action.url);
  });

  it('ships an Arabic default message', () => {
    expect(DEFAULT_CONTACT_MESSAGE.length).toBeGreaterThan(0);
    expect(DEFAULT_CONTACT_MESSAGE).toMatch(/[ء-ي]/);
  });
});

describe('isOpenableUrl', () => {
  it('accepts http(s) and rejects everything else', () => {
    expect(isOpenableUrl('https://t.me/g')).toBe(true);
    expect(isOpenableUrl('http://example.com')).toBe(true);
    expect(isOpenableUrl('javascript:alert(1)')).toBe(false);
    expect(isOpenableUrl('tg://resolve')).toBe(false);
    expect(isOpenableUrl('not a url')).toBe(false);
  });
});
