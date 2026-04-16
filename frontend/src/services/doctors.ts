import { api } from './api';

export const doctorsApi = {
  getAll: async () => {
    const response = await api.get('/doctors');
    return response.data;
  },
};
