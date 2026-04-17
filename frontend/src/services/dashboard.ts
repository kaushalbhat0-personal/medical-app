import { api } from './api';
import { safeObject } from '../utils';
import type { DashboardStats } from '../types';

/**
 * Dashboard API service
 * Provides methods to fetch dashboard statistics from /api/v1/dashboard
 */
export const dashboardApi = {
  /**
   * Fetch dashboard statistics from the backend
   * Endpoint: GET /api/v1/dashboard
   * Returns null on error - let the hook handle error states
   */
  getStats: async (): Promise<DashboardStats | null> => {
    const response = await api.get('/dashboard');

    // Debug log in development only
    if (import.meta.env.DEV) {
      console.log('[dashboardApi.getStats] Response:', response.data);
    }

    // Safe object extraction - handles both direct object and { data: {...} } wrapper
    const stats = safeObject<DashboardStats>(response.data);

    if (!stats) {
      throw new Error('Invalid dashboard data received from server');
    }

    // Validate required fields are present
    const requiredFields: (keyof DashboardStats)[] = [
      'total_patients',
      'total_doctors',
      'today_appointments',
      'total_revenue',
    ];

    const missingFields = requiredFields.filter((field) => !(field in stats));
    if (missingFields.length > 0) {
      throw new Error(`Missing dashboard fields: ${missingFields.join(', ')}`);
    }

    return stats;
  },
};
