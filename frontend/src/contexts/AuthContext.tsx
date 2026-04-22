import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  User,
  LoginCredentials,
  LoginResponse,
  LoginResult,
  RegisterPayload,
  RegisterResponse,
} from '../types';
import { authApi, formatLoginError, patientsApi } from '../services';
import { roleFromToken, tenantIdFromToken, userIdFromAccessToken } from '../utils/jwtPayload';
import { isPatientRole } from '../utils/roles';
import { resolveLinkedPatient } from '../utils/patientProfile';
import { setActiveTenantId } from '../utils/tenantIdForRequest';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  signUp: (payload: RegisterPayload) => Promise<LoginResult>;
  logout: () => void;
  /** Merge partial fields into the signed-in user and persist to localStorage */
  patchUser: (updates: Partial<User>) => void;
  /** Resolved patient row id for the signed-in patient user; null for staff or unresolved. */
  patientId: string | null;
  patientProfileLoading: boolean;
  patientProfileError: string | null;
  refreshPatientProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const safeParseUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser || storedUser === 'undefined') return null;
    return JSON.parse(storedUser) as User;
  } catch {
    return null;
  }
};

function buildUserFromLogin(credentials: LoginCredentials, response: LoginResponse): User {
  const base = response.user;
  // Role/tenant can come from either the API response (preferred) or the token payload.
  // We keep the fallback so the UI stays usable even if the backend returns a minimal login response.
  const role = response.role ?? base?.role ?? roleFromToken(response.access_token) ?? 'admin';
  const tenantRaw = response.tenant_id ?? base?.tenant_id ?? tenantIdFromToken(response.access_token);

  return {
    id: base?.id ?? 0,
    email: base?.email ?? credentials.email,
    full_name: base?.full_name ?? credentials.email.split('@')[0] ?? 'User',
    is_active: base?.is_active ?? true,
    role,
    ...(tenantRaw !== undefined ? { tenant_id: tenantRaw } : {}),
    ...(response.force_password_reset !== undefined
      ? { force_password_reset: response.force_password_reset }
      : {}),
  };
}

function buildUserFromRegister(response: RegisterResponse): User {
  const role = response.user?.role ?? roleFromToken(response.access_token) ?? 'patient';
  const tenantRaw = tenantIdFromToken(response.access_token);
  return {
    id: response.user.id as unknown as number,
    email: response.user.email,
    full_name: response.user.full_name ?? response.user.email.split('@')[0] ?? 'User',
    is_active: response.user.is_active ?? true,
    role,
    ...(tenantRaw !== undefined && tenantRaw !== null ? { tenant_id: tenantRaw } : {}),
  };
}

function mergeUserWithToken(user: User, token: string | null): User {
  if (!token) return user;
  const role = user.role || roleFromToken(token);
  const tenant_id = user.tenant_id ?? tenantIdFromToken(token) ?? undefined;
  return {
    ...user,
    ...(role ? { role } : {}),
    ...(tenant_id !== undefined ? { tenant_id } : {}),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientProfileLoading, setPatientProfileLoading] = useState(false);
  const [patientProfileError, setPatientProfileError] = useState<string | null>(null);
  /** Skip one post-login profile effect run when login() already prefetched the patient. */
  const skipPatientProfileEffectRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    let storedUser = safeParseUser();

    if (import.meta.env.DEV) {
      console.log('[Auth] Token on init:', token ? `${token.substring(0, 10)}...` : 'none');
    }

    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        // Keep local user info in sync with the current token (role/tenant may change across sessions).
        storedUser = mergeUserWithToken(storedUser, token);
        localStorage.setItem('user', JSON.stringify(storedUser));
        setUser(storedUser);
      } else {
        // Token exists but user blob is missing/corrupted; synthesize a minimal user so routes can render.
        // We intentionally keep this minimal to avoid "inventing" profile fields.
        const role = roleFromToken(token);
        if (role) {
          const minimal: User = {
            id: 0,
            email: '',
            full_name: 'User',
            is_active: true,
            role,
            tenant_id: tenantIdFromToken(token) ?? undefined,
          };
          localStorage.setItem('user', JSON.stringify(minimal));
          setUser(minimal);
        }
      }
    }
    setIsLoading(false);
  }, []);

  const loadPatientProfile = useCallback(async (userOverride?: User | null) => {
    const effectiveUser = userOverride ?? user;
    const token = localStorage.getItem('token');
    const role = effectiveUser?.role ?? roleFromToken(token);
    if (!isPatientRole(role)) {
      setPatientId(null);
      setPatientProfileError(null);
      setPatientProfileLoading(false);
      return;
    }
    setPatientProfileLoading(true);
    setPatientProfileError(null);
    try {
      // The backend links Patient → User via `patient.user_id`. We resolve the current patient's row
      // by matching that field against either the app user id or the JWT `sub`.
      const list = await patientsApi.getAll();
      const tokenUserId = userIdFromAccessToken(token);
      const linked = resolveLinkedPatient(list, effectiveUser?.id, tokenUserId);
      if (linked?.id != null) {
        setPatientId(String(linked.id));
        setPatientProfileError(null);
      } else {
        setPatientId(null);
        setPatientProfileError('Unable to resolve patient profile');
      }
    } catch {
      setPatientId(null);
      setPatientProfileError('Unable to load your patient profile');
    } finally {
      setPatientProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      setPatientId(null);
      setPatientProfileError(null);
      setPatientProfileLoading(false);
      return;
    }
    if (skipPatientProfileEffectRef.current) {
      // login()/signUp() already fetched patient profile; avoid duplicate network call right after auth.
      skipPatientProfileEffectRef.current = false;
      return;
    }
    void loadPatientProfile();
  }, [isLoading, isAuthenticated, user, loadPatientProfile]);

  const patchUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await authApi.register(payload);
      if (!response.access_token) {
        return { success: false, error: 'No access token received' };
      }
      localStorage.setItem('token', response.access_token);
      setIsAuthenticated(true);
      const userData = buildUserFromRegister(response);
      localStorage.setItem('user', JSON.stringify(userData));
      if (userData.role !== 'super_admin' && userData.tenant_id) {
        setActiveTenantId(String(userData.tenant_id));
      }
      if (isPatientRole(userData.role)) {
        skipPatientProfileEffectRef.current = true;
      }
      setUser(userData);
      if (isPatientRole(userData.role)) {
        await loadPatientProfile(userData);
      } else {
        setPatientId(null);
        setPatientProfileError(null);
        setPatientProfileLoading(false);
      }
      return { success: true, role: userData.role, forcePasswordReset: false };
    } catch (error) {
      const errorMessage = formatLoginError(error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [loadPatientProfile]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      if (import.meta.env.DEV) {
        console.log('[Auth] Login attempt:', credentials.email);
      }

      const response: LoginResponse = await authApi.login(credentials.email, credentials.password);

      if (import.meta.env.DEV) {
        console.log('[Auth] Login response:', {
          hasToken: !!response.access_token,
          role: response.role,
        });
      }

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        setIsAuthenticated(true);

        const userData = buildUserFromLogin(credentials, response);
        localStorage.setItem('user', JSON.stringify(userData));
        if (userData.role !== 'super_admin' && userData.tenant_id) {
          setActiveTenantId(String(userData.tenant_id));
        }
        if (isPatientRole(userData.role)) {
          skipPatientProfileEffectRef.current = true;
        }
        setUser(userData);

        if (isPatientRole(userData.role)) {
          await loadPatientProfile(userData);
        } else {
          setPatientId(null);
          setPatientProfileError(null);
          setPatientProfileLoading(false);
        }

        return {
          success: true,
          role: userData.role,
          forcePasswordReset: response.force_password_reset === true,
        };
      }
      return { success: false, error: 'No access token received' };
    } catch (error) {
      const errorMessage = formatLoginError(error);
      if (import.meta.env.DEV) {
        console.error('[Auth] Login error:', error);
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [loadPatientProfile]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeTenantId');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('adminSelectedTenantId');
    setIsAuthenticated(false);
    setUser(null);
    setPatientId(null);
    setPatientProfileError(null);
    setPatientProfileLoading(false);
    skipPatientProfileEffectRef.current = false;
    // Hard navigation guarantees all state is reset (including any in-memory caches).
    window.location.href = '/login';
  }, []);

  const refreshPatientProfile = useCallback(async () => {
    await loadPatientProfile();
  }, [loadPatientProfile]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      signUp,
      logout,
      patchUser,
      patientId,
      patientProfileLoading,
      patientProfileError,
      refreshPatientProfile,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      login,
      signUp,
      logout,
      patchUser,
      patientId,
      patientProfileLoading,
      patientProfileError,
      refreshPatientProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
