import { api } from './api';
import { safeArray } from '../utils';
import type { Bill } from '../types';

export interface CreateBillData {
  patient_id: string;
  amount: number;
  currency: string;
  description: string;
  due_date: string;
}

export const billingApi = {
  getAll: async (params?: { skip?: number; limit?: number; patient_id?: string; status?: string }): Promise<Bill[]> => {
    try {
      const response = await api.get('/bills', { params: { skip: 0, limit: 100, ...params } });
      // Debug log in development
      if (import.meta.env.DEV) {
        console.log('[billingApi.getAll] Response:', response.data);
      }
      // Safe array extraction - handles { data: [...] } or direct array
      return safeArray<Bill>(response.data);
    } catch (error) {
      console.error('[billingApi.getAll] Error:', error);
      throw error;
    }
  },
  create: async (bill: CreateBillData) => {
    const response = await api.post('/bills', bill);
    return response.data;
  },
  pay: async (billId: number) => {
    const response = await api.post(`/bills/${billId}/pay`);
    return response.data;
  },
};
