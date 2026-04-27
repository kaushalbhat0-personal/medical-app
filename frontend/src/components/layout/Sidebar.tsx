import {
  X,
  PanelLeft,
  LayoutDashboard,
  BarChart3,
  Users,
  Stethoscope,
  Calendar,
  CreditCard,
  Home,
  Receipt,
  Package,
  Building2,
} from 'lucide-react';
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '../../types';
import { canAccessAdminUI, getEffectiveRoles, isPatientRole, isSuperAdminRole, normalizeRoles } from '../../utils/roles';
import { doctorNavItemHint, isDoctorNavItemVisible } from '../../utils/doctorVerification';
import { useAppMode } from '../../contexts/AppModeContext';
import { NavItem } from './NavItem';
import { DOCTOR_PRACTICE_NAV } from './doctorNav';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: User | null;
  onClose?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const staffNavBase: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/billing', label: 'Billing', icon: CreditCard },
];

const patientFallbackNavItems = [
  { path: '/patient/home', label: 'Home', icon: Home },
  { path: '/patient/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/patient/appointments', label: 'Appointments', icon: Calendar },
  { path: '/patient/bills', label: 'Bills', icon: Receipt },
];

const adminModeNavBase: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/admin/inventory', label: 'Inventory', icon: Package },
  { path: '/dashboard', label: 'Reports', icon: BarChart3 },
  { path: '/billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar({ user, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { resolvedMode } = useAppMode();
  const effRoles = getEffectiveRoles(user, localStorage.getItem('token'));
  const roles = normalizeRoles(effRoles);
  const isDoctorOnly =
    roles.includes('doctor') && !roles.includes('admin') && !roles.includes('super_admin');
  const useAdminModeLayout =
    canAccessAdminUI(effRoles) &&
    resolvedMode === 'admin' &&
    !isPatientRole(effRoles) &&
    !isDoctorOnly;

  const staffNavItems = useMemo(() => {
    if (!canAccessAdminUI(effRoles)) return staffNavBase;
    const adminItem = { path: '/admin/dashboard', label: 'Admin', icon: BarChart3 };
    const tenantsItem = { path: '/admin/tenants', label: 'Tenants', icon: Building2 };
    const inventoryItem = { path: '/admin/inventory', label: 'Inventory', icon: Package };
    const mid = isSuperAdminRole(effRoles)
      ? [adminItem, tenantsItem, inventoryItem]
      : [adminItem, inventoryItem];
    return [staffNavBase[0], ...mid, ...staffNavBase.slice(1)];
  }, [effRoles]);

  const adminModeItems = useMemo(() => {
    if (!isSuperAdminRole(effRoles)) {
      return adminModeNavBase;
    }
    const tenantsItem = { path: '/admin/tenants', label: 'Tenants', icon: Building2 };
    return [adminModeNavBase[0], tenantsItem, ...adminModeNavBase.slice(1)];
  }, [effRoles]);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const doctorNavFiltered = useMemo(
    () => DOCTOR_PRACTICE_NAV.filter((item) => isDoctorNavItemVisible(user, token, item.path)),
    [user, token]
  );

  const navItems = isPatientRole(effRoles)
    ? patientFallbackNavItems
    : isDoctorOnly
      ? doctorNavFiltered
      : useAdminModeLayout
        ? adminModeItems
        : staffNavItems;
  return (
    <div
      className={cn(
        'flex h-full min-h-screen w-full flex-col border-r border-border/80 bg-white',
        useAdminModeLayout && 'border-slate-200/80 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-950/50'
      )}
    >
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border/80 px-3">
        <div
          className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            C
          </div>
          <div className="whitespace-nowrap">
            <h1 className="text-sm font-semibold leading-tight text-foreground">CareOS</h1>
            <p className="text-xs leading-tight text-muted-foreground">Operations</p>
          </div>
        </div>

        <div
          className={`flex flex-1 items-center justify-center transition-all duration-300 ${
            isCollapsed ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'
          }`}
        >
          <div className="group relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-sm">
              C
            </div>
            <div className="invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
              CareOS
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            type="button"
          >
            <PanelLeft
              className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label="Close menu"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              path={item.path}
              label={item.label}
              icon={item.icon}
              isCollapsed={isCollapsed}
              onNavigate={onClose}
              title={isDoctorOnly ? doctorNavItemHint(user, item.path) : undefined}
            />
          ))}
        </ul>
      </nav>

      {/* Footer - User info */}
      {user && (
        <div className="flex-shrink-0 border-t border-border/80 p-3">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="relative flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-success" />
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              }`}
            >
              <p className="max-w-[140px] truncate text-sm font-medium text-foreground">
                {user.full_name || user.email || 'User'}
              </p>
              <p className="max-w-[140px] truncate text-xs capitalize text-muted-foreground">
                {effRoles.length ? effRoles.join(', ') : 'Unknown'}
              </p>
            </div>
          </div>

          {isCollapsed && (
            <div className="group relative">
              <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                {user.full_name || user.email || 'User'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
