import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';

interface UseQueryOptions {
  /** Show toast on error */
  showError?: boolean;
  /** Don't fetch on mount */
  manual?: boolean;
}

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic data fetching hook. Eliminates the repeated
 * setLoading/try/catch/setData/finally pattern from every page.
 */
export function useQuery<T>(
  endpoint: string | null,
  opts: UseQueryOptions = {}
): UseQueryResult<T> {
  const { showError = true, manual = false } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!manual);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mountedRef.current) setData(json);
    } catch (err: any) {
      const msg = err.message || 'Erro ao buscar dados';
      if (mountedRef.current) setError(msg);
      if (showError) toast.error(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [endpoint, showError]);

  useEffect(() => {
    mountedRef.current = true;
    if (!manual) void fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData, manual]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Mutation hook for POST/PUT/DELETE operations.
 */
export function useMutation<TInput = unknown, TOutput = unknown>(
  method: 'post' | 'put' | 'delete',
  endpoint: string
) {
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(async (body?: TInput): Promise<{ ok: boolean; data?: TOutput; error?: string }> => {
    setLoading(true);
    try {
      const res = await api[method](endpoint, body);
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
      return { ok: true, data: json as TOutput };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, [method, endpoint]);

  return { mutate, loading };
}
