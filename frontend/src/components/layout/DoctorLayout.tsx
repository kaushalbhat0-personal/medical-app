import { NavLink, Outlet } from 'react-router-dom';
import {
  Calendar,
  Home,
  Receipt,
  Stethoscope,
  UserRound,
  Clock,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const tabs = [
  { to: '/doctor/home', label: 'Overview', icon: Home },
  { to: '/doctor/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
  { to: '/doctor/bills', label: 'Bills', icon: Receipt },
  { to: '/doctor/availability', label: 'Availability', icon: Clock },
];

export function DoctorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
              H
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Clinician Portal</p>
              <p className="text-xs text-muted-foreground truncate">Your schedule, patients & billing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-right">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="max-w-[160px]">
                  <p className="text-sm font-medium truncate">{user.full_name || 'Doctor'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
