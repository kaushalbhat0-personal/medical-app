import { NavLink } from 'react-router-dom';
import type { User } from '../../types';

interface SidebarProps {
  user: User | null;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/patients', label: 'Patients', icon: '🏥' },
  { path: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
  { path: '/appointments', label: 'Appointments', icon: '📅' },
  { path: '/billing', label: 'Billing', icon: '💰' },
];

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">🏥 HMS</h1>
        <p className="tagline">Hospital Management</p>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink 
                to={item.path} 
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {user && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <p className="user-name">{user.full_name || user.email || 'User'}</p>
              <p className="user-role">{user.role || 'Unknown'}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
