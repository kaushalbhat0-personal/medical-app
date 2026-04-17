import { useState, useEffect, useCallback, useRef } from 'react';

export function useFetch<T>(
  handler: (...args: any[]) => Promise<T>,
  params?: any
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);      // initial load only
  const [refetching, setRefetching] = useState(false); // background updates
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current params for refetch calls
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchData = useCallback(async (isRefetch = false) => {
    console.log('FETCH CALLED, isRefetch:', isRefetch);
    try {
      setError(null);
      if (isRefetch) {
        setRefetching(true);
      } else {
        setLoading(true);
      }

      const result = await handler(paramsRef.current);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [handler]);

  // Stable dependency - stringify params to avoid object reference issues
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    fetchData(false);
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, refetching, error, refetch: () => fetchData(true) };
}
