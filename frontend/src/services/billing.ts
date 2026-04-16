import { api } from './api';

export interface CreateBillData {
  patient_id: number;
  amount: number;
  currency: string;
  description: string;
  due_date: string;
}

export const billingApi = {
  getAll: async () => {
    const response = await api.get('/billing');
    return response.data;
  },
  create: async (bill: CreateBillData) => {
    const response = await api.post('/billing', bill);
    return response.data;
  },
  pay: async (billId: number) => {
    const response = await api.post(`/billing/${billId}/pay`);
    return response.data;
  },
};
