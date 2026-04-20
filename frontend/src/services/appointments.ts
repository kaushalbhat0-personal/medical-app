import { api } from './api';
import { safeArray } from '../utils';
import type { Appointment } from '../types';

export interface CreateAppointmentData {
  patient_id: number;
  doctor_id: number;
  appointment_time: string;
  notes?: string;
}

export interface AppointmentFilters {
  doctor_id?: string;
  patient_id?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  skip?: number;
  limit?: number;
}

export const appointmentsApi = {
  getAll: async (filters?: AppointmentFilters): Promise<Appointment[]> => {
    try {
      const params: Record<string, string | number | undefined> = {
        skip: 0,
        limit: 100,
        ...filters,
      };

      const response = await api.get('/appointments', { params });
      // Debug log in development
      if (import.meta.env.DEV) {
        console.log('[appointmentsApi.getAll] Response:', response.data);
      }
      // Safe array extraction - handles { data: [...] } or direct array
      return safeArray<Appointment>(response.data);
    } catch (error) {
      console.error('[appointmentsApi.getAll] Error:', error);
      throw error;
    }
  },
  create: async (appointment: CreateAppointmentData) => {
    const response = await api.post('/appointments', appointment);
    return response.data;
  },
};
