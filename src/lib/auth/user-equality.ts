/**
 * Reference-stability comparison for the signed-in `User` object.
 *
 * The bug this module exists to prevent: `restoreSession` validates the session
 * against `GET /auth/me` and receives a *fresh* object every time. Writing that
 * object into React state unconditionally churned the `user` reference on every
 * validation, which
 *
 * 1. re-rendered every `useAuth()` consumer, and
 * 2. invalidated any `useMemo` keyed on `[user]` — notably `useCatalog`'s
 *    `cacheScope`, whose change re-triggered the catalog effect, whose response
 *    fired `onBackendReachable`, whose handler re-validated the session …
 *    producing the reported ~once-per-second refresh loop.
 *
 * Two validations of the same, unchanged profile must therefore produce the
 * *same object reference*; only a genuine field change replaces it. Kept free
 * of React so the rule is unit-testable (`user-equality.test.ts`).
 */
import type { User } from '../api/types';

/**
 * True when both snapshots describe the same unchanged user.
 *
 * `null` vs `null` is "same" (so `setUser` bails out instead of re-rendering);
 * a `null` on either side never matches a populated snapshot. Every profile
 * field — including `updatedAt` — is compared, so a real server-side profile
 * change is *not* swallowed.
 */
export function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.id === b.id &&
    a.programId === b.programId &&
    a.fullName === b.fullName &&
    a.email === b.email &&
    a.role === b.role &&
    a.status === b.status &&
    a.profileImageUrl === b.profileImageUrl &&
    a.studentUniversityId === b.studentUniversityId &&
    a.phone === b.phone &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  );
}
