/** Nested tenant on GET /me — source of truth for individual vs organization UI mode. */
export interface MeTenantBrief {
  id: string;
  type: 'individual' | 'organization' | string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  /** Effective roles: account role plus `doctor` when a doctor profile is linked (from API / JWT). */
  roles: string[];
  /** Practice owner: solo doctor who created the tenant; admin-equivalent in UI/API */
  is_owner?: boolean;
  /** Primary tenant from login / JWT when applicable */
  tenant_id?: string | null;
  /** Linked doctor row (GET /me); use for doctor-scoped UI and params. */
  doctor_id?: string | null;
  /** False until mandatory `doctor_profiles` fields are saved; null if not a doctor login. */
  doctor_profile_complete?: boolean | null;
  /** From backend verification workflow (display-only badge). */
  doctor_verification_status?: string | null;
  /** When verification is rejected, admin may include a reason (GET /me). */
  doctor_verification_rejection_reason?: string | null;
  /** From GET /me after sync — use ``type`` for practice vs org mode (not roles/localStorage). */
  tenant?: MeTenantBrief | null;
  /** When true, client must complete password reset before using the app */
  force_password_reset?: boolean;
}

/** GET /me — `UserRead` from the API */
export interface MeUserResponse {
  id: string;
  email: string;
  role: string;
  roles: string[];
  is_active: boolean;
  is_owner: boolean;
  tenant_id: string | null;
  doctor_id: string | null;
  doctor_profile_complete?: boolean | null;
  doctor_verification_status?: string | null;
  doctor_verification_rejection_reason?: string | null;
  tenant: MeTenantBrief | null;
  created_at: string;
  updated_at: string;
}

/** GET/PUT /doctor/profile */
export interface DoctorStructuredProfile {
  id: string;
  doctor_id: string;
  full_name: string;
  specialization: string | null;
  experience_years: number | null;
  qualification: string | null;
  registration_number: string | null;
  registration_council: string | null;
  clinic_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  profile_image: string | null;
  is_profile_complete: boolean;
  verification_status: string;
  verification_rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /public/tenants — marketplace tenant with doctor count */
export interface PublicTenantDiscovery {
  id: string;
  name: string;
  doctor_count: number;
  type: string;
  /** Derived: "Clinic/Hospital" vs "Individual Doctor" from active doctor count */
  organization_label: string;
  sole_doctor: PublicTenantDoctorBrief | null;
}

/** GET /public/tenants/{id}/doctors */
export interface PublicTenantDoctorBrief {
  id: string;
  name: string;
  specialization: string;
  availability_status: string;
  next_available_slot: string | null;
  available_today: boolean;
  rating_average: number;
  review_count: number;
  distance_km: number;
  slots_today_count?: number;
  slots_tomorrow_count?: number;
  metrics_are_synthetic?: boolean;
}

/** GET /public/doctors/{id} — approved marketplace profile only (404 otherwise) */
export interface PublicDoctorProfile {
  id: string;
  full_name: string;
  specialization: string;
  experience: number;
  qualification: string | null;
  clinic_name: string | null;
  address: string | null;
  city: string | null;
  profile_image: string | null;
  verified: boolean;
  verification_status: string;
  timezone: string;
  has_availability_windows: boolean;
  /** Earliest bookable slot (UTC) from public profile — avoids an extra schedule call for the headline */
  next_available_slot?: string | null;
  available_today: boolean;
  rating_average: number;
  review_count: number;
  /** Illustrative distance until real geolocation */
  distance_km: number;
  slots_today_count?: number;
  slots_tomorrow_count?: number;
  /** When true, show ratings/distance/patient volume as illustrative — not verified facts */
  metrics_are_synthetic?: boolean;
}

/** GET /patients/me/doctors */
export interface PatientMyDoctor {
  id: string;
  name: string;
  specialization: string;
  tenant_id: string;
}

export interface Tenant {
  id: string;
  name: string;
  /** URL-safe tenant key when set (e.g. apollo-hospital-pune) */
  slug?: string | null;
  type: string;
  is_active: boolean;
  /** Super-admin soft-delete; deactivated orgs are hidden from lists and API scope by default */
  is_deleted?: boolean;
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
  /** Doctor-facing notes (from API); persisted per patient. */
  clinical_notes?: string | null;
  created_by?: number | string;
  created_at?: string;
  updated_at?: string;
  /** Set on GET /patients for tenant (admin) and doctor list when the backend can resolve a label. */
  doctor_name?: string | null;
}

/** Weekly availability pattern from GET /doctors/{id}/availability-windows */
export interface DoctorAvailabilityWindow {
  id: string;
  doctor_id: string;
  /** Monday = 0 … Sunday = 6 (server convention) */
  day_of_week: number;
  /** "HH:MM:SS" */
  start_time: string;
  end_time: string;
  slot_duration: number;
  tenant_id: string;
  created_at: string;
}

/** Calendar time off (full day or partial) from GET /doctors/{id}/time-off */
export interface DoctorTimeOff {
  id: string;
  doctor_id: string;
  /** YYYY-MM-DD */
  off_date: string;
  start_time: string | null;
  end_time: string | null;
  tenant_id: string;
  created_at: string;
}

export interface Doctor {
  id: number | string;
  // Backend returns flat structure, not nested user
  name?: string;
  /** Linked login user (promote to admin) */
  user_id?: string | number;
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
  /** Linked user's role (admin vs doctor) for badges and promote UI */
  linked_user_role?: string | null;
  /** From GET /doctors (DoctorRead); tenant type label for the UI. */
  tenant_type?: string | null;
  /** Derived from active doctor count in tenant; complements tenant_type. */
  tenant_organization_label?: string | null;
  tenant_name?: string | null;
  tenant_id?: string | null;
  /** From GET /doctors when include_availability_hint=true */
  availability_status?: 'available_today' | 'next_available_tomorrow' | 'none' | string | null;
  /** Set on public tenant doctor list (and profile) for filters and row sublabels */
  available_today?: boolean;
  next_available_slot?: string | null;
  rating_average?: number;
  review_count?: number;
  distance_km?: number;
  slots_today_count?: number;
  slots_tomorrow_count?: number;
  metrics_are_synthetic?: boolean;
  /** Marketplace verification on structured profile (patient trust / discovery). */
  verification_status?: string | null;
  /** From GET /doctors when structured profile is approved. */
  verified?: boolean;
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
  /** Primary account role (legacy; prefer `roles`). */
  role?: string;
  roles?: string[];
  tenant_id?: string | null;
  /** Linked doctor profile id (same as JWT claim when present). */
  doctor_id?: string | null;
  doctor_profile_complete?: boolean | null;
  is_owner?: boolean;
  user?: User;
  force_password_reset?: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  roles?: string[];
  is_owner?: boolean;
  forcePasswordReset?: boolean;
  doctor_id?: string | null;
  doctor_profile_complete?: boolean | null;
}

export interface RegisterResponseUser {
  id: string;
  email: string;
  role: string;
  roles?: string[];
  is_active: boolean;
  is_owner?: boolean;
  full_name?: string;
  tenant_id?: string | null;
  doctor_id?: string | null;
  doctor_profile_complete?: boolean | null;
  doctor_verification_status?: string | null;
  doctor_verification_rejection_reason?: string | null;
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
      signup_type: 'patient';
      patient_profile: PatientProfileSignup;
    }
  | {
      email: string;
      password: string;
      role: 'doctor';
      signup_type: 'doctor';
      doctor_profile: DoctorProfileSignup;
    }
  | {
      email: string;
      password: string;
      role: 'admin';
      signup_type: 'hospital';
      organization_name: string;
      doctor_profile: DoctorProfileSignup;
    };

export interface DashboardStats {
  total_patients: number;
  total_doctors: number;
  today_appointments: number;
  total_revenue: number;
}

/** GET /api/v1/admin/dashboard/metrics */
export interface AdminDashboardMetrics {
  total_revenue: number;
  revenue_today: number;
  appointments_today: number;
  completed_appointments: number;
  pending_bills: number;
}

/** GET /api/v1/admin/dashboard/revenue-trend — one point per day (7 days) */
export interface AdminRevenueTrendItem {
  date: string;
  revenue: number;
}

/** GET /api/v1/admin/dashboard/doctor-performance */
export interface AdminDoctorPerformanceRow {
  doctor_id: string;
  doctor_name: string;
  appointments_count: number;
  completed_appointments: number;
  total_revenue: number;
}

export interface HealthNewsItem {
  id: number;
  title: string;
  description: string;
  category: string;
  published_at: string;
}
