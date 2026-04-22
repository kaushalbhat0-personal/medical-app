import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { User } from "../../types";

interface AppLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
}

export default function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleMenuToggle = () => setMobileOpen(true);
  const handleMobileClose = () => setMobileOpen(false);
  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex min-h-screen w-full overflow-y-auto bg-background text-foreground">
      {/* Desktop Sidebar - fixed width */}
      <div className="hidden lg:block flex-shrink-0 self-stretch">
        <div className={`min-h-screen h-full transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
          <Sidebar
            user={user}
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={handleMobileClose}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-64 bg-background border-r border-border shadow-2xl animate-in slide-in-from-left duration-300">
            <Sidebar
              user={user}
              onClose={handleMobileClose}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={user}
          onLogout={onLogout}
          onMenuToggle={handleMenuToggle}
        />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
