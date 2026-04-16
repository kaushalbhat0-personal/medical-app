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
  date_from?: string;
  date_to?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  skip?: number;
  limit?: number;
}

export const appointmentsApi = {
  getAll: async (filters?: AppointmentFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.doctor_id) params.append('doctor_id', filters.doctor_id);
    if (filters?.patient_id) params.append('patient_id', filters.patient_id);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    
    const queryString = params.toString();
    const url = queryString ? `/appointments?${queryString}` : '/appointments';
    
    const response = await api.get(url);
    return response.data;
  },
  create: async (appointment: CreateAppointmentData) => {
    const response = await api.post('/appointments', appointment);
    return response.data;
  },
};
