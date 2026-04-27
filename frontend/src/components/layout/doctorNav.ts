import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock, Home, Receipt, UserRound, Users } from 'lucide-react';

/** Practice (clinician) nav — used by DoctorSidebar and as fallback in Sidebar for doctor-only users. */
export const DOCTOR_PRACTICE_NAV: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/doctor/dashboard', label: 'Overview', icon: Home },
  { path: '/complete-profile', label: 'Profile', icon: UserRound },
  { path: '/doctor/patients', label: 'Patients', icon: Users },
  { path: '/doctor/appointments', label: 'Appointments', icon: Calendar },
  { path: '/doctor/availability', label: 'Availability', icon: Clock },
  { path: '/doctor/bills', label: 'Billing', icon: Receipt },
];
