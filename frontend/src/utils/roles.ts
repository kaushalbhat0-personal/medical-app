/** Backend sends role enum as lowercase string (e.g. patient, admin, doctor). */
export function isPatientRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'patient';
}

export function isDoctorRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'doctor';
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
