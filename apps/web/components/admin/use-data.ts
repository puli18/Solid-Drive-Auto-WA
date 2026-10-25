/**
 * Tiny data hooks over the repository layer. `useRepo(loader, deps)` loads once, reloads on demand,
 * and (demo mode) reloads whenever the localStorage overlay changes or is reset.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AdminRepository, DEMO_MODE, getAdminRepo, onDemoDataChange } from '@/lib/data';

export interface RepoState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useRepo<T>(loader: ((repo: AdminRepository) => Promise<T>) | null, deps: unknown[]): RepoState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!loader);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const fn = loaderRef.current;
    if (!fn) {
      setLoading(false);
      return;
    }
    const n = ++seq.current;
    try {
      const v = await fn(getAdminRepo());
      if (n === seq.current) {
        setData(v);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError(e);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(!!loaderRef.current);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!DEMO_MODE) return;
    return onDemoDataChange(() => void reload());
  }, [reload]);

  return { data, error, loading, reload };
}
