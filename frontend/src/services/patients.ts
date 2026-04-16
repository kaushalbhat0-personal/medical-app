import { api } from './api';

export interface CreatePatientData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  medical_history?: string;
}

export const patientsApi = {
  getAll: async (params?: { search?: string; skip?: number; limit?: number }) => {
    const response = await api.get('/patients', { params });
    return response.data;
  },
  create: async (patient: CreatePatientData) => {
    const response = await api.post('/patients', patient);
    return response.data;
  },
};
