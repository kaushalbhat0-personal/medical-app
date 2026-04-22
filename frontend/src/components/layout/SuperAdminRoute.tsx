import { Navigate } from 'react-router-dom';
import type { User } from '../../types';
import { roleFromToken } from '../../utils/jwtPayload';
import { isSuperAdminRole, staffHomePath } from '../../utils/roles';

interface SuperAdminRouteProps {
  user: User | null;
  children: React.ReactNode;
}

/** Only `super_admin` may access wrapped routes. */
export function SuperAdminRoute({ user, children }: SuperAdminRouteProps) {
  const role = user?.role ?? roleFromToken(localStorage.getItem('token'));
  if (!isSuperAdminRole(role)) {
    return <Navigate to={staffHomePath()} replace />;
  }
  return <>{children}</>;
}
