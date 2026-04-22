export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  role: string;
  /** Primary tenant from login / JWT when applicable */
  tenant_id?: string | null;
  /** When true, client must complete password reset before using the app */
  force_password_reset?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  /** URL-safe tenant key when set (e.g. apollo-hospital-pune) */
  slug?: string | null;
  type: string;
  is_active: boolean;
  /** Shown for tenants that have contact info (may be null for legacy rows) */
  address?: string | null;
  phone?: string | null;
  created_at: string;
  /** Present on POST /tenants create response (initial admin login email, normalized) */
  admin_email?: string | null;
}

export interface Patient {
  id: number | string;
  /** When present on GET /patients, matches the authenticated user. */
  user_id?: string | number;
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
  /** IANA timezone for the doctor's schedule (e.g. Asia/Kolkata) */
  timezone?: string;
  /** True when the doctor has at least one weekly availability window */
  has_availability_windows?: boolean;
  /** Login email for the linked user account (admin-created doctors) */
  linked_user_email?: string | null;
}

export interface Appointment {
  id: number | string;
  patient_id: number | string;
  doctor_id: number | string;
  // Backend returns 'appointment_time', frontend form uses 'scheduled_at'
  appointment_time?: string;
  scheduled_at?: string;
  /** `pending` is client-only until refetch replaces with server status. */
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending';
  notes?: string;
  // Backend returns flat structure, no nested objects
  patient?: Patient;
  doctor?: Doctor;
  created_by?: number | string;
  created_at?: string;
}

export interface Bill {
  id: string;
  patient_id: string;
  appointment_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  description?: string;
  due_date?: string;
  paid_at?: string;
  payment_id?: string;
  payment_method?: string;
  patient?: Patient;
  created_at: string;
  updated_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  /** Present on OAuth login response */
  role?: string;
  tenant_id?: string | null;
  user?: User;
  force_password_reset?: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
  forcePasswordReset?: boolean;
}

export interface RegisterResponseUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  full_name?: string;
}

export interface RegisterResponse {
  access_token: string;
  token_type: string;
  user: RegisterResponseUser;
}

export interface PatientProfileSignup {
  name: string;
  age: number;
  gender: string;
  phone: string;
}

export interface DoctorProfileSignup {
  name: string;
  specialization: string;
  experience_years: number;
}

export type RegisterPayload =
  | {
      email: string;
      password: string;
      role: 'patient';
      patient_profile: PatientProfileSignup;
    }
  | {
      email: string;
      password: string;
      role: 'doctor';
      doctor_profile: DoctorProfileSignup;
    };

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
