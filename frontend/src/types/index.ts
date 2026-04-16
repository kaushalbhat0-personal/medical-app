export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  role: string;
}

export interface Patient {
  id: number | string;
  // Backend returns 'name', not first_name/last_name
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  // Backend returns 'age' instead of date_of_birth
  age?: number;
  gender?: string;
  medical_history?: string;
  created_by?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface Doctor {
  id: number | string;
  // Backend returns flat structure, not nested user
  name?: string;
  user_id?: number;
  user?: User;
  specialty?: string;
  specialization?: string;
  license_number?: string;
  experience_years?: number;
  created_at?: string;
}

export interface Appointment {
  id: number | string;
  patient_id: number | string;
  doctor_id: number | string;
  // Backend returns 'appointment_time', frontend form uses 'scheduled_at'
  appointment_time?: string;
  scheduled_at?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  // Backend returns flat structure, no nested objects
  patient?: Patient;
  doctor?: Doctor;
  created_by?: number | string;
  created_at?: string;
}

export interface Bill {
  id: number;
  patient_id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  description: string;
  due_date: string;
  patient: Patient;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DashboardStats {
  total_patients: number;
  total_doctors: number;
  today_appointments: number;
  total_revenue: number;
}

export interface HealthNewsItem {
  id: number;
  title: string;
  description: string;
  category: string;
  published_at: string;
}
