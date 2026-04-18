import { X, PanelLeft, LayoutDashboard, Users, Stethoscope, Calendar, CreditCard } from 'lucide-react';
import type { User } from '../../types';
import { NavItem } from './NavItem';

interface SidebarProps {
  user: User | null;
  onClose?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar({ user, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  return (
    <div className="h-screen overflow-hidden bg-white border-r border-gray-200 flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 flex-shrink-0">
        {/* Logo */}
        <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0">
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <div className="whitespace-nowrap">
            <h1 className="text-gray-900 font-semibold text-sm leading-tight">HMS</h1>
            <p className="text-gray-500 text-xs leading-tight">Hospital System</p>
          </div>
        </div>

        {/* Collapsed logo (icon only) */}
        <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
            <span className="text-white text-sm font-bold">H</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Collapse toggle - desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <PanelLeft className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-500" />
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
        <div className="border-t border-gray-100 p-3 flex-shrink-0">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>

            {/* User details */}
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                {user.full_name || user.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize truncate max-w-[140px]">
                {user.role || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="group relative">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                {user.full_name || user.email || 'User'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
