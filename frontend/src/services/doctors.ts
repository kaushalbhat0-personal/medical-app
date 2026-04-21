import { api } from './api';
import { safeArray } from '../utils';
import type { Doctor } from '../types';

export interface DoctorSlot {
  start: string;
  available: boolean;
}

export interface CreateDoctorData {
  name: string;
  specialty?: string;
  specialization?: string;
  license_number?: string;
  experience_years?: number;
  account_email: string;
  account_password: string;
}

export const doctorsApi = {
  getSlots: async (
    doctorId: string,
    date: string,
    options?: { signal?: AbortSignal }
  ): Promise<DoctorSlot[]> => {
    try {
      const response = await api.get(`/doctors/${doctorId}/slots`, {
        params: { date },
        signal: options?.signal,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('[doctorsApi.getSlots] Error:', error);
      throw error;
    }
  },
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
  create: async (doctor: CreateDoctorData): Promise<Doctor> => {
    try {
      const response = await api.post('/doctors', doctor);
      return response.data;
    } catch (error) {
      console.error('[doctorsApi.create] Error:', error);
      throw error;
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/doctors/${id}`);
    } catch (error) {
      console.error('[doctorsApi.delete] Error:', error);
      throw error;
    }
  },
};
