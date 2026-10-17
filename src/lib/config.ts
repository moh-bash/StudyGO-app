/**
 * Centralized runtime configuration for the mobile app.
 *
 * Values are read from Expo public environment variables (the `EXPO_PUBLIC_`
 * prefix), which Expo inlines into the JS bundle at build time. Only non-secret
 * values belong here: never put credentials, private keys, tokens, or other
 * server secrets in `EXPO_PUBLIC_*` variables.
 *
 * The web admin app (`study-go-web`) uses an HttpOnly-cookie BFF session and is
 * not reachable from the mobile client; the mobile app targets the backend API
 * directly.
 */
import { ConfigError } from './api/errors';
import Constants from 'expo-constants';

/**
 * Verified from the backend bootstrap (`study-go-api/src/main.ts`): a global
 * `api` prefix plus a default URI version of `1`, so every route is served
 * under `/api/v1`.
 */
export const API_PREFIX = '/api/v1';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiConfig {
  /** Backend origin, without the `/api/v1` suffix. */
  baseUrl: string;
  /** Fully-qualified API root: `${baseUrl}${API_PREFIX}`. */
  apiBaseUrl: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

function readBaseUrl(): string {
  // Environment variables are convenient during development, but `.env`
  // files are intentionally not included in standalone builds. Keep the
  // public production endpoint in Expo's app config as a build-time fallback.
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    Constants.expoConfig?.extra?.apiBaseUrl;
  const raw = typeof configuredUrl === 'string' ? configuredUrl : undefined;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ConfigError(
      'API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL or expo.extra.apiBaseUrl.',
    );
  }
  return raw.trim().replace(/\/+$/, '');
}

function readTimeoutMs(): number {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

let cached: ApiConfig | null = null;

/**
 * Returns the validated API configuration, computed once and cached.
 * Throws {@link ConfigError} when required configuration is missing.
 */
export function getApiConfig(): ApiConfig {
  if (cached) {
    return cached;
  }
  const baseUrl = readBaseUrl();
  cached = {
    baseUrl,
    apiBaseUrl: `${baseUrl}${API_PREFIX}`,
    timeoutMs: readTimeoutMs(),
  };
  return cached;
}

/** Test/development helper to reset the memoized configuration. */
export function resetApiConfigCache(): void {
  cached = null;
}
