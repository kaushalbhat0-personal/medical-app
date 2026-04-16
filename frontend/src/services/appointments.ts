import { api } from './api';

export interface CreateAppointmentData {
  patient_id: number;
  doctor_id: number;
  scheduled_at: string;
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
  getAll: async (filters?: AppointmentFilters) => {
    const params: Record<string, string | number | undefined> = {
      skip: 0,
      limit: 100,
      ...filters,
    };

    const response = await api.get('/appointments', { params });
    return response.data;
  },
  create: async (appointment: CreateAppointmentData) => {
    const response = await api.post('/appointments', appointment);
    return response.data;
  },
};
