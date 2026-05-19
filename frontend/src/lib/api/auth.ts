import { apiClient } from './base';
import type { AuthUser } from './types';

export type LoginCredentials = {
  login: string;
  password: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

export const auth = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await apiClient.request<{ data: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return response.data;
  },

  async me(): Promise<AuthUser> {
    const response = await apiClient.request<{ data: AuthUser }>('/api/auth/me');
    return response.data;
  },

  async session(): Promise<AuthUser | null> {
    const response = await apiClient.request<{ data: AuthUser | null }>('/api/auth/session');
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.request<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async changePassword(payload: ChangePasswordPayload): Promise<AuthUser> {
    const response = await apiClient.request<{ data: AuthUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
