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
    <div className="flex min-h-screen">
      <div className="w-64 flex-shrink-0">
        <Sidebar user={user} />
      </div>

      <main className="flex-1 min-w-0">
        <Topbar user={user} onLogout={onLogout} />
        <div className="flex">
          <div className="flex-1 min-w-0 p-6">
            {children}
          </div>
          <aside className="w-80 flex-shrink-0 hidden lg:block p-6 bg-gray-50 border-l">
            <HealthNews />
          </aside>
        </div>
      </main>
    </div>
  );
}
