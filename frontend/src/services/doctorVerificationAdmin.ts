import { api } from './api';

/** GET /admin/doctor-profiles — one row per doctor with a structured profile. */
export interface DoctorVerificationQueueItem {
  doctor_id: string;
  doctor_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_type: string;
  verification_status: string;
  verification_rejection_reason?: string | null;
}

export interface DoctorVerificationQueuePage {
  items: DoctorVerificationQueueItem[];
  total: number;
  skip: number;
  limit: number;
}

export const doctorVerificationAdminApi = {
  /**
   * Super-admin: omit optional tenant header (no active org) to list all tenants, or set active org to filter.
   * Org admins: scoped via `X-Tenant-ID` (interceptor + login).
   */
  list: async (params?: {
    verification_status?: string;
    skip?: number;
    limit?: number;
  }): Promise<DoctorVerificationQueuePage> => {
    const { data } = await api.get<DoctorVerificationQueuePage>('/admin/doctor-profiles', {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 200,
        ...(params?.verification_status ? { verification_status: params.verification_status } : {}),
      },
    });
    return data;
  },

  setVerification: async (
    doctorId: string,
    body: { status: string; reason?: string | null }
  ): Promise<unknown> => {
    const { data } = await api.patch(`/admin/doctor-profiles/${doctorId}/verification`, body);
    return data;
  },
};
