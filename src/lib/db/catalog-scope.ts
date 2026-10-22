/**
 * Pure scoping rules for the on-device catalog cache (`catalog_meta`).
 *
 * Kept free of `expo-sqlite` imports so the rules are unit-testable in the
 * Node test environment. Phase 1 (account isolation): the cache row records
 * *which account* fetched it (and for which program), and a read from any
 * other account/program must never be served — a mismatched cache is treated
 * as absent so the UI falls back to a network fetch instead of showing
 * another user's data.
 */

/** What the cache row records (`catalog_meta.user_id` + `program_id`). */
export interface CatalogCacheMeta {
  /** The account id that fetched the cache; `null` for pre-v2 legacy rows. */
  userId: string | null;
  /** The program the cache was fetched for; `null` = no program assigned. */
  programId: string | null;
}

/** The account currently signed in on the device. */
export interface CatalogCacheScope {
  userId: string;
  /** The signed-in user's current program (`User.programId`). */
  programId: string | null;
}

/**
 * True only when the cached rows belong to this exact account *and* this
 * account's current program. Conservative by design:
 * - legacy rows written before the `user_id` column existed never match;
 * - a program change (e.g. reassigned by an admin) invalidates the cache so a
 *   stale program's catalog is never rendered.
 */
export function isCatalogCacheForScope(
  meta: CatalogCacheMeta,
  scope: CatalogCacheScope,
): boolean {
  return meta.userId === scope.userId && meta.programId === scope.programId;
}
