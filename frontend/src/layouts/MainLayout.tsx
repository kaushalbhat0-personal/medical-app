import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { HealthNews } from '../components/layout/HealthNews';
import type { User } from '../types';

interface MainLayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export function MainLayout({ user, onLogout, children }: MainLayoutProps) {
  return (
    <div className="main-layout">
      <Sidebar user={user} />
      
      <div className="main-content-wrapper">
        <Topbar user={user} onLogout={onLogout} />
        
        <div className="content-area">
          <main className="main-content">
            {children}
          </main>
          
          <aside className="right-panel">
            <HealthNews />
          </aside>
        </div>
      </div>
    </div>
  );
}
