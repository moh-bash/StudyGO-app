/**
 * Non-sensitive profile cache.
 *
 * Stores a copy of the authenticated user's public profile so the app can show
 * who is signed in and allow locally-available features during a transient
 * network outage, without ever caching credentials. This is guarded against
 * cross-account leakage: it is overwritten on every successful sign-in /
 * register / refresh and cleared on logout or when the session is rejected.
 *
 * The cached value contains only the fields already returned by the verified
 * `UserResponseDto` (name, email, role, status, ids, avatar URL). It never
 * contains access/refresh tokens or password material — those live only in
 * `expo-secure-store` via `lib/storage/token-storage.ts`.
 *
 * Stored in AsyncStorage (not secure storage) because the data is not secret;
 * it is only used to render the locally available app while offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../api/types';

const PROFILE_KEY = 'studygo.profile';

/** Persists a non-sensitive snapshot of the signed-in user. Best-effort. */
export async function saveProfile(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  } catch {
    // A cache write failure must never break the auth flow.
  }
}

/** Returns the cached profile, or `null` when absent/unreadable. */
export async function getProfile(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as User;
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Removes the cached profile. Safe to call when nothing is cached. */
export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // Best-effort.
  }
}
