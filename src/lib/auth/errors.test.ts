/**
 * Unit tests for the auth error wording.
 *
 * The Phase 5.2 defect lived here: every `NetworkError` — including a request
 * that merely ran out of time — was worded as "check your internet connection",
 * which told the student their device was offline while the backend was simply
 * slow (or the request was cancelled).
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/errors';
import { mapAuthError } from './errors';

// The auth error mapper imports the token-storage abstraction, which pulls in
// `expo-secure-store` (and therefore React Native's Flow source) — not
// parseable by the Node runner. The module is irrelevant here, so it is stubbed
// exactly like `session.test.ts` does.
vi.mock('../storage/token-storage', () => ({
  TokenStorageError: class TokenStorageError extends Error {},
  tokenStorage: {
    getAccessToken: async () => null,
    getRefreshToken: async () => null,
    getTokens: async () => null,
    saveTokens: async () => undefined,
    clearTokens: async () => undefined,
  },
}));

describe('mapAuthError', () => {
  it('mentions the internet only for a genuine transport failure', () => {
    const message = mapAuthError(new NetworkError('offline'));
    expect(message).toContain('الإنترنت');
  });

  it('does NOT blame the internet when the server was merely slow', () => {
    const message = mapAuthError(new NetworkError('slow', undefined, 'timeout'));
    expect(message).not.toContain('الإنترنت');
    expect(message).toBe('استغرق الخادم وقتًا طويلًا للاستجابة. حاول مرة أخرى.');
  });

  it('does NOT blame the internet when the request was cancelled', () => {
    const message = mapAuthError(new NetworkError('cancelled', undefined, 'aborted'));
    expect(message).not.toContain('الإنترنت');
  });

  it('keeps the credential wording for a 401 on sign-in', () => {
    expect(mapAuthError(new ApiError('nope', 401, null), 'login')).toBe(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    );
  });

  it('uses the session wording for a 401 outside sign-in', () => {
    expect(mapAuthError(new ApiError('nope', 401, null), 'register')).toBe(
      'انتهت صلاحية الجلسة. يرجى تسجيل الدخول من جديد.',
    );
  });

  it('does not blame the internet for a 5xx', () => {
    const message = mapAuthError(new ApiError('boom', 500, null));
    expect(message).not.toContain('الإنترنت');
  });
});
