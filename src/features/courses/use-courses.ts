import { useCallback, useEffect, useRef, useState } from 'react';
import { getCatalog, saveCatalog } from '@/lib/db/catalog-store';
import { clearSelections, getAllSelections, saveSemesterSelection } from '@/lib/db/selection-store';
import { catalogApi } from '@/lib/api/catalog';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { buildOfferings, SemesterOfferings } from '@/lib/courses/offerings';
import { resolveSelectedCourses, SelectedCourse, CourseSelection } from '@/lib/courses/selection';
import type { Catalog } from '@/lib/api/catalog';

export interface UseCoursesResult {
  catalog: Catalog | null;
  offerings: SemesterOfferings[];
  selections: SelectedCourse[];
  loading: boolean;
  refreshing: boolean;
  fromCache: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  saveSelection: (semesterId: string, subjectIds: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useCourses(): UseCoursesResult {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectionsRaw, setSelectionsRaw] = useState<CourseSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);

  const load = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const cached = await getCatalog();
      if (active.current && cached) {
        setCatalog(cached);
        setFromCache(true);
        if (!force) setLoading(false);
      }

      const sel = await getAllSelections();
      if (active.current) {
        setSelectionsRaw(sel);
      }

      if (force || !cached) {
        try {
          const fresh = await catalogApi.get();
          if (active.current) {
            await saveCatalog(fresh);
            setCatalog(fresh);
            setFromCache(false);
            setError(null);
          }
        } catch (e) {
          if (!active.current) return;
          if (e instanceof NetworkError) {
            if (!catalog && !cached) {
              setError('تعذر الاتصال بالخادم ولم يتم العثور على بيانات محفوظة.');
            } else {
              setError(null);
            }
          } else if (e instanceof ApiError) {
            setError(e.message || 'تعذر تحميل دليل المواد.');
          } else if (e instanceof Error) {
            setError(e.message);
          } else {
            setError('تعذر تحميل دليل المواد.');
          }
        }
      }
    } catch (e) {
      if (!active.current) return;
      if (e instanceof Error) setError(e.message);
      else setError('تعذر تحميل البيانات المحلية.');
    } finally {
      if (!active.current) return;
      if (force) setRefreshing(false);
      else setLoading(false);
    }
  }, [catalog]);

  useEffect(() => {
    active.current = true;
    void (async () => {
      if (!active.current) return;
      await load();
    })();
    return () => {
      active.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(
    (force = true) => {
      return load(force);
    },
    [load],
  );

  const saveSelection = useCallback(async (semesterId: string, subjectIds: string[]) => {
    await saveSemesterSelection(semesterId, subjectIds);
    const sel = await getAllSelections();
    if (active.current) {
      setSelectionsRaw(sel);
    }
  }, []);

  const clearAll = useCallback(async () => {
    await clearSelections();
    if (active.current) {
      setSelectionsRaw([]);
    }
  }, []);

  const offerings = buildOfferings(catalog);
  const selections = resolveSelectedCourses(catalog, selectionsRaw);

  return {
    catalog,
    offerings,
    selections,
    loading,
    refreshing,
    fromCache,
    error,
    refresh,
    saveSelection,
    clearAll,
  };
}
