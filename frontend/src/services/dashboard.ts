import { api } from './api';
import { safeObject } from '../utils';
import type { DashboardStats } from '../types';

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats | null> => {
    try {
      const response = await api.get('/dashboard/stats');
      // Debug log in development
      if (import.meta.env.DEV) {
        console.log('[dashboardApi.getStats] Response:', response.data);
      }
      // Safe object extraction
      const stats = safeObject<DashboardStats>(response.data);
      // Provide default values if data is missing
      return stats || {
        total_patients: 0,
        total_doctors: 0,
        today_appointments: 0,
        total_revenue: 0,
      };
    } catch (error) {
      console.error('[dashboardApi.getStats] Error:', error);
      throw error;
    }
  },
};
