import { apiClient } from './base';
import type { AuthUser } from './types';

export type UserPayload = {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: string;
  active?: boolean;
};

export const users = {
  async getUsers(): Promise<AuthUser[]> {
    const res = await apiClient.request<{ data: AuthUser[] }>('/api/admin/users');
    return res.data;
  },

  async createUser(payload: UserPayload): Promise<AuthUser> {
    const res = await apiClient.request<{ data: AuthUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateUser(id: number, payload: Omit<UserPayload, 'password'>): Promise<AuthUser> {
    const res = await apiClient.request<{ data: AuthUser }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async toggleActive(id: number): Promise<AuthUser> {
    const res = await apiClient.request<{ data: AuthUser }>(`/api/admin/users/${id}/toggle-active`, {
      method: 'POST',
    });
    return res.data;
  },

  async resetPassword(id: number, password: string): Promise<AuthUser> {
    const res = await apiClient.request<{ data: AuthUser }>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    return res.data;
  },
};
