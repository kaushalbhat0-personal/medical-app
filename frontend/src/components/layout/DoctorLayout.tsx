import { NavLink, Outlet } from 'react-router-dom';
import {
  Calendar,
  Home,
  Package,
  Receipt,
  Stethoscope,
  UserRound,
  Clock,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DoctorWorkspaceProvider, useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
function DoctorLayoutInner() {
  const { user, logout } = useAuth();
  const { isIndependent, selfDoctor, profilePartial, loading, error } = useDoctorWorkspace();

  const tabs = [
    { to: '/doctor/home', label: 'Overview', icon: Home },
    { to: '/doctor/doctors', label: 'Doctors', icon: Stethoscope },
    { to: '/doctor/patients', label: 'Patients', icon: Users },
    { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
    { to: '/doctor/bills', label: 'Bills', icon: Receipt },
    { to: '/doctor/inventory', label: 'Inventory', icon: Package },
    { to: '/doctor/availability', label: 'Availability', icon: Clock },
  ];

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
              H
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Clinician Portal</p>
              <p className="text-xs text-muted-foreground truncate">
                {isIndependent
                  ? 'Your practice — patients, schedule & billing'
                  : 'Sign in to your organization to manage care in your tenant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-right">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="max-w-[200px]">
                  <p className="text-sm font-medium truncate">{user.full_name || 'Doctor'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                {selfDoctor?.tenant_name && (
                  <Badge variant="secondary" className="max-w-[140px] truncate hidden md:inline-flex" title={selfDoctor.tenant_name}>
                    {selfDoctor.tenant_name}
                  </Badge>
                )}
                {(selfDoctor?.tenant_organization_label || selfDoctor?.tenant_type) && (
                  <Badge
                    variant="outline"
                    className="hidden lg:inline-flex normal-case"
                    title="Organization (derived from doctor count when available)"
                  >
                    {selfDoctor.tenant_organization_label ??
                      selfDoctor.tenant_type?.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Logout
            </Button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-2 sm:px-4 border-t border-border/60">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      {loading && (
        <p className="text-center text-xs text-muted-foreground py-2 border-b border-border/60" aria-live="polite">
          Loading your workspace…
        </p>
      )}
      {error && !loading && (
        <p className="text-center text-sm text-destructive py-2 px-4 border-b border-border/60" role="alert">
          {error}
        </p>
      )}
      {profilePartial && !loading && !error && (
        <p
          className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800 py-2 px-4"
          role="status"
        >
          Your user account is not clearly linked to a single doctor record in this organization. The portal stays in view-only
          mode; ask an administrator to confirm your email on your doctor profile.
        </p>
      )}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export function DoctorLayout() {
  return (
    <DoctorWorkspaceProvider>
      <DoctorLayoutInner />
    </DoctorWorkspaceProvider>
  );
}
