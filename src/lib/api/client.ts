/**
 * Lightweight typed HTTP client built on the platform `fetch`.
 *
 * Responsibilities:
 * - resolve the base URL from centralized config,
 * - attach JSON headers and, optionally, the stored bearer token,
 * - apply a per-request timeout,
 * - translate transport and HTTP failures into the typed errors in `errors.ts`,
 * - transparently refresh an expired access token once on a `401`.
 *
 * It deliberately contains no feature logic and no UI concerns. Base URL and
 * prefix come from `lib/config.ts`; token access goes through
 * `lib/storage/token-storage.ts`.
 *
 * Refresh handling
 * ----------------
 * An authenticated request is refreshed in two complementary ways:
 *
 * 1. *Proactively* — if the stored access token is unreadable as a JWT or is
 *    already expired/expiring within {@link REFRESH_SKEW_MS}, the client
 *    refreshes before sending, avoiding a wasted `401` round-trip.
 * 2. *Reactively* — on an eligible `401` (an authenticated request, retry not
 *    disabled, a handler is registered, and this request has not already been
 *    refreshed) the client refreshes and replays the request exactly once.
 *
 * The handler is registered by `lib/auth/session.ts` and is backed by that
 * module's single-flight refresh, so many concurrent requests share one refresh
 * and a rotated refresh token is never replayed. The client never refreshes the
 * unauthenticated refresh/register/login endpoints (their requests are not
 * `auth: true`) and never loops: at most one refresh + one retry per request.
 * `403`, validation and server errors are surfaced unchanged.
 */
import { getApiConfig } from '../config';
import { tokenStorage } from '../storage/token-storage';
import { ApiError, NetworkError, ResponseParseError } from './errors';
import type { NetworkFailureKind } from './errors';
import { isTokenExpiringSoon } from './jwt';
import type { ApiErrorBody } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** Serialized to JSON and sent with `Content-Type: application/json`. */
  body?: unknown;
  /** When true, attaches `Authorization: Bearer <accessToken>`. */
  auth?: boolean;
  /** Caller-owned abort signal, combined with the request timeout. */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * When false, a `401` on an authenticated request is surfaced without
   * attempting the refresh flow. Used by logout, where refreshing after a
   * local sign-out would be wrong.
   */
  retryOnUnauthorized?: boolean;
}

/** Refreshes the session and resolves with the new access token. */
export type RefreshHandler = () => Promise<string>;

/**
 * Refresh an access token this many milliseconds before it actually expires, to
 * absorb clock skew and the latency of the refresh call itself.
 */
const REFRESH_SKEW_MS = 60_000;

let refreshHandler: RefreshHandler | null = null;
let refreshFlight: Promise<string> | null = null;

/**
 * Registers (or clears, with `null`) the shared refresh handler used to recover
 * from an expired access token. Installed once by the session service.
 */
export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
  if (handler === null) {
    refreshFlight = null;
  }
}

/**
 * Listener notified after a request reaches the backend and receives a
 * well-formed HTTP response — *regardless of its status code*. A `2xx` proves
 * the backend is reachable; a `4xx`/`5xx` also proves it is reachable (the
 * server answered), so neither is evidence that the *device* is offline.
 *
 * This is the single reliable "the backend is reachable" signal: it is fired
 * only from {@link performFetch} after `fetch` resolves with a real
 * `Response`, never from the transport-failure (`NetworkError`) path. The auth
 * layer subscribes to it so a previously recorded offline state is cleared as
 * soon as any request actually reaches the server.
 */
export type BackendReachableListener = () => void;
const reachableListeners = new Set<BackendReachableListener>();

/** Subscribes to "the backend just answered a request". Returns an unsubscribe. */
export function onBackendReachable(listener: BackendReachableListener): () => void {
  reachableListeners.add(listener);
  return () => {
    reachableListeners.delete(listener);
  };
}

function emitBackendReachable(): void {
  for (const listener of reachableListeners) {
    try {
      listener();
    } catch {
      // A subscriber must never break request handling.
    }
  }
}

function refreshOnce(): Promise<string> {
  if (refreshFlight) return refreshFlight;
  if (!refreshHandler) {
    return Promise.reject(new ApiError('Session refresh is unavailable.', 401, null));
  }
  refreshFlight = refreshHandler().finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}

function extractMessage(body: ApiErrorBody | undefined): string | undefined {
  if (!body) {
    return undefined;
  }
  if (Array.isArray(body.message)) {
    return body.message.join(', ');
  }
  return typeof body.message === 'string' ? body.message : undefined;
}

interface RawResult {
  response: Response;
  parsed: unknown;
}

/**
 * Internal (English) description of a request that produced no response.
 *
 * These strings are never shown to the student: the UI wording comes from
 * `lib/api/connection.ts` / `lib/auth/errors.ts`, which classify the failure
 * by {@link NetworkFailureKind}. They only exist to make logs and test
 * failures readable.
 */
function messageForFailure(kind: NetworkFailureKind, path: string, timeoutMs: number): string {
  switch (kind) {
    case 'timeout':
      return `Request to ${path} timed out after ${timeoutMs}ms.`;
    case 'aborted':
      return `Request to ${path} was aborted before it completed.`;
    default:
      return `Request to ${path} failed. Check your connection.`;
  }
}

async function performFetch(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body: string | undefined,
  path: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<RawResult> {
  const controller = new AbortController();
  // The three ways a request can end without an HTTP response must stay
  // distinguishable: only a real transport failure proves the device has no
  // connection, while our own deadline and a caller-owned abort say nothing
  // about connectivity. Collapsing all three into one error is what produced
  // the false "check your internet" warning (Phase 5.2).
  let timedOut = false;
  let aborted = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => {
    aborted = true;
    controller.abort();
  };
  if (signal) {
    if (signal.aborted) {
      aborted = true;
      controller.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort);
    }
  }

  let response: Response;
  let rawText: string;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
    rawText = await response.text();
  } catch (cause) {
    const kind: NetworkFailureKind = timedOut ? 'timeout' : aborted ? 'aborted' : 'transport';
    throw new NetworkError(messageForFailure(kind, path, timeoutMs), cause, kind);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  // The backend answered (even if with an error status): the device is online
  // and the server is reachable. This must be recorded *before* a non-2xx is
  // turned into an ApiError below, so a real API error never leaves a stale
  // "offline" state behind, and a later success can clear it.
  emitBackendReachable();

  let parsed: unknown;
  if (rawText.length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch (cause) {
      if (response.ok) {
        throw new ResponseParseError(`Malformed JSON received from ${path}.`, cause);
      }
      parsed = rawText;
    }
  }

  return { response, parsed };
}

/**
 * Performs an API request and returns the parsed JSON body.
 *
 * @throws ConfigError     missing/invalid configuration
 * @throws TokenStorageError when an authenticated request needs the token store
 * @throws NetworkError    the request produced no response: `kind` tells
 *                         whether it was a genuine transport failure
 *                         (`'transport'`), our own deadline (`'timeout'`) or a
 *                         caller abort (`'aborted'`)
 * @throws ResponseParseError malformed 2xx body
 * @throws ApiError        non-2xx response
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = getApiConfig();
  const url = /^https?:\/\//i.test(path) ? path : `${config.apiBaseUrl}${path}`;
  const method = options.method ?? 'GET';
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  const mayRetryOn401 = options.retryOnUnauthorized !== false;

  let refreshed = false;

  // The loop runs at most twice: the original attempt, plus one retry after a
  // successful token refresh.
  for (;;) {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.auth) {
      let token = await tokenStorage.getAccessToken();
      if (token === null) {
        throw new ApiError('Not authenticated: no access token is stored.', 401, null);
      }

      // Proactive refresh: a readable token that is already expired / about to
      // expire is refreshed up front so the request does not fail with a 401.
      // An unreadable (non-JWT) token is left to the reactive path below.
      if (
        mayRetryOn401 &&
        !refreshed &&
        refreshHandler !== null &&
        isTokenExpiringSoon(token, REFRESH_SKEW_MS)
      ) {
        refreshed = true;
        // May throw (network failure, definitive rejection). Those errors
        // propagate so callers keep the access-vs-offline distinction.
        token = await refreshOnce();
      }

      headers.Authorization = `Bearer ${token}`;
    }

    const { response, parsed } = await performFetch(
      url,
      method,
      headers,
      body,
      path,
      options.signal,
      config.timeoutMs,
    );

    if (!response.ok) {
      if (
        response.status === 401 &&
        options.auth === true &&
        mayRetryOn401 &&
        !refreshed &&
        refreshHandler !== null
      ) {
        refreshed = true;
        // May throw (definitive rejection, network failure, ...). Those errors
        // propagate unchanged so callers keep the access-vs-offline distinction.
        await refreshOnce();
        // Re-read the newest token on the next iteration.
        continue;
      }

      const errorBody =
        typeof parsed === 'object' && parsed !== null ? (parsed as ApiErrorBody) : undefined;
      const message =
        extractMessage(errorBody) ?? `Request to ${path} failed with status ${response.status}.`;
      throw new ApiError(message, response.status, parsed, errorBody?.error);
    }

    return parsed as T;
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
