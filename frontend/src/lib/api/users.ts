import { apiClient } from './base';
import type { AuthUser, PermissionCatalogGroup, RoleDefinition } from './types';

export type UserPayload = {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: string;
  permissions?: string[];
  active?: boolean;
};

export type RolePayload = {
  name: string;
  permissions: string[];
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

  async getRoles(): Promise<{ roles: RoleDefinition[]; permissionCatalog: PermissionCatalogGroup[] }> {
    const res = await apiClient.request<{ data: RoleDefinition[]; permission_catalog: PermissionCatalogGroup[] }>('/api/admin/roles');
    return {
      roles: res.data,
      permissionCatalog: res.permission_catalog,
    };
  },

  async createRole(payload: RolePayload): Promise<RoleDefinition> {
    const res = await apiClient.request<{ data: RoleDefinition }>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateRole(id: number, payload: RolePayload): Promise<RoleDefinition> {
    const res = await apiClient.request<{ data: RoleDefinition }>(`/api/admin/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};
