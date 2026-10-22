/**
 * Authentication session service.
 *
 * Owns the token lifecycle (persist, restore, refresh, clear) and is free of
 * React and UI concerns so it can be reused and reasoned about in isolation.
 * All token persistence goes through the secure-storage abstraction in
 * `lib/storage/token-storage.ts`; the non-sensitive profile snapshot goes
 * through `lib/storage/profile-cache.ts`.
 *
 * Refresh behaviour (verified against `study-go-api/src/auth/auth.service.ts`):
 * `POST /auth/refresh` rotates the refresh token — the presented token is
 * revoked and a brand-new pair is returned. Refresh is therefore single-flight:
 * concurrent callers share one in-flight request so a rotated token is never
 * replayed, and there is no automatic retry loop.
 *
 * Restoration distinguishes a *genuine transport failure* (tokens are kept and
 * the app continues in a local-only/offline state) from an *explicit rejection*
 * (401/403 — tokens are cleared, the session is over) and from *the backend
 * answering but failing* (a 5xx or malformed body — the device is online, the
 * server is unhealthy; reported as `server-error`, never as `offline`). It
 * never treats the mere presence of a stored token as proof of a valid backend
 * session, and never treats an HTTP error as proof of missing connectivity.
 */
import { ApiError, isTransportFailure } from '../api/errors';
import { authApi } from '../api/auth';
import { setRefreshHandler } from '../api/client';
import type { AuthResponse, User } from '../api/types';
import { tokenStorage, TokenStorageError } from '../storage/token-storage';
import { clearProfile, getProfile, saveProfile } from '../storage/profile-cache';
import { parseAuthResponse, parseUser } from './response';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  /**
   * Selected academic program UUID (from `GET /programs/registration`).
   * Required by the backend `RegisterDto`; the server validates that it
   * exists and is active. The caller must confirm the id belongs to the
   * currently loaded program list.
   */
  programId: string;
  /** Optional contact phone number; omitted from the request when empty. */
  phone?: string;
}

/**
 * Result of a session-restore attempt.
 *
 * - `authenticated`: the backend validated the session (online + authenticated).
 * - `offline`: the device genuinely could not reach the backend (a real
 *   transport failure: no network, DNS failure, connection refused); tokens are
 *   retained and the app may continue with locally available data. This is
 *   **not** proof of a remote session.
 * - `server-error`: the backend was reachable but did not produce a usable
 *   answer — it failed (5xx / malformed body) or did not answer within the
 *   startup deadline. The device is online and the server is reachable but
 *   slow/unhealthy — this must never be presented as "you are offline". Tokens
 *   are retained, exactly like `offline`.
 * - `rejected`: the backend explicitly rejected the credentials/session; local
 *   credentials have been cleared.
 * - `none`: no stored session existed (or secure storage itself was unreadable,
 *   so no session can be proven).
 */
export type RestoreOutcome =
  | { state: 'none' }
  | { state: 'authenticated'; user: User }
  | { state: 'offline'; user: User | null }
  | { state: 'server-error'; user: User | null }
  | { state: 'rejected' };

/**
 * Shorter-than-default timeout for the startup validation call so a slow or
 * unreachable backend does not hold the opening screen for the full request
 * timeout. The abort surfaces as a `NetworkError` with `kind: 'aborted'`,
 * which is **not** a transport failure: a server that needs more than six
 * seconds to answer is slow, not absent, so the app reports `server-error`
 * and never claims the device is offline.
 */
const RESTORE_TIMEOUT_MS = 6_000;

let inFlightRefresh: Promise<AuthResponse> | null = null;

/**
 * Listeners notified when the local session is invalidated by an explicit
 * backend rejection (a `401`/`403` on refresh), as opposed to an explicit user
 * sign-out. The UI subscribes so a background request that discovers an expired
 * session flips the app back to the login screens immediately, instead of
 * leaving the user on a screen whose requests all fail.
 */
type SessionInvalidationListener = () => void;
const invalidationListeners = new Set<SessionInvalidationListener>();

/**
 * Subscribes to backend-driven session invalidation. Returns an unsubscribe
 * function.
 */
export function onSessionInvalidated(listener: SessionInvalidationListener): () => void {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

function emitSessionInvalidated(): void {
  for (const listener of invalidationListeners) {
    listener();
  }
}

/**
 * Monotonic counter bumped whenever the local session is torn down. A refresh
 * that resolves after a teardown (e.g. a logout racing an in-flight refresh)
 * must not re-persist its now-stale token pair, so `performRefresh` captures the
 * epoch before the network call and discards the result if it changed.
 */
let sessionEpoch = 0;

function restoreSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), RESTORE_TIMEOUT_MS);
  // Aborting an already-finished request is a no-op, so the timer needs no
  // explicit cleanup.
  return controller.signal;
}

/** Clears stored tokens + cached profile, swallowing errors so logout completes. */
export async function clearSession(): Promise<void> {
  sessionEpoch += 1;
  try {
    await tokenStorage.clearTokens();
  } catch {
    // Best-effort: never block logout/cleanup on a storage failure.
  }
  await clearProfile();
}

async function persistTokens(response: AuthResponse): Promise<void> {
  await tokenStorage.saveTokens({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  });
}

/** `POST /auth/login` then persists the returned tokens + profile snapshot. */
export async function signIn(email: string, password: string): Promise<User> {
  const response = parseAuthResponse(await authApi.login({ email: email.trim(), password }));
  await persistTokens(response);
  await saveProfile(response.user);
  return response.user;
}

/**
 * `POST /auth/register` then persists the returned tokens + profile snapshot.
 *
 * The verified backend issues a full session on registration, so a successful
 * sign-up establishes an authenticated session. Only DTO-supported fields are
 * sent (`fullName`, `email`, `password`, `programId`, optional `phone`); the
 * password confirmation is a client-only check and is never transmitted, and
 * no `role` is ever sent — the backend always assigns `STUDENT`.
 */
export async function signUp(input: SignUpInput): Promise<User> {
  const phone = input.phone?.trim();
  const response = parseAuthResponse(
    await authApi.register({
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      password: input.password,
      programId: input.programId,
      ...(phone ? { phone } : {}),
    }),
  );
  await persistTokens(response);
  await saveProfile(response.user);
  return response.user;
}

/**
 * Refreshes the session, de-duplicating concurrent callers. On a rejected
 * refresh token (401/403) the local session + profile are cleared.
 */
export function refreshSession(): Promise<AuthResponse> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  inFlightRefresh = performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<AuthResponse> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new ApiError('No refresh token is stored.', 401, null);
  }

  const startEpoch = sessionEpoch;

  let response: AuthResponse;
  try {
    response = parseAuthResponse(await authApi.refresh({ refreshToken }));
  } catch (error) {
    if (isAuthRejection(error)) {
      await clearSession();
      // Tell the UI a background refresh was rejected so it can return to the
      // signed-out state. Explicit sign-out does not go through this path.
      emitSessionInvalidated();
    }
    throw error;
  }

  if (sessionEpoch !== startEpoch) {
    // The session was torn down (e.g. logout) while this refresh was in flight.
    // Discard the rotated pair instead of resurrecting a signed-out session.
    throw new ApiError('The session was cleared during refresh.', 401, null);
  }

  await persistTokens(response);
  await saveProfile(response.user);
  return response;
}

/** True when the error is an explicit backend rejection of the credentials. */
function isAuthRejection(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
}

/**
 * Restores a session on startup (or when reconnecting).
 *
 * The access token is validated against `GET /auth/me`. A `401` triggers
 * exactly one refresh attempt. Outcomes, classified honestly by *what actually
 * happened on the wire*:
 *
 * - transport failure (offline, timeout, abort) → `offline` — tokens kept;
 * - backend answered with 5xx / malformed body → `server-error` — tokens kept,
 *   but the device is **online** and must not be told "you are offline";
 * - explicit rejection (401 after a failed refresh, 403) → `rejected` — local
 *   credentials cleared;
 * - secure storage unreadable → `none` — no session can be proven.
 */
export async function restoreSession(): Promise<RestoreOutcome> {
  let tokens;
  try {
    tokens = await tokenStorage.getTokens();
  } catch (error) {
    if (error instanceof TokenStorageError) {
      // Secure storage unavailable: no provable session. Keep any cached profile
      // for display, but do not claim authentication.
      return { state: 'none' };
    }
    throw error;
  }

  if (!tokens) {
    // No stored credentials: ensure no stale profile from a previous account
    // remains visible.
    await clearProfile();
    return { state: 'none' };
  }

  try {
    const user = parseUser(await authApi.me({ signal: restoreSignal() }));
    await saveProfile(user);
    return { state: 'authenticated', user };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      try {
        const refreshed = await refreshSession();
        return { state: 'authenticated', user: refreshed.user };
      } catch (refreshError) {
        if (isAuthRejection(refreshError)) {
          return { state: 'rejected' };
        }
        // Same honest classification for the refresh attempt itself: only a
        // transport failure is "offline"; a 5xx answer means the (reachable)
        // server is unhealthy.
        return { state: restoreFailureState(refreshError), user: await getProfile() };
      }
    }

    if (isAuthRejection(error)) {
      await clearSession();
      return { state: 'rejected' };
    }

    return { state: restoreFailureState(error), user: await getProfile() };
  }
}

/**
 * Maps a non-auth `restoreSession` failure to `offline` vs `server-error`.
 *
 * `offline` is reserved for a real transport failure (`kind: 'transport'`):
 * the request never reached a server (no network, DNS failure, connection
 * refused). Every other failure means the backend was either reachable and
 * failing, or simply too slow to answer within the deadline — in both cases
 * the device may well be online, so it is reported as `server-error` and never
 * worded as a connectivity problem.
 *
 * Classified through {@link isTransportFailure} so the rule has exactly one
 * implementation across the app.
 */
function restoreFailureState(error: unknown): 'offline' | 'server-error' {
  return isTransportFailure(error) ? 'offline' : 'server-error';
}

/**
 * Logs out: attempts to revoke the refresh token server-side, then always clears
 * local credentials + cached profile. Local cleanup happens even when the
 * network request fails. Server-side revocation works even when the access
 * token has expired — the backend accepts `POST /auth/logout` based on
 * refresh-token possession. Local SQLite data is owned by `AuthContext`, which
 * wipes it on sign-out and on every terminal session outcome.
 */
export async function logout(): Promise<void> {
  let refreshToken: string | null = null;
  try {
    refreshToken = await tokenStorage.getRefreshToken();
  } catch {
    refreshToken = null;
  }

  if (refreshToken) {
    try {
      await authApi.logout({ refreshToken });
    } catch {
      // Offline, expired access token, or already-revoked token: ignore and
      // proceed to clear local credentials. Server-side revocation is NOT
      // claimed when this fails.
    }
  }

  await clearSession();
}

// Register the shared refresh handler used by the HTTP client to recover from an
// expired access token. Backed by the same single-flight `refreshSession`, so a
// client-level `401` and a session restore never trigger duplicate refreshes.
setRefreshHandler(async () => (await refreshSession()).accessToken);
