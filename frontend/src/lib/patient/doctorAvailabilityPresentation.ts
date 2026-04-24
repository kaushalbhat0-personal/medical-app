import type { DoctorAvailabilityBadgeTone } from '@/components/patient/DoctorRowCard';
import type { Doctor } from '@/types';

export function doctorAvailabilityPresentation(
  d: Pick<Doctor, 'availability_status' | 'has_availability_windows'>
): { label: string; tone: DoctorAvailabilityBadgeTone } {
  const st = d.availability_status;
  if (st === 'available_today') return { label: 'Available today', tone: 'today' };
  if (st === 'next_available_tomorrow') return { label: 'Next available tomorrow', tone: 'tomorrow' };
  if (d.has_availability_windows === false) return { label: 'Call clinic to book', tone: 'muted' };
  return { label: 'Check availability', tone: 'muted' };
}
