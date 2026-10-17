/**
 * Secure authentication-token storage.
 *
 * Tokens are persisted only through the OS-backed keystore via
 * `expo-secure-store` (Android Keystore-encrypted SharedPreferences / iOS
 * Keychain). They are never written to AsyncStorage, SQLite, logs, or source
 * files. If secure storage is unavailable the operation fails loudly instead of
 * silently falling back to insecure storage.
 *
 * This module is infrastructure only: it exposes a small typed interface for
 * future authentication flows. No login, refresh orchestration, or UI is
 * implemented here.
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

async function assertAvailable(): Promise<void> {
  let available: boolean;
  try {
    available = await SecureStore.isAvailableAsync();
  } catch (cause) {
    throw new TokenStorageError('Failed to query secure storage availability.', cause);
  }
  if (!available) {
    throw new TokenStorageError(
      'Secure storage is unavailable on this platform. Tokens cannot be stored securely.',
    );
  }
}

async function readItem(key: string): Promise<string | null> {
  await assertAvailable();
  try {
    return await SecureStore.getItemAsync(key);
  } catch (cause) {
    throw new TokenStorageError(`Failed to read "${key}" from secure storage.`, cause);
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  await assertAvailable();
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (cause) {
    throw new TokenStorageError(`Failed to write "${key}" to secure storage.`, cause);
  }
}

async function deleteItem(key: string): Promise<void> {
  await assertAvailable();
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (cause) {
    throw new TokenStorageError(`Failed to delete "${key}" from secure storage.`, cause);
  }
}

class SecureTokenStorage implements TokenStorage {
  getAccessToken(): Promise<string | null> {
    return readItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): Promise<string | null> {
    return readItem(REFRESH_TOKEN_KEY);
  }

  async getTokens(): Promise<AuthTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      readItem(ACCESS_TOKEN_KEY),
      readItem(REFRESH_TOKEN_KEY),
    ]);
    if (accessToken === null || refreshToken === null) {
      return null;
    }
    return { accessToken, refreshToken };
  }

  async saveTokens(tokens: AuthTokens): Promise<void> {
    // SecureStore has no cross-key transaction, so guard against a partially
    // written pair (e.g. a token refresh where one write fails): if either write
    // fails, roll both keys back so the store is never left with a mixed pair.
    try {
      await writeItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      await writeItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      try {
        await deleteItem(ACCESS_TOKEN_KEY);
        await deleteItem(REFRESH_TOKEN_KEY);
      } catch {
        // Best-effort rollback; surface the original failure below.
      }
      throw error;
    }
  }

  async clearTokens(): Promise<void> {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
  }
}

/** Shared token-storage instance backed by the OS keystore. */
export const tokenStorage: TokenStorage = new SecureTokenStorage();
