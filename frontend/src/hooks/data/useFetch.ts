import { useState, useEffect, useCallback, useRef } from 'react';
import { BOOKING_DATA_REFRESH_EVENT } from '../../constants/booking';
import { APP_MODE_CHANGE_EVENT } from '../../constants/appMode';
import { TENANT_ID_STORAGE_EVENT } from '../../utils/tenantIdForRequest';

/**
 * Generic data fetching hook with loading and error states
 * Prevents infinite re-renders by using refs for handler and params
 */
export function useFetch<T>(
  handler: (...args: any[]) => Promise<T>,
  params?: any,
  /** If set, logs when BOOKING_DATA_REFRESH_EVENT triggers a refetch (dev/debug). */
  bookingRefreshLog?: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to prevent unnecessary re-renders and stale closures
  const handlerRef = useRef(handler);
  const paramsRef = useRef(params);

  // Keep refs current
  handlerRef.current = handler;
  paramsRef.current = params;

  const fetchData = useCallback(async (isRefetch = false) => {
    // Debug logging in development only
    if (import.meta.env.DEV) {
      console.log('[useFetch] Fetching, isRefetch:', isRefetch);
    }

    try {
      setError(null);
      if (isRefetch) {
        setRefetching(true);
      } else {
        setLoading(true);
      }

      const result = await handlerRef.current(paramsRef.current);
      setData(result);
    } catch (err: any) {
      const errorMessage = err?.message || err?.detail || 'Something went wrong';
      setError(errorMessage);
      // Preserve null data on error - don't fallback to empty defaults
      setData(null);
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, []); // No dependencies - uses refs for everything

  // Stable dependency key for params comparison
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    fetchData(false);
  }, [fetchData, paramsKey]);

  useEffect(() => {
    const onTenantScopeChange = () => {
      void fetchData(true);
    };
    window.addEventListener(TENANT_ID_STORAGE_EVENT, onTenantScopeChange);
    return () => window.removeEventListener(TENANT_ID_STORAGE_EVENT, onTenantScopeChange);
  }, [fetchData]);

  useEffect(() => {
    const onAppModeChange = () => {
      void fetchData(true);
    };
    window.addEventListener(APP_MODE_CHANGE_EVENT, onAppModeChange);
    return () => window.removeEventListener(APP_MODE_CHANGE_EVENT, onAppModeChange);
  }, [fetchData]);

  useEffect(() => {
    const onBookingRefresh = () => {
      if (bookingRefreshLog) {
        console.log(`[REFETCH_TRIGGERED] ${bookingRefreshLog}`);
      }
      void fetchData(true);
    };
    window.addEventListener(BOOKING_DATA_REFRESH_EVENT, onBookingRefresh);
    return () => window.removeEventListener(BOOKING_DATA_REFRESH_EVENT, onBookingRefresh);
  }, [fetchData, bookingRefreshLog]);

  return { data, loading, refetching, error, refetch: () => fetchData(true) };
}
