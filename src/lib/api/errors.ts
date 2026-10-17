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

/** The network request never completed (offline, DNS failure, timeout...). */
export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
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
