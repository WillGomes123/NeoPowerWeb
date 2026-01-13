import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../api';

interface UseFetchOptions {
  skip?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  showErrorToast?: boolean;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook customizado para fetch de dados com tratamento de erros padronizado
 * Elimina código duplicado de try-catch em todos os componentes
 */
export function useFetch<T = unknown>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchResult<T> {
  const { skip = false, onSuccess, onError, showErrorToast = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!skip);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (skip) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(url);

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.statusText}`);
      }

      const result = (await response.json()) as T;
      setData(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);

      if (showErrorToast) {
        toast.error(error.message);
      }

      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [url, skip, onSuccess, onError, showErrorToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para mutações (POST, PUT, DELETE)
 */
interface UseMutationResult<T> {
  mutate: (body?: unknown) => Promise<T | null>;
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export function useMutation<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options: { onSuccess?: (data: T) => void; onError?: (error: Error) => void } = {}
): UseMutationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const mutate = useCallback(
    async (body?: unknown): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        let response: Response;

        switch (method) {
          case 'POST':
            response = await api.post(url, body);
            break;
          case 'PUT':
            response = await api.put(url, body);
            break;
          case 'DELETE':
            response = await api.delete(url);
            break;
        }

        if (!response.ok) {
          throw new Error(`Erro na requisição: ${response.statusText}`);
        }

        const result = (await response.json()) as T;
        setData(result);

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Erro desconhecido');
        setError(error);

        if (options.onError) {
          options.onError(error);
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, method, options]
  );

  return { mutate, loading, error, data };
}
