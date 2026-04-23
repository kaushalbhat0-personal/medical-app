import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import { getEffectiveRoles, isAdminRole, isDoctorRole } from '../utils/roles';
import { type AppMode, readStoredAppMode, writeStoredAppMode } from '../constants/appMode';
import { useAuth } from '../hooks/useAuth';

const MODE_EVENT = 'app_mode_changed';

function dispatchModeEvent(): void {
  window.dispatchEvent(new Event(MODE_EVENT));
}

export interface AppModeContextValue {
  isDualModeUser: boolean;
  isDoctor: boolean;
  isAdmin: boolean;
  mode: AppMode;
  setMode: (m: AppMode) => void;
  resolvedMode: AppMode;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

function detect(
  user: User | null,
  token: string | null
): { isDoctor: boolean; isAdmin: boolean; isDual: boolean } {
  const r = getEffectiveRoles(user, token);
  return {
    isDoctor: isDoctorRole(r),
    isAdmin: isAdminRole(r),
    isDual: isDoctorRole(r) && isAdminRole(r),
  };
}

function defaultDualMode(stored: AppMode | null): AppMode {
  if (stored === 'admin' || stored === 'practice') return stored;
  return 'practice';
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [mode, setModeState] = useState<AppMode>('practice');

  const { isDoctor, isAdmin, isDual: isDualModeUser } = useMemo(
    () => detect(user, localStorage.getItem('token')),
    [user]
  );

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const t = localStorage.getItem('token');
    const { isDoctor: d, isAdmin: a, isDual: dual } = detect(user, t);
    if (dual) {
      setModeState(defaultDualMode(readStoredAppMode()));
    } else if (d && !a) {
      setModeState('practice');
    } else {
      setModeState('admin');
    }
  }, [isAuthenticated, user]);

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    writeStoredAppMode(m);
    dispatchModeEvent();
  }, []);

  const resolvedMode: AppMode = useMemo(() => {
    if (!isAuthenticated) return 'practice';
    if (isDoctor && !isAdmin) return 'practice';
    if (isAdmin && !isDoctor) return 'admin';
    if (isDualModeUser) return mode;
    return 'admin';
  }, [isAuthenticated, isAdmin, isDoctor, isDualModeUser, mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-app-mode', resolvedMode);
    return () => {
      document.documentElement.removeAttribute('data-app-mode');
    };
  }, [resolvedMode]);

  const value = useMemo<AppModeContextValue>(
    () => ({
      isDualModeUser,
      isDoctor,
      isAdmin,
      mode,
      setMode,
      resolvedMode,
    }),
    [isDualModeUser, isDoctor, isAdmin, mode, setMode, resolvedMode]
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return ctx;
}

export { MODE_EVENT };
