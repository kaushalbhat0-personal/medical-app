import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          cn(
            'group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200',
            navIsActive || isActive
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )
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
          } ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
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
          <div className="absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-all duration-200 invisible group-hover:visible group-hover:opacity-100">
            {label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-background" />
          </div>
        )}
      </NavLink>
    </li>
  );
}
