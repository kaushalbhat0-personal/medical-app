import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '../services';
import type {
  AdminDashboardMetrics,
  AdminDoctorPerformanceRow,
  AdminRevenueTrendItem,
} from '../types';

export interface UseAdminDashboardResult {
  metrics: AdminDashboardMetrics | null;
  revenueTrend: AdminRevenueTrendItem[];
  /** Sorted by total_revenue descending */
  doctorPerformance: AdminDoctorPerformanceRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function normalizeError(err: unknown): string {
  if (err && typeof err === 'object' && 'detail' in err) {
    const d = (err as { detail?: unknown }).detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'msg' in d[0]) {
      return String((d[0] as { msg: string }).msg);
    }
  }
  if (err instanceof Error) return err.message;
  return 'Failed to load admin dashboard';
}

/**
 * Fetches admin metrics, 7-day revenue trend, and doctor performance in parallel.
 */
export function useAdminDashboard(): UseAdminDashboardResult {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<AdminRevenueTrendItem[]>([]);
  const [doctorPerformance, setDoctorPerformance] = useState<AdminDoctorPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [m, trend, doctors] = await Promise.all([
        dashboardApi.getAdminMetrics(),
        dashboardApi.getAdminRevenueTrend(),
        dashboardApi.getAdminDoctorPerformance(),
      ]);
      setMetrics(m);
      setRevenueTrend(trend);
      const sorted = [...doctors].sort((a, b) => b.total_revenue - a.total_revenue);
      setDoctorPerformance(sorted);
    } catch (err) {
      setMetrics(null);
      setRevenueTrend([]);
      setDoctorPerformance([]);
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    metrics,
    revenueTrend,
    doctorPerformance,
    loading,
    error,
    refetch: load,
  };
}
