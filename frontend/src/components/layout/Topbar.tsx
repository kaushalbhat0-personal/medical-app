import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Bell, Settings, ChevronDown, Building2 } from 'lucide-react';
import { tenantsApi } from '../../services';
import type { Tenant, User } from '../../types';
import { isSuperAdminRole } from '../../utils/roles';
import {
  getActiveTenantId,
  TENANT_ID_STORAGE_EVENT,
  setActiveTenantId,
} from '../../utils/tenantIdForRequest';
import { cn } from '@/lib/utils';

interface TopbarProps {
  user: User | null;
  onLogout: () => void;
  onMenuToggle: () => void;
}

export function Topbar({ user, onLogout, onMenuToggle }: TopbarProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getActiveTenantId() : null
  );
  const switcherRef = useRef<HTMLDivElement>(null);

  const showSwitcher = isSuperAdminRole(user?.role);

  const loadTenants = useCallback(async () => {
    if (!showSwitcher) return;
    try {
      const list = await tenantsApi.getAll();
      setTenants(list);
    } catch {
      setTenants([]);
    }
  }, [showSwitcher]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    const sync = () => {
      setActiveTenantIdState(getActiveTenantId());
    };
    window.addEventListener(TENANT_ID_STORAGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(TENANT_ID_STORAGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (switcherRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const selectedTenant = tenants.find((t) => t.id === activeTenantId);
  const switcherLabel = selectedTenant?.name ?? 'Select organization';

  const onSelectTenant = (t: Tenant) => {
    setActiveTenantId(t.id);
    setMenuOpen(false);
    window.location.assign('/admin/dashboard');
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border h-14">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-muted rounded-md transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {showSwitcher && activeTenantId && (
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[220px]">
            Managing:{' '}
            <span className="font-medium text-foreground">
              {selectedTenant?.name ?? (tenants.length ? 'Unknown organization' : '…')}
            </span>
          </span>
        )}

        {showSwitcher && (
          <div className="relative min-w-0 max-w-[min(100%,280px)]" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                'flex items-center gap-2 w-full rounded-lg border border-border bg-background',
                'px-3 py-1.5 text-sm text-left hover:bg-muted/60 transition-colors',
                'min-h-9'
              )}
              aria-expanded={menuOpen}
              aria-haspopup="listbox"
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-foreground">{switcherLabel}</span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', menuOpen && 'rotate-180')}
              />
            </button>
            {menuOpen && (
              <ul
                className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[220px] overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md"
                role="listbox"
              >
                {tenants.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No organizations</li>
                ) : (
                  tenants.map((t) => (
                    <li key={t.id} role="option" aria-selected={t.id === activeTenantId}>
                      <button
                        type="button"
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                          t.id === activeTenantId && 'bg-muted/80 font-medium'
                        )}
                        onClick={() => onSelectTenant(t)}
                      >
                        <span className="block truncate">{t.name}</span>
                        <span className="text-xs capitalize text-muted-foreground">{t.type}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-3">
        <div className="hidden sm:flex items-center gap-1">
          <button
            className="p-2 hover:bg-muted rounded-md transition-colors relative"
            title="Notifications"
            type="button"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              3
            </span>
          </button>
          <button className="p-2 hover:bg-muted rounded-md transition-colors" title="Settings" type="button">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="flex sm:hidden">
          <button
            onClick={onLogout}
            className="px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            type="button"
          >
            Logout
          </button>
        </div>

        {user && (
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline max-w-[120px] truncate">
              {user.email || user.full_name || 'User'}
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              type="button"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
