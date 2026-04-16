import { api } from './api';

export interface CreateBillData {
  patient_id: number;
  amount: number;
  currency: string;
  description: string;
  due_date: string;
}

export const billingApi = {
  getAll: async (params?: { skip?: number; limit?: number; patient_id?: string; status?: string }) => {
    const response = await api.get('/bills', { params: { skip: 0, limit: 100, ...params } });
    return response.data;
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
