import { api } from './api';

export const authApi = {
  login: async (email: string, password: string) => {
    // Debug: Log request payload (only in development)
    if (import.meta.env.DEV) {
      console.log('[authApi.login] Request payload:', { username: email, password: '***' });
    }

    // Send as form-data for OAuth2PasswordRequestForm compatibility
    const formData = new URLSearchParams();
    formData.append('username', email);  // OAuth2 uses 'username' field
    formData.append('password', password);

    const response = await api.post('/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Debug: Log response (only in development)
    if (import.meta.env.DEV) {
      console.log('[authApi.login] Response:', response.data);
    }
    return response.data;
  },
};
