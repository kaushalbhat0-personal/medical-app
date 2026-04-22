import { api } from './api';
import { safeArray } from '../utils';
import type { Tenant } from '../types';

export const tenantsApi = {
  getAll: async (params?: { skip?: number; limit?: number }): Promise<Tenant[]> => {
    const response = await api.get('/tenants', { params: { skip: 0, limit: 100, ...params } });
    if (import.meta.env.DEV) {
      console.log('[tenantsApi.getAll] Response:', response.data);
    }
    return safeArray<Tenant>(response.data);
  },

  getById: async (tenantId: string): Promise<Tenant> => {
    const response = await api.get(`/tenants/${tenantId}`);
    return response.data as Tenant;
  },

  create: async (payload: { name: string; type: 'clinic' | 'hospital' }): Promise<Tenant> => {
    const response = await api.post('/tenants', payload);
    return response.data as Tenant;
  },
};
