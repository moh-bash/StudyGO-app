/** Unit tests for the JWT `exp` reader used by the proactive refresh path. */
import { describe, expect, it } from 'vitest';
import { getTokenExpiryMs, isTokenExpiringSoon } from './jwt';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Dependency-free base64url encoder so the test needs no Node typings. */
function base64UrlEncode(value: Record<string, unknown>): string {
  const json = JSON.stringify(value);
  let base64 = '';
  for (let index = 0; index < json.length; index += 3) {
    const first = json.charCodeAt(index);
    const second = json.charCodeAt(index + 1);
    const third = json.charCodeAt(index + 2);
    base64 += BASE64_CHARS[first >> 2];
    base64 += BASE64_CHARS[((first & 3) << 4) | (Number.isNaN(second) ? 0 : second >> 4)];
    if (!Number.isNaN(second)) {
      base64 += BASE64_CHARS[((second & 15) << 2) | (Number.isNaN(third) ? 0 : third >> 6)];
    }
    if (!Number.isNaN(third)) {
      base64 += BASE64_CHARS[third & 63];
    }
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

function tokenWithPayload(payload: Record<string, unknown>): string {
  return `${base64UrlEncode({ alg: 'HS256', typ: 'JWT' })}.${base64UrlEncode(payload)}.signature`;
}

describe('getTokenExpiryMs', () => {
  it('reads the exp claim in milliseconds', () => {
    const token = tokenWithPayload({ sub: 'u1', exp: 1_700_000_000 });
    expect(getTokenExpiryMs(token)).toBe(1_700_000_000_000);
  });

  it('returns null for a non-JWT string', () => {
    expect(getTokenExpiryMs('opaque-refresh-token')).toBeNull();
    expect(getTokenExpiryMs('a.b')).toBeNull();
  });

  it('returns null when the payload has no exp', () => {
    expect(getTokenExpiryMs(tokenWithPayload({ sub: 'u1' }))).toBeNull();
  });
});

describe('isTokenExpiringSoon', () => {
  it('is true once the token is past its expiry', () => {
    const token = tokenWithPayload({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpiringSoon(token, 60_000)).toBe(true);
  });

  it('is true within the skew window', () => {
    const token = tokenWithPayload({ exp: Math.floor(Date.now() / 1000) + 30 });
    expect(isTokenExpiringSoon(token, 60_000)).toBe(true);
  });

  it('is false well before expiry', () => {
    const token = tokenWithPayload({ exp: Math.floor(Date.now() / 1000) + 900 });
    expect(isTokenExpiringSoon(token, 60_000)).toBe(false);
  });

  it('is false for an unreadable token so the reactive path is kept', () => {
    expect(isTokenExpiringSoon('opaque', 60_000)).toBe(false);
  });
});
