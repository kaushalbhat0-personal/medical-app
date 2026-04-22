import { api } from './api';

export type OrganizationUserCreatePayload = {
  email: string;
  password: string;
  role: 'admin' | 'staff';
  tenant_id: string;
};

export const usersApi = {
  createOrganizationUser: async (payload: OrganizationUserCreatePayload) => {
    const { data } = await api.post('/users', payload);
    return data as { id: string; email: string; role: string; tenant_id?: string | null };
  },
};
