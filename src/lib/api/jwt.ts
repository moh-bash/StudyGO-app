/**
 * Minimal JWT payload inspection (no verification).
 *
 * The mobile client never validates signatures — the backend does that. This is
 * only used to read the `exp` claim so the HTTP client can refresh an access
 * token *before* it expires instead of waiting for a `401` round-trip.
 *
 * Decoding is dependency-free and tolerant: anything that is not a well-formed
 * three-part JWT with a numeric `exp` returns `null`, and callers fall back to
 * the reactive `401` refresh path.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of normalized) {
    if (char === '=') {
      break;
    }
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) {
      return null;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

/** Returns the access token's expiry as epoch milliseconds, or `null`. */
export function getTokenExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const payload = base64UrlDecode(parts[1]);
  if (payload === null) {
    return null;
  }
  const match = /"exp"\s*:\s*(\d+)/.exec(payload);
  if (!match) {
    return null;
  }
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * True when the token is already expired or will expire within `skewMs`.
 * Returns `false` for an unreadable token so the caller keeps the reactive
 * `401` path rather than refreshing blindly.
 */
export function isTokenExpiringSoon(token: string, skewMs: number): boolean {
  const expiry = getTokenExpiryMs(token);
  if (expiry === null) {
    return false;
  }
  return expiry - Date.now() <= skewMs;
}
