import { Navigate } from 'react-router-dom';
import type { User } from '../../types';
import { roleFromToken } from '../../utils/jwtPayload';
import { isAdminRole, staffHomePath } from '../../utils/roles';

interface AdminRouteProps {
  user: User | null;
  children: React.ReactNode;
}

/** Only `admin` and `super_admin` may access wrapped routes. */
export function AdminRoute({ user, children }: AdminRouteProps) {
  const role = user?.role ?? roleFromToken(localStorage.getItem('token'));
  if (!isAdminRole(role)) {
    return <Navigate to={staffHomePath()} replace />;
  }
  return <>{children}</>;
}
