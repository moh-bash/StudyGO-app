/**
 * Pure classification of a failed backend request into a user-facing connection
 * state.
 *
 * The bug this module exists to prevent: a request that the backend *answered*
 * (any HTTP status — `401`, `404`, `500`, …) must never be presented as "you are
 * offline / showing cached data". Only a real transport failure (`NetworkError`
 * with `kind: 'transport'`: DNS failure, no route, connection refused) is
 * evidence that the device could not reach the server. A request that merely
 * *ran out of time* (`kind: 'timeout'`) or was *cancelled* (`kind: 'aborted'`)
 * proves nothing about connectivity either: the backend was slow, not absent,
 * and saying "check your internet connection" in that case is a lie — the
 * false-warning defect fixed in Phase 5.2.
 *
 * Kept free of React and of the HTTP client so the exact rules are unit-tested
 * (`connection.test.ts`).
 */
import { ApiError, NetworkError } from './errors';

/** The kinds of outcome a catalog load can observe. */
export type ConnectionFailure = 'none' | 'network' | 'timeout' | 'api' | 'auth' | 'cache';

export interface ConnectionErrorInfo {
  failure: ConnectionFailure;
  /** The message to show, or `null` when nothing should be shown. */
  message: string | null;
  /**
   * True only for a genuine transport failure. Callers must never present a
   * non-transport failure (HTTP/API/auth/cache/timeout) as a device
   * connectivity issue.
   */
  isTransportFailure: boolean;
}

export const CONNECTION_MESSAGES = {
  /** Session rejected by the backend; the user must sign in again. */
  auth: 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.',
  /** The backend answered with a non-auth error. */
  api: 'تعذّر تحميل دليل المواد من الخادم.',
  /** The device genuinely could not reach the backend and nothing is cached. */
  network: 'تعذّر الاتصال بالخادم ولم يتم العثور على بيانات محفوظة.',
  /** The backend did not answer within the request deadline. */
  timeout: 'استغرق الخادم وقتًا طويلًا للاستجابة. حاول مرة أخرى.',
  /** Reading the local cache itself failed. */
  cache: 'تعذّر قراءة البيانات المحفوظة على الجهاز.',
} as const;

export const NO_CONNECTION_ERROR: ConnectionErrorInfo = {
  failure: 'none',
  message: null,
  isTransportFailure: false,
};

/**
 * Classifies a catalog request failure.
 *
 * @param error               the caught error (any shape)
 * @param hasDisplayableData  whether a catalog (fresh or cached) is already on
 *                            screen. A transport failure with cached data is a
 *                            *degraded but usable* state: no warning is shown,
 *                            because the student still sees their data — the
 *                            reported false "offline" message.
 */
export function classifyConnectionFailure(
  error: unknown,
  hasDisplayableData: boolean,
): ConnectionErrorInfo {
  if (error instanceof NetworkError) {
    if (error.kind === 'aborted') {
      // The request was cancelled (unmounted screen, superseded attempt). It
      // says nothing about the server, so nothing is shown.
      return { failure: 'none', message: null, isTransportFailure: false };
    }
    if (error.kind === 'timeout') {
      // The backend did not answer within the deadline. This is a *server*
      // problem (slow or overloaded), never proof that the device has no
      // internet connection.
      return {
        failure: 'timeout',
        message: CONNECTION_MESSAGES.timeout,
        isTransportFailure: false,
      };
    }
    if (hasDisplayableData) {
      // Transport failed, but cached data is shown: nothing to warn about.
      return { failure: 'none', message: null, isTransportFailure: true };
    }
    return {
      failure: 'network',
      message: CONNECTION_MESSAGES.network,
      isTransportFailure: true,
    };
  }

  if (error instanceof ApiError) {
    // The backend answered. This is proof the server was reachable, so it must
    // never be worded as a connectivity problem.
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { failure: 'auth', message: CONNECTION_MESSAGES.auth, isTransportFailure: false };
    }
    return {
      failure: 'api',
      message: error.message || CONNECTION_MESSAGES.api,
      isTransportFailure: false,
    };
  }

  // Any other thrown value (parse error, unexpected exception): treat it as a
  // software/API problem, never as "the device is offline".
  const message = error instanceof Error ? error.message : CONNECTION_MESSAGES.api;
  return { failure: 'api', message: message || CONNECTION_MESSAGES.api, isTransportFailure: false };
}

/** The error state produced when reading the local cache itself fails. */
export function cacheReadFailure(): ConnectionErrorInfo {
  return { failure: 'cache', message: CONNECTION_MESSAGES.cache, isTransportFailure: false };
}

/**
 * A tiny reducer for the catalog connection state, so "a stale error is cleared
 * by a later success" is explicit and testable rather than implied by scattered
 * `setState` calls.
 */
export interface CatalogConnectionState {
  failure: ConnectionFailure;
  error: string | null;
}

/** The state at the start of (or immediately after) a successful load. */
export function connectionIdle(): CatalogConnectionState {
  return { failure: 'none', error: null };
}

/** Applies a failure classification to the connection state. */
export function connectionFailed(info: ConnectionErrorInfo): CatalogConnectionState {
  return { failure: info.failure, error: info.message };
}

/** A successful response always clears any previous error. */
export function connectionSucceeded(): CatalogConnectionState {
  return connectionIdle();
}

/** Teams-specific wording, kept beside the classifier so both are tested together. */
export const TEAMS_FAILURE_MESSAGES = {
  /** The device genuinely could not reach the backend. */
  offline: 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.',
  /** The backend answered with an error; the message may come from the server. */
  api: 'تعذّر إكمال العملية. حاول مرة أخرى.',
  /** The backend did not answer in time — a slow server, not a lost connection. */
  timeout: CONNECTION_MESSAGES.timeout,
} as const;

export interface TeamsFailure {
  /** The message to render, or `null` when a stale error should stay hidden. */
  message: string | null;
  /** See {@link ConnectionErrorInfo.isTransportFailure}. */
  offline: boolean;
}

/**
 * Classifies a Teams request failure with the same rule the catalog uses: only a
 * real transport failure may be worded as a connectivity problem, and a failure
 * that happens while data is already on screen is not treated as offline.
 *
 * The Phase 5.1 defect this replaces: the Teams hook rendered the raw
 * `NetworkError`/API message for *every* failure, so a server error could be
 * shown as though the device were offline. Extracting it here (rather than
 * inlining it in the hook) is what makes the rule unit-testable, because the
 * hook itself has no renderer in this project.
 */
export function classifyTeamsFailure(error: unknown, hasDisplayableData: boolean): TeamsFailure {
  const info = classifyConnectionFailure(error, hasDisplayableData);
  if (info.isTransportFailure) {
    // When teams are already on screen the transport failure is silent (see the
    // `hasDisplayableData` rule) — otherwise it is an explicit offline message.
    return { message: hasDisplayableData ? null : TEAMS_FAILURE_MESSAGES.offline, offline: true };
  }
  if (info.failure === 'auth') {
    // Session wording is feature-agnostic; reuse it verbatim.
    return { message: info.message ?? CONNECTION_MESSAGES.auth, offline: false };
  }
  if (info.failure === 'timeout') {
    // The server was slow. Never worded as a connectivity problem.
    return { message: TEAMS_FAILURE_MESSAGES.timeout, offline: false };
  }
  if (info.failure === 'none') {
    // A cancelled request says nothing about the server: keep the panel quiet.
    return { message: null, offline: false };
  }
  // A real backend message (an `ApiError` carrying server text) is preserved.
  // The classifier's own generic wording is catalog-specific ("دليل المواد"),
  // so it must be replaced by the Teams copy rather than shown here.
  const backendMessage = error instanceof ApiError ? error.message : '';
  return {
    message: backendMessage || TEAMS_FAILURE_MESSAGES.api,
    offline: false,
  };
}
