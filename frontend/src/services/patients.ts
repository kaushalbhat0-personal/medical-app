import { api } from './api';
import { safeArray } from '../utils';
import type { Patient } from '../types';

export interface CreatePatientData {
  name: string;
  age: number;
  gender: string;
  phone: string;
}

export const patientsApi = {
  getAll: async (params?: { search?: string; skip?: number; limit?: number }): Promise<Patient[]> => {
    try {
      const response = await api.get('/patients', { params: { skip: 0, limit: 100, ...params } });
      // Debug log in development
      if (import.meta.env.DEV) {
        console.log('[patientsApi.getAll] Response:', response.data);
      }
      // Safe array extraction - handles { data: [...] } or direct array
      return safeArray<Patient>(response.data);
    } catch (error) {
      console.error('[patientsApi.getAll] Error:', error);
      throw error;
    }
  },
  create: async (patient: CreatePatientData): Promise<Patient> => {
    try {
      const response = await api.post('/patients', patient);
      return response.data;
    } catch (error) {
      console.error('[patientsApi.create] Error:', error);
      throw error;
    }
  },
};
