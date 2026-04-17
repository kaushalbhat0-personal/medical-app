import { api } from './api';
import { safeArray } from '../utils';
import type { Doctor } from '../types';

export const doctorsApi = {
  getAll: async (params?: { search?: string; skip?: number; limit?: number }): Promise<Doctor[]> => {
    try {
      const response = await api.get('/doctors', { params: { skip: 0, limit: 100, ...params } });
      // Debug log in development
      if (import.meta.env.DEV) {
        console.log('[doctorsApi.getAll] Response:', response.data);
      }
      // Safe array extraction - handles { data: [...] } or direct array
      return safeArray<Doctor>(response.data);
    } catch (error) {
      console.error('[doctorsApi.getAll] Error:', error);
      throw error;
    }
  },
};
