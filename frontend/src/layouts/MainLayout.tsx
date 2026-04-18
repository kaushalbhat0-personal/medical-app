import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { HealthNews } from '../components/layout/HealthNews';
import { sidebarVariants, overlayVariants } from '../animations';
import type { User } from '../types';

interface MainLayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export function MainLayout({ user, onLogout, children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      {/* Mobile Sidebar Overlay with animation */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{ willChange: 'opacity' }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - hidden on mobile, animated drawer on mobile */}
      <motion.aside
        initial={false}
        animate={sidebarOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
        className="fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 lg:translate-x-0 lg:static lg:block"
        style={{ willChange: 'transform' }}
      >
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
      </motion.aside>

      <main className="flex-1 w-full overflow-x-hidden min-w-0">
        <Topbar user={user} onLogout={onLogout} onMenuToggle={() => setSidebarOpen(true)} />
        <div className="flex w-full">
          <div className="flex-1 min-w-0 p-4 sm:p-6">
            {children}
          </div>
          <aside className="w-80 flex-shrink-0 hidden xl:block p-6 bg-gray-50 border-l">
            <HealthNews />
          </aside>
        </div>
      </main>
    </div>
  );
}
