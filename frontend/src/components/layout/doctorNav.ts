import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock, Home, Receipt, Users } from 'lucide-react';

/** Practice (clinician) nav — used by DoctorSidebar and as fallback in Sidebar for doctor-only users. */
export const DOCTOR_PRACTICE_NAV: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/doctor/home', label: 'Overview', icon: Home },
  { path: '/doctor/patients', label: 'Patients', icon: Users },
  { path: '/doctor/appointments', label: 'Appointments', icon: Calendar },
  { path: '/doctor/availability', label: 'Availability', icon: Clock },
  { path: '/doctor/bills', label: 'Billing', icon: Receipt },
];
