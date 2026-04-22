import { api } from './api';
import { safeArray } from '../utils';
import type { PublicTenantDiscovery, PublicTenantDoctorBrief } from '../types';

export const publicDiscoveryApi = {
  listTenants: async (): Promise<PublicTenantDiscovery[]> => {
    const response = await api.get('/public/tenants');
    return safeArray<PublicTenantDiscovery>(response.data);
  },

  listTenantDoctors: async (tenantId: string): Promise<PublicTenantDoctorBrief[]> => {
    const response = await api.get(`/public/tenants/${tenantId}/doctors`);
    return safeArray<PublicTenantDoctorBrief>(response.data);
  },
};
