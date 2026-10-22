/**
 * Pure helpers for the Phase 5 team-contact actions.
 *
 * The server owns validation and normalization; this module only *derives* the
 * external destination the app opens, and the prefilled Arabic message. Keeping
 * it pure and free of React Native imports is what makes it unit-testable.
 *
 * Security posture (mirrors `study-go-api/src/teams/team-contact.util.ts`):
 * only `https://wa.me/<digits>`, `https://t.me/<username>` and allowlisted group
 * hosts are ever produced. Any other method/value combination yields `null`, so
 * a `javascript:` or arbitrary-scheme value — even if it somehow reached the
 * device — can never become an openable link.
 */
import type { SubjectTeamContactMethod } from '../api/subject-teams';

/** Hosts permitted for an opened group invitation link. */
const GROUP_LINK_HOSTS = new Set(['chat.whatsapp.com', 't.me', 'telegram.me']);

/** The default Arabic opener prefilled into a chat, inviting coordination. */
export const DEFAULT_CONTACT_MESSAGE =
  'السلام عليكم، أنا من فريق الدراسة في StudyGo وأرغب في التنسيق معكم بخصوص المهام.';

export interface ContactAction {
  /** Absolute `https://` URL to open externally. */
  url: string;
  /** Arabic label for the action button. */
  label: string;
}

/**
 * Builds the external destination for a contact method/value pair.
 *
 * Returns `null` for anything that is not a valid, allowlisted destination, so
 * callers can show a graceful "no contact available" state instead of opening
 * an untrusted URL.
 */
export function buildContactUrl(
  method: SubjectTeamContactMethod | null,
  value: string | null,
): ContactAction | null {
  if (method === null || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  switch (method) {
    case 'WHATSAPP_PHONE': {
      const digits = normalizePhoneDigits(trimmed);
      if (digits === null) {
        return null;
      }
      // `?text=` is not used here: `wa.me` opens a chat with that number, and
      // the message is appended by the caller at send time (see withMessage).
      return { url: `https://wa.me/${digits}`, label: 'واتساب' };
    }
    case 'TELEGRAM': {
      const username = normalizeTelegram(trimmed);
      if (username === null) {
        return null;
      }
      return { url: `https://t.me/${username}`, label: 'تلغرام' };
    }
    case 'GROUP_LINK': {
      const url = normalizeGroupLink(trimmed);
      if (url === null) {
        return null;
      }
      return { url, label: 'رابط المجموعة' };
    }
    default:
      return null;
  }
}

/** Same digit rules as the backend: 6–15 digits, `+`/`00` prefixes allowed. */
export function normalizePhoneDigits(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 40) {
    return null;
  }
  const withoutPlus = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const digits = withoutPlus.replace(/[\s()-]/g, '');
  if (!/^\d{6,15}$/.test(digits)) {
    return null;
  }
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  return /^\d{6,15}$/.test(normalized) ? normalized : null;
}

/** Telegram usernames are lower-cased; 5–32 chars, starting with a letter. */
export function normalizeTelegram(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, '').toLowerCase();
  return /^[a-z][a-z0-9_]{4,31}$/.test(trimmed) ? trimmed : null;
}

/**
 * Parses an allowlisted group-invitation URL and returns its canonical `https`
 * form. Rejects non-http(s) schemes, credentials, unknown hosts, and a bare host
 * with no path — the destination is otherwise preserved byte-for-byte.
 */
export function normalizeGroupLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 300) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!GROUP_LINK_HOSTS.has(host)) {
    return null;
  }
  if (parsed.pathname === '' || parsed.pathname === '/') {
    return null;
  }
  return `https://${host}${parsed.pathname}${parsed.search}`;
}

/**
 * Appends an optional prefilled message to a chat destination.
 *
 * Only `https://wa.me/<number>` and a *chat* `https://t.me/<username>` accept a
 * prefilled text. A Telegram group-invite path (`/joinchat/...`, `/+...`) is a
 * share target, not a chat, so appending a query would silently change the
 * destination and the helper returns `null` instead. An unknown scheme likewise
 * returns `null` rather than a mutated URL.
 */
export function withMessage(action: ContactAction, message: string): string | null {
  const text = message.trim();
  if (text.length === 0) {
    return action.url;
  }
  let parsed: URL;
  try {
    parsed = new URL(action.url);
  } catch {
    return null;
  }

  const isWa = parsed.hostname === 'wa.me';
  const isTgHost = parsed.hostname === 't.me' || parsed.hostname === 'telegram.me';
  if (!isWa && !isTgHost) {
    return null;
  }

  if (isTgHost) {
    // A bare single-segment path is a username chat; anything else (joinchat,
    // +invite, multi-segment) is an invitation and must not be rewritten.
    const segments = parsed.pathname.split('/').filter((part) => part.length > 0);
    if (segments.length !== 1 || segments[0]!.startsWith('+')) {
      return null;
    }
    if (parsed.search.length > 0) {
      return null;
    }
  }

  parsed.searchParams.set('text', text);
  return parsed.toString();
}

/** True when a URL is safe to hand to the OS/browser opener. */
export function isOpenableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
