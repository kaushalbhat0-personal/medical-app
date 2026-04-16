import { api } from './api';

export const doctorsApi = {
  getAll: async (params?: { search?: string; skip?: number; limit?: number }) => {
    const response = await api.get('/doctors', { params: { skip: 0, limit: 100, ...params } });
    return response.data;
  },
};
