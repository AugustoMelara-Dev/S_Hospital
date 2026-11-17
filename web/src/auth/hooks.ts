import { useCallback, useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthProvider';
import type { Me, Permission } from '@/api/types';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}

/** The authenticated user (throws if used outside an authenticated route). */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe requiere una sesión activa.');
  return me;
}

export type PermissionQuery = Permission | readonly Permission[];

export function hasPermission(me: Pick<Me, 'permissions'> | null, perm: PermissionQuery | undefined): boolean {
  if (!perm) return Boolean(me);
  if (!me) return false;
  const list = typeof perm === 'string' ? [perm] : perm;
  if (list.length === 0) return true;
  return list.some((p) => me.permissions.includes(p));
}

/**
 * `can('invoices.void')` or `can(['reports.own','reports.all'])` (any of).
 * `canAll([...])` requires every permission.
 */
export function usePermissions() {
  const { me } = useAuth();
  const can = useCallback((perm: PermissionQuery) => hasPermission(me, perm), [me]);
  const canAll = useCallback((perms: readonly Permission[]) => perms.every((p) => hasPermission(me, p)), [me]);
  return { can, canAll, permissions: me?.permissions ?? [] };
}
