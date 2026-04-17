import type { User } from '../../types';

interface TopbarProps {
  user: User | null;
  onLogout: () => void;
}

export function Topbar({ user, onLogout }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="page-title">Hospital Management System</h2>
      </div>
      
      <div className="topbar-right">
        <div className="actions">
          <button className="icon-btn" title="Notifications">
            🔔
            <span className="badge">3</span>
          </button>
          <button className="icon-btn" title="Settings">
            ⚙️
          </button>
        </div>
        
        {user && (
          <div className="user-menu">
            <span className="user-email">{user.email || user.full_name || 'User'}</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
