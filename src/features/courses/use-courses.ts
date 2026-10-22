/**
 * Catalog data for the Courses/Add-course screens.
 *
 * Phase 3 split the old "courses + selection" hook: the catalog cache stays
 * here, while the private study plan lives in `use-study-plan`. This hook never
 * reads or writes personal data; it only exposes the shared, backend-owned
 * catalog (with its offline cache).
 */
import { useCallback, useMemo, useState } from 'react';
import type { Catalog } from '@/lib/api/catalog';
import { buildOfferings, type SemesterOfferings } from '@/lib/courses/offerings';
import { useCatalog } from './use-catalog';

export interface UseCoursesResult {
  catalog: Catalog | null;
  offerings: SemesterOfferings[];
  loading: boolean;
  refreshing: boolean;
  fromCache: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

export function useCourses(): UseCoursesResult {
  const { catalog, loading, fromCache, error, refresh: refreshCatalog } = useCatalog();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(
    async (force = true) => {
      setRefreshing(true);
      try {
        await refreshCatalog(force);
      } finally {
        setRefreshing(false);
      }
    },
    [refreshCatalog],
  );

  const offerings = useMemo(() => buildOfferings(catalog), [catalog]);

  return { catalog, offerings, loading, refreshing, fromCache, error, refresh };
}
