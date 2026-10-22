/**
 * Node stub for `expo-sqlite`.
 *
 * The real package pulls in React Native's Flow sources, which the Node/Vitest
 * runner cannot parse (same reason `expo-constants` is stubbed). Unit tests that
 * exercise the study-plan store inject their own in-memory database, so no
 * native module is ever needed. Reaching this stub in a test means a module
 * tried to open the real database, which is a bug: fail loudly.
 */

export class SQLiteDatabase {
  async execAsync(): Promise<void> {
    throw new Error('expo-sqlite is not available in the Node test environment.');
  }
}

export async function openDatabaseAsync(): Promise<never> {
  throw new Error('expo-sqlite cannot be opened in the Node test environment.');
}
