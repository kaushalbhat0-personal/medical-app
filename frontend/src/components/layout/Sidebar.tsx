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
} from 'lucide-react';
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '../../types';
import { isAdminRole, isPatientRole } from '../../utils/roles';
import { NavItem } from './NavItem';

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

export function Sidebar({ user, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const staffNavItems = useMemo(() => {
    if (!isAdminRole(user?.role)) return staffNavBase;
    const adminItem = { path: '/admin/dashboard', label: 'Admin', icon: BarChart3 };
    return [staffNavBase[0], adminItem, ...staffNavBase.slice(1)];
  }, [user?.role]);

  const navItems = isPatientRole(user?.role) ? patientFallbackNavItems : staffNavItems;
  return (
    <div className="h-screen overflow-hidden bg-surface border-r border-border flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border flex-shrink-0">
        {/* Logo */}
        <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg flex-shrink-0">
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <div className="whitespace-nowrap">
            <h1 className="text-text-primary font-semibold text-sm leading-tight">HMS</h1>
            <p className="text-text-muted text-xs leading-tight">Hospital System</p>
          </div>
        </div>

        {/* Collapsed logo (centered with tooltip) */}
        <div className={`flex items-center justify-center flex-1 transition-all duration-300 ${isCollapsed ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
          <div className="group relative">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-md">
              <span className="text-white text-lg font-bold">HM</span>
            </div>
            {/* Tooltip for brand */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-background text-text-primary text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 top-1/2 -translate-y-1/2 border border-border shadow-lg">
              Hospital Management
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-background" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Collapse toggle - desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 hover:bg-surface-hover rounded-md transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <PanelLeft className={`h-4 w-4 text-text-muted transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-surface-hover rounded-md transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              path={item.path}
              label={item.label}
              icon={item.icon}
              isCollapsed={isCollapsed}
              onNavigate={onClose}
            />
          ))}
        </ul>
      </nav>

      {/* Footer - User info */}
      {user && (
        <div className="border-t border-border p-3 flex-shrink-0">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center text-white text-sm font-medium">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-surface rounded-full"></div>
            </div>

            {/* User details */}
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              <p className="text-sm font-medium text-text-primary truncate max-w-[140px]">
                {user.full_name || user.email || 'User'}
              </p>
              <p className="text-xs text-text-muted capitalize truncate max-w-[140px]">
                {user.role || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="group relative">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background text-text-primary text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-border shadow-lg">
                {user.full_name || user.email || 'User'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-background" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
