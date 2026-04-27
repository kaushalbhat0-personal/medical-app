import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Stethoscope, Calendar, Receipt, HeartPulse } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PatientSearchCombobox } from '../patient/PatientSearchCombobox';

const tabs = [
  { to: '/patient/home', label: 'Home', icon: Home },
  { to: '/patient/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
  { to: '/patient/bills', label: 'Bills', icon: Receipt },
] as const;

export function PatientLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const hideHeaderSearch = pathname === '/patient/home';

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 shadow-sm shadow-black/[0.03] backdrop-blur-md">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                  <HeartPulse className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Care</p>
                  <p className="truncate text-xs text-muted-foreground">Find doctors &amp; book visits</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:hidden">
                {user && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Log out
                </Button>
              </div>
            </div>

            {!hideHeaderSearch && <PatientSearchCombobox className="w-full min-w-0 flex-1" />}

            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="hidden text-right sm:block">
                  <p className="max-w-[160px] truncate text-sm font-medium">
                    {user.full_name || 'Patient'}
                  </p>
                  <p className="max-w-[160px] truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary sm:flex">
                  {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  Log out
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-muted/30">
          <nav className="mx-auto w-full min-w-0 max-w-md px-4 pb-2 pt-1">
            <div className="flex w-full min-w-0 gap-1 overflow-x-auto overflow-y-hidden no-scrollbar [scrollbar-width:none] sm:inline-flex sm:rounded-full sm:bg-white sm:p-1 sm:ring-1 sm:ring-border/80">
              {tabs.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  state={to === '/patient/doctors' ? { browseAllDoctors: true } : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm sm:shadow-sm'
                        : 'text-muted-foreground hover:bg-white hover:text-foreground sm:hover:shadow-sm'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-md flex-1 px-4 py-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
