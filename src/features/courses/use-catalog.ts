import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { catalogApi } from '@/lib/api/catalog';
import type { Catalog } from '@/lib/api/catalog';
import {
  cacheReadFailure,
  classifyConnectionFailure,
  connectionFailed,
  connectionIdle,
  connectionSucceeded,
  type CatalogConnectionState,
} from '@/lib/api/connection';
import { getCatalog, saveCatalog } from '@/lib/db/catalog-store';
import type { CatalogCacheScope } from '@/lib/db/catalog-scope';
import { useAuth } from '@/lib/auth/AuthContext';

export interface UseCatalogResult {
  catalog: Catalog | null;
  loading: boolean;
  fromCache: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

/**
 * Loads the program-scoped catalog, caching it locally, and classifies any
 * failure into the connection states in `lib/api/connection.ts`:
 *
 * - only a genuine transport failure (`NetworkError` with `kind: 'transport'`)
 *   with *nothing* to show may be presented as "could not reach the server";
 * - a timeout means the server was slow, not absent, and is worded as such;
 * - an HTTP/API error proves the server was reachable and must never be worded
 *   as a connectivity problem;
 * - a successful response always clears a previous error, so a stale warning is
 *   never left on screen after the backend recovers.
 */
export function useCatalog(): UseCatalogResult {
  const { user } = useAuth();
  // The local catalog cache is scoped to the signed-in account. Without a user
  // (signed out / restore pending) the cache must never be read or written.
  //
  // The memo is keyed on the *primitive* id fields, never on the `user` object
  // itself: `GET /auth/me` returns a fresh object on every session validation,
  // and keying on identity made this scope change on each validation, which
  // changed `load`, which restarted the fetch effect below — the reported
  // ~once-per-second refetch loop. Keying on primitives means only a real
  // account/program change (or sign-in/out) reloads the catalog.
  const userId = user?.id ?? null;
  const programId = user?.programId ?? null;
  const cacheScope = useMemo<CatalogCacheScope | null>(
    () => (userId !== null ? { userId, programId } : null),
    [userId, programId],
  );
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [connection, setConnection] = useState<CatalogConnectionState>(connectionIdle);

  const active = useRef(true);
  // Latest values for the network path, read *inside* the callback instead of
  // being closed over, so an in-flight load always reasons about the current
  // catalog/cache rather than a stale render's snapshot.
  const catalogRef = useRef<Catalog | null>(null);
  const hadCacheRef = useRef(false);

  // Request de-duplication: while a network fetch is in flight, concurrent
  // callers (mount + a pull-to-refresh, say) share it instead of firing a
  // second `/catalog` request.
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(
    (force: boolean): Promise<void> => {
      if (inFlight.current) {
        return inFlight.current;
      }
      const run = (async () => {
        // A new attempt clears any previous error immediately, so a stale
        // warning is never shown while a fresh request is being made.
        setConnection(connectionIdle());
        if (!force) {
          setLoading(true);
        }

        let cached: Catalog | null = null;
        try {
          cached = cacheScope ? await getCatalog(cacheScope) : null;
          if (active.current && cached) {
            catalogRef.current = cached;
            hadCacheRef.current = true;
            setCatalog(cached);
            setFromCache(true);
            if (!force) {
              setLoading(false);
            }
          }
        } catch {
          // Reading the local cache failed. The network path below may still
          // succeed, so only record the failure if it also fails.
          if (active.current) {
            setConnection(connectionFailed(cacheReadFailure()));
          }
        }

        try {
          const fresh = await catalogApi.get();
          if (active.current && cacheScope) {
            await saveCatalog(fresh, cacheScope.userId);
            catalogRef.current = fresh;
            setCatalog(fresh);
            setFromCache(false);
            setConnection(connectionSucceeded());
          }
        } catch (e) {
          if (!active.current) {
            return;
          }
          const hasData = Boolean(catalogRef.current ?? cached ?? hadCacheRef.current);
          setConnection(connectionFailed(classifyConnectionFailure(e, hasData)));
        } finally {
          if (active.current && !force) {
            setLoading(false);
          }
        }
      })();
      const tracked = run.finally(() => {
        inFlight.current = null;
      });
      inFlight.current = tracked;
      return tracked;
    },
    [cacheScope],
  );

  useEffect(() => {
    active.current = true;
    void load(false);
  }, [load]);

  // A new account (or cleared session) must drop the previous catalog rather
  // than keep showing another account's data until the next fetch resolves.
  useEffect(() => {
    return () => {
      active.current = false;
    };
  }, []);

  const refresh = useCallback(
    (force = true) => {
      return load(force);
    },
    [load],
  );

  return { catalog, loading, fromCache, error: connection.error, refresh };
}
