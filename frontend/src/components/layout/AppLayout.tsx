import type { ReactNode } from "react";
import { Sidebar } from "./NewSidebar";
import { Topbar } from "./Topbar";
import type { User } from "../../types";

interface AppLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
}

export default function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} onLogout={onLogout} onMenuToggle={() => {}} />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
