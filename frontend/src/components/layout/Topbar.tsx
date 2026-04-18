import { Menu } from 'lucide-react';
import type { User } from '../../types';

interface TopbarProps {
  user: User | null;
  onLogout: () => void;
  onMenuToggle: () => void;
}

export function Topbar({ user, onLogout, onMenuToggle }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="page-title text-lg sm:text-xl lg:text-2xl">Hospital Management System</h2>
      </div>

      <div className="topbar-right flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
        <div className="actions hidden sm:flex">
          <button className="icon-btn" title="Notifications">
            🔔
            <span className="badge">3</span>
          </button>
          <button className="icon-btn" title="Settings">
            ⚙️
          </button>
        </div>

        {user && (
          <div className="user-menu flex items-center gap-2 sm:gap-4">
            <span className="user-email hidden sm:inline">{user.email || user.full_name || 'User'}</span>
            <button className="logout-btn text-sm sm:text-base" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
