import { Navigate } from 'react-router-dom';
import type { User } from '../../types';
import { roleFromToken } from '../../utils/jwtPayload';
import {
  canAccessAdminUI,
  doctorHomePath,
  isDoctorRole,
  isPatientRole,
  patientHomePath,
} from '../../utils/roles';
import { SuperAdminTenantGate } from './SuperAdminTenantGate';

interface StaffRouteProps {
  user: User | null;
  children: React.ReactNode;
}

/** Blocks patients and doctors from admin/staff dashboard routes. */
export function StaffRoute({ user, children }: StaffRouteProps) {
  const role = user?.role ?? roleFromToken(localStorage.getItem('token'));
  if (isPatientRole(role)) {
    return <Navigate to={patientHomePath()} replace />;
  }
  if (isDoctorRole(role) && !canAccessAdminUI(role, user)) {
    return <Navigate to={doctorHomePath()} replace />;
  }
  return <SuperAdminTenantGate user={user}>{children}</SuperAdminTenantGate>;
}
