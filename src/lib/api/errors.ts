/**
 * Typed error hierarchy for API and configuration failures.
 *
 * Keeping these distinct lets callers (and future UI) tell the difference
 * between "the app is misconfigured" and "the request failed", without
 * inspecting message strings.
 */

/** The app is misconfigured (e.g. a required environment variable is missing). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Why a request failed *before* any HTTP response was received.
 *
 * The distinction matters because only one of these kinds is evidence that the
 * device could not reach the server:
 *
 * - `transport`: the request never reached a server (no network, DNS failure,
 *   connection refused). This is the **only** kind that may be worded as
 *   "check your internet connection".
 * - `timeout`: the request was still unanswered when our own deadline
 *   expired. The backend is reachable but slow/overloaded — saying "you are
 *   offline" here is a lie (the Phase 5.2 false-warning defect).
 * - `aborted`: the request was cancelled before it completed (a caller-owned
 *   signal, e.g. the startup validation deadline). It says nothing about
 *   connectivity at all.
 */
export type NetworkFailureKind = 'transport' | 'timeout' | 'aborted';

/** The network request never completed (offline, DNS failure, timeout...). */
export class NetworkError extends Error {
  /**
   * @param kind what actually happened on the wire. Defaults to `transport`
   *   so an error constructed without more detail keeps the strictest (and
   *   only connectivity-proving) meaning.
   */
  constructor(
    message: string,
    readonly cause?: unknown,
    readonly kind: NetworkFailureKind = 'transport',
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * The single source of truth for "is this a genuine connectivity failure?".
 *
 * Only a `transport` failure proves the device could not reach the backend.
 * A timeout or an abort must never be presented as an internet problem, so
 * every caller classifies through this helper instead of re-deriving the rule.
 */
export function isTransportFailure(error: unknown): error is NetworkError {
  return error instanceof NetworkError && error.kind === 'transport';
}

/**
 * The failure kind of a network error, or `null` when the error is not a
 * network error at all (the backend answered, or the failure is a bug).
 */
export function networkFailureKind(error: unknown): NetworkFailureKind | null {
  return error instanceof NetworkError ? error.kind : null;
}

/**
 * The backend responded with a non-2xx status. `statusCode` mirrors the
 * backend `AllExceptionsFilter` envelope (`statusCode`, `error`, `message`).
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string | undefined;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body: unknown, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.body = body;
    this.errorCode = errorCode;
  }
}

/** A JSON response could not be parsed into the expected shape. */
export class ResponseParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ResponseParseError';
  }
}
