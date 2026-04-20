import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
  path: string;
  label: string;
  icon: LucideIcon;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export function NavItem({ path, label, icon: Icon, isCollapsed, onNavigate }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <li>
      <NavLink
        to={path}
        onClick={onNavigate}
        className={({ isActive: navIsActive }) =>
          `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden ${
            navIsActive || isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`
        }
      >
        {/* Active indicator bar */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-all duration-200 ${
            isActive ? 'bg-primary opacity-100' : 'bg-primary opacity-0'
          }`}
        />

        {/* Icon */}
        <Icon
          className={`h-5 w-5 flex-shrink-0 transition-all duration-200 ${
            isCollapsed ? 'mx-auto' : ''
          } ${isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'}`}
        />

        {/* Label */}
        <span
          className={`text-sm whitespace-nowrap transition-all duration-300 ${
            isCollapsed
              ? 'opacity-0 w-0 overflow-hidden translate-x-2'
              : 'opacity-100 w-auto translate-x-0'
          }`}
        >
          {label}
        </span>

        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-background text-text-primary text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-border shadow-lg">
            {label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-background" />
          </div>
        )}
      </NavLink>
    </li>
  );
}
