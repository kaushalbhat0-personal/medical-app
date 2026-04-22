/** Backend sends role enum as lowercase string (e.g. patient, admin, doctor). */
export function isPatientRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'patient';
}

export function isDoctorRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'doctor';
}

/** Admin dashboard and admin-only APIs (admin or super_admin). */
export function isAdminRole(role: string | null | undefined): boolean {
  const r = role?.toLowerCase();
  return r === 'admin' || r === 'super_admin';
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'super_admin';
}

export function staffHomePath(): string {
  return '/dashboard';
}

export function patientHomePath(): string {
  return '/patient/home';
}

export function doctorHomePath(): string {
  return '/doctor/home';
}

/** Default landing path after login or post-registration, by role. */
export function postLoginHomePath(role: string | null | undefined): string {
  if (isPatientRole(role)) return patientHomePath();
  if (isDoctorRole(role)) return doctorHomePath();
  return staffHomePath();
}
