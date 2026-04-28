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
  /** `past` = completed/cancelled or overdue scheduled; `upcoming` = future scheduled. */
  type?: 'past' | 'upcoming';
  skip?: number;
  limit?: number;
}

export const appointmentsApi = {
  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get<Appointment>(`/appointments/${id}`);
    return response.data;
  },
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
  update: async (
    id: string,
    payload: Partial<{
      status: 'scheduled' | 'completed' | 'cancelled';
      patient_id: string;
      doctor_id: string;
      appointment_time: string;
    }>
  ): Promise<Appointment> => {
    const response = await api.put(`/appointments/${id}`, payload);
    return response.data;
  },
  markCompleted: async (
    id: string,
    payload?: {
      completion_notes?: string | null;
      items?: { item_id: string; quantity: number }[];
    },
    options?: { idempotencyKey?: string }
  ): Promise<Appointment> => {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const response = await api.post<Appointment>(`/appointments/${id}/mark-completed`, payload ?? {}, {
      headers,
    });
    return response.data;
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
