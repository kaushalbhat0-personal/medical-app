import { Navigate } from 'react-router-dom';
import type { User } from '../../types';
import { roleFromToken } from '../../utils/jwtPayload';
import { isDoctorRole, isPatientRole, patientHomePath, staffHomePath } from '../../utils/roles';

interface DoctorRouteProps {
  user: User | null;
  children: React.ReactNode;
}

/** Clinician shell; patients and staff are redirected to their own areas. */
export function DoctorRoute({ user, children }: DoctorRouteProps) {
  const role = user?.role ?? roleFromToken(localStorage.getItem('token'));
  if (isDoctorRole(role)) {
    return <>{children}</>;
  }
  if (isPatientRole(role)) {
    return <Navigate to={patientHomePath()} replace />;
  }
  return <Navigate to={staffHomePath()} replace />;
}
