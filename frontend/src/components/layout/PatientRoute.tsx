import { Navigate } from 'react-router-dom';
import type { User } from '../../types';
import { roleFromToken } from '../../utils/jwtPayload';
import { doctorHomePath, isDoctorRole, isPatientRole, staffHomePath } from '../../utils/roles';

interface PatientRouteProps {
  user: User | null;
  children: React.ReactNode;
}

/** Patient-only shell; doctors and staff are sent to their dashboards. */
export function PatientRoute({ user, children }: PatientRouteProps) {
  const role = user?.role ?? roleFromToken(localStorage.getItem('token'));
  if (isPatientRole(role)) {
    return <>{children}</>;
  }
  if (isDoctorRole(role)) {
    return <Navigate to={doctorHomePath()} replace />;
  }
  return <Navigate to={staffHomePath()} replace />;
}
