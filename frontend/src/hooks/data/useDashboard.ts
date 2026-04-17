import { useFetch } from './useFetch';
import { fetchDashboardStatsHandler } from '../../handlers';
import { safeObject } from '../../utils';
import type { DashboardStats } from '../../types';

export function useDashboard() {
  const { data, loading, error, refetch } = useFetch(fetchDashboardStatsHandler);

  const safeStats: DashboardStats = {
    total_patients: 0,
    total_doctors: 0,
    today_appointments: 0,
    total_revenue: 0,
    ...safeObject<DashboardStats>(data),
  };

  return {
    stats: safeStats,
    loading,
    error,
    refetch,
  };
}
