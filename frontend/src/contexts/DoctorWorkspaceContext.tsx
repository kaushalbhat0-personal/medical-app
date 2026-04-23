import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { APP_MODE_CHANGE_EVENT } from '../constants/appMode';
import { useAuth } from '../hooks/useAuth';
import { doctorsApi } from '../services';
import { getEffectiveRoles, isDoctorRole } from '../utils/roles';
import { TENANT_ID_STORAGE_EVENT } from '../utils/tenantIdForRequest';
import type { Doctor } from '../types';

function resolveSelfDoctorFromList(
  list: Doctor[],
  userEmail: string | undefined
): Doctor | null {
  if (list.length === 0) return null;
  const em = userEmail?.trim().toLowerCase();
  if (em) {
    const byEmail = list.find((d) => d.linked_user_email?.trim().toLowerCase() === em);
    if (byEmail) return byEmail;
  }
  if (list.length === 1) return list[0] ?? null;
  return null;
}

export interface DoctorWorkspaceContextValue {
  /** The doctor row for the signed-in user, when it can be resolved from GET /doctors. */
  selfDoctor: Doctor | null;
  /**
   * True when the signed-in user is linked to a doctor row in the current org (full mutating
   * workspace). Same behavior for all tenant types; server scopes by `tenant_id`.
   */
  isIndependent: boolean;
  /** True when we could not link the account to a single doctor (ambiguous org); view-only. */
  isReadOnly: boolean;
  /** True when the doctor profile could not be matched in the org list (ambiguous multi-doctor org without email link). */
  profilePartial: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DoctorWorkspaceContext = createContext<DoctorWorkspaceContextValue | null>(null);

export function DoctorWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selfDoctor, setSelfDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await doctorsApi.getAll();
      let me = resolveSelfDoctorFromList(list, user?.email);
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const eff = getEffectiveRoles(user, token);
      if (me == null && isDoctorRole(eff) && user?.doctor_id) {
        try {
          me = await doctorsApi.getOne(String(user.doctor_id));
        } catch {
          me = null;
        }
      }
      setSelfDoctor(me);
    } catch {
      setSelfDoctor(null);
      setError('Could not load your organization profile');
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.doctor_id, user?.tenant_id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onScope = () => {
      void load();
    };
    window.addEventListener(TENANT_ID_STORAGE_EVENT, onScope);
    window.addEventListener(APP_MODE_CHANGE_EVENT, onScope);
    return () => {
      window.removeEventListener(TENANT_ID_STORAGE_EVENT, onScope);
      window.removeEventListener(APP_MODE_CHANGE_EVENT, onScope);
    };
  }, [load]);

  const profilePartial = !loading && !error && selfDoctor === null;
  const isReadOnly = profilePartial;
  const isIndependent = !profilePartial && selfDoctor != null;

  const value = useMemo(
    () => ({
      selfDoctor,
      isIndependent,
      isReadOnly,
      profilePartial,
      loading,
      error,
      refetch: load,
    }),
    [selfDoctor, isIndependent, isReadOnly, profilePartial, loading, error, load]
  );

  return (
    <DoctorWorkspaceContext.Provider value={value}>{children}</DoctorWorkspaceContext.Provider>
  );
}

export function useDoctorWorkspace(): DoctorWorkspaceContextValue {
  const ctx = useContext(DoctorWorkspaceContext);
  if (!ctx) {
    throw new Error('useDoctorWorkspace must be used within DoctorWorkspaceProvider');
  }
  return ctx;
}
