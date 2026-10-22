/**
 * Secure authentication-token storage.
 *
 * On **native** platforms tokens are persisted only through the OS-backed
 * keystore via `expo-secure-store` (Android Keystore-encrypted SharedPreferences
 * / iOS Keychain). They are never written to AsyncStorage, SQLite, logs, or
 * source files, and if secure storage is unavailable the operation fails loudly
 * instead of silently falling back to insecure storage.
 *
 * On **web** `expo-secure-store` provides no implementation (its web module is
 * an empty stub: `isAvailableAsync()` resolves `false`), which made sign-in,
 * registration and session restore impossible in the browser — tokens could
 * never be persisted, so every reload signed the user out (Phase 4 finding,
 * re-verified in Phase 4.1). With the user's explicit approval, web builds use
 * a `localStorage` adapter under the same namespaced keys and the same
 * atomic-pair semantics. Trade-off, made deliberately and scoped to web only:
 * `localStorage` is readable by any script running on the page (XSS exposure),
 * where the native path is protected by the OS keystore. Web has no OS-backed
 * equivalent without adding a new dependency, which the task disallows unless
 * proven necessary. Any storage failure still raises {@link TokenStorageError} —
 * there is no silent failure path on any platform.
 *
 * This module is infrastructure only: it exposes a small typed interface for
 * authentication flows. No login, refresh orchestration, or UI is implemented
 * here.
 */
import * as SecureStore from 'expo-secure-store';

/** Raised when secure storage is unavailable or an operation fails. */
export class TokenStorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'TokenStorageError';
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStorage {
  /** Returns the stored access token, or `null` when absent. */
  getAccessToken(): Promise<string | null>;
  /** Returns the stored refresh token, or `null` when absent. */
  getRefreshToken(): Promise<string | null>;
  /** Returns both tokens, or `null` when either is missing. */
  getTokens(): Promise<AuthTokens | null>;
  /** Persists both tokens, overwriting any previous values. */
  saveTokens(tokens: AuthTokens): Promise<void>;
  /** Removes all stored tokens. Safe to call when nothing is stored. */
  clearTokens(): Promise<void>;
}

// Keys may contain only alphanumerics, '.', '-', and '_'.
const ACCESS_TOKEN_KEY = 'studygo.accessToken';
const REFRESH_TOKEN_KEY = 'studygo.refreshToken';

/**
 * Minimal key/value contract shared by both backends (OS keystore on native,
 * `localStorage` on web), so the pair-atomicity rules below exist once.
 */
interface TokenKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** OS keystore backend (native). Fails loudly when secure storage is missing. */
const secureKV: TokenKV = {
  async get(key) {
    if (!(await assertSecureStoreAvailable())) {
      throw new TokenStorageError(
        'Secure storage is unavailable on this platform. Tokens cannot be stored securely.',
      );
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (cause) {
      throw new TokenStorageError(`Failed to read "${key}" from secure storage.`, cause);
    }
  },
  async set(key, value) {
    if (!(await assertSecureStoreAvailable())) {
      throw new TokenStorageError(
        'Secure storage is unavailable on this platform. Tokens cannot be stored securely.',
      );
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (cause) {
      throw new TokenStorageError(`Failed to write "${key}" to secure storage.`, cause);
    }
  },
  async remove(key) {
    if (!(await assertSecureStoreAvailable())) {
      throw new TokenStorageError(
        'Secure storage is unavailable on this platform. Tokens cannot be stored securely.',
      );
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (cause) {
      throw new TokenStorageError(`Failed to delete "${key}" from secure storage.`, cause);
    }
  },
};

async function assertSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch (cause) {
    throw new TokenStorageError('Failed to query secure storage availability.', cause);
  }
}

/**
 * Web backend. `localStorage` access can throw (privacy mode, disabled
 * storage, quota), so every operation is guarded and surfaced as
 * `TokenStorageError` — never silently swallowed.
 */
function webStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (cause) {
    throw new TokenStorageError('Web storage (localStorage) is unavailable.', cause);
  }
  throw new TokenStorageError('Web storage (localStorage) is unavailable.');
}

const webKV: TokenKV = {
  async get(key) {
    try {
      return webStorage().getItem(key);
    } catch (cause) {
      if (cause instanceof TokenStorageError) {
        throw cause;
      }
      throw new TokenStorageError(`Failed to read "${key}" from web storage.`, cause);
    }
  },
  async set(key, value) {
    try {
      webStorage().setItem(key, value);
    } catch (cause) {
      if (cause instanceof TokenStorageError) {
        throw cause;
      }
      throw new TokenStorageError(`Failed to write "${key}" to web storage.`, cause);
    }
  },
  async remove(key) {
    try {
      webStorage().removeItem(key);
    } catch (cause) {
      if (cause instanceof TokenStorageError) {
        throw cause;
      }
      throw new TokenStorageError(`Failed to delete "${key}" from web storage.`, cause);
    }
  },
};

/**
 * True in a browser-like environment (Expo web / react-native-web). Native
 * React Native runtimes define no `window`, so they always take the keystore
 * path. Checked without importing `react-native` so this module keeps loading
 * in the plain-Node unit tests.
 */
const isWebPlatform =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

class KeyValueTokenStorage implements TokenStorage {
  constructor(private readonly kv: TokenKV) {}

  getAccessToken(): Promise<string | null> {
    return this.kv.get(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): Promise<string | null> {
    return this.kv.get(REFRESH_TOKEN_KEY);
  }

  async getTokens(): Promise<AuthTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      this.kv.get(ACCESS_TOKEN_KEY),
      this.kv.get(REFRESH_TOKEN_KEY),
    ]);
    if (accessToken === null || refreshToken === null) {
      return null;
    }
    return { accessToken, refreshToken };
  }

  async saveTokens(tokens: AuthTokens): Promise<void> {
    // There is no cross-key transaction in either backend, so guard against a
    // partially written pair (e.g. a token refresh where one write fails): if
    // either write fails, roll both keys back so the store is never left with
    // a mixed pair.
    try {
      await this.kv.set(ACCESS_TOKEN_KEY, tokens.accessToken);
      await this.kv.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      try {
        await this.kv.remove(ACCESS_TOKEN_KEY);
        await this.kv.remove(REFRESH_TOKEN_KEY);
      } catch {
        // Best-effort rollback; surface the original failure below.
      }
      throw error;
    }
  }

  async clearTokens(): Promise<void> {
    await this.kv.remove(ACCESS_TOKEN_KEY);
    await this.kv.remove(REFRESH_TOKEN_KEY);
  }
}

/**
 * Shared token-storage instance: OS keystore on native, `localStorage` on web
 * (see module docs for the approved web trade-off).
 */
export const tokenStorage: TokenStorage = new KeyValueTokenStorage(
  isWebPlatform ? webKV : secureKV,
);
