import { dashboardApi } from '../services';
import type { DashboardStats } from '../types';

export const fetchDashboardStatsHandler = async (): Promise<DashboardStats | null> => {
  return await dashboardApi.getStats();
};
