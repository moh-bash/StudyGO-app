import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogApi } from '@/lib/api/catalog';
import type { Catalog } from '@/lib/api/catalog';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { getCatalog, saveCatalog } from '@/lib/db/catalog-store';

export interface UseCatalogResult {
  catalog: Catalog | null;
  loading: boolean;
  fromCache: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

export function useCatalog(): UseCatalogResult {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);

  const load = useCallback(async (force = false) => {
    if (loading && !force) {
      // initial; allow initial sequence
    }
    setError(null);
    if (!force) {
      setLoading(true);
    }

    try {
      const cached = await getCatalog();
      if (active.current && cached) {
        setCatalog(cached);
        setFromCache(true);
        if (!force) {
          setLoading(false);
        }
      }

      try {
        const fresh = await catalogApi.get();
        if (active.current) {
          await saveCatalog(fresh);
          setCatalog(fresh);
          setFromCache(false);
          setError(null);
        }
      } catch (e) {
        if (!active.current) {
          return;
        }
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
    } catch (e) {
      if (!active.current) return;
      if (e instanceof Error) setError(e.message);
      else setError('تعذر تحميل البيانات المحلية.');
    } finally {
      if (active.current && !force) {
        setLoading(false);
      }
    }
  }, [loading, catalog]);

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

  return { catalog, loading, fromCache, error, refresh };
}
