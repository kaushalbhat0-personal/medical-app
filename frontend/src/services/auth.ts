import { api } from './api';

export const authApi = {
  login: async (email: string, password: string) => {
    // Debug: Log request payload (only in development)
    if (import.meta.env.DEV) {
      console.log('[authApi.login] Request payload:', { email, password: '***' });
    }

    const response = await api.post('/login', {
      email,
      password,
    });

    // Debug: Log response (only in development)
    if (import.meta.env.DEV) {
      console.log('[authApi.login] Response:', response.data);
    }
    return response.data;
  },
};
