import { useState, useEffect, useCallback } from 'react';

export function useFetch<T>(
  handler: (...args: any[]) => Promise<T>,
  params?: any
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);      // initial load only
  const [refetching, setRefetching] = useState(false); // background updates
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    try {
      setError(null);
      if (isRefetch) {
        setRefetching(true);
      } else {
        setLoading(true);
      }

      const result = await handler(params);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [handler, params]);

  useEffect(() => {
    fetchData(false);
  }, [params]);

  return { data, loading, refetching, error, refetch: () => fetchData(true) };
}
