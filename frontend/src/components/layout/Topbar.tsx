import { Menu, Bell, Settings } from 'lucide-react';
import type { User } from '../../types';

interface TopbarProps {
  user: User | null;
  onLogout: () => void;
  onMenuToggle: () => void;
}

export function Topbar({ user, onLogout, onMenuToggle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border h-14">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-muted rounded-md transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-3">
        {/* Icons - hidden on smallest screens */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            className="p-2 hover:bg-muted rounded-md transition-colors relative"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              3
            </span>
          </button>
          <button
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Logout only on mobile */}
        <div className="flex sm:hidden">
          <button
            onClick={onLogout}
            className="px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Full user menu on larger screens */}
        {user && (
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline max-w-[120px] truncate">
              {user.email || user.full_name || 'User'}
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
