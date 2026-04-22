import { api } from './api';
import { safeArray } from '../utils';
import type { Appointment } from '../types';

export interface CreateAppointmentData {
  patient_id: string;
  doctor_id: string;
  appointment_time: string;
  notes?: string;
}

export interface AppointmentFilters {
  doctor_id?: string;
  patient_id?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'pending';
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
  create: async (
    appointment: CreateAppointmentData,
    options?: { idempotencyKey?: string; signal?: AbortSignal }
  ): Promise<{ appointment: Appointment; idempotentReplay: boolean }> => {
    try {
      const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID();
      const response = await api.post('/appointments', appointment, {
        headers: { 'Idempotency-Key': idempotencyKey },
        signal: options?.signal,
      });
      const idempotentReplay = String(
        (response.headers as { 'x-idempotent-replay'?: string })['x-idempotent-replay'] ?? ''
      ) === '1';
      return { appointment: response.data, idempotentReplay };
    } catch (error) {
      console.error('[appointmentsApi.create] Error:', error);
      throw error;
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/appointments/${id}`);
    } catch (error) {
      console.error('[appointmentsApi.delete] Error:', error);
      throw error;
    }
  },
};
