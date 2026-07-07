import { type AuthUser, type PermissionCatalogGroup, type RoleDefinition } from '@/lib/api';

const HIDDEN_PERMISSION_NAMES = new Set([
  'system.exact_user_permissions',
  'backups.restore',
  'receipts.void',
  'reports.view',
  'users.assign_admin_role',
]);

export function hasProtectedRole(user: AuthUser): boolean {
  return user.roles.some((role) => ['admin', 'root'].includes(role.toLowerCase()));
}

export function isHiddenPermission(permissionName: string): boolean {
  return HIDDEN_PERMISSION_NAMES.has(permissionName);
}

export function visiblePermissionNames(permissions: string[]): string[] {
  return [...new Set(permissions.filter((permission) => !isHiddenPermission(permission)))].sort();
}

export function sanitizeRole(role: RoleDefinition): RoleDefinition {
  return {
    ...role,
    permissions: role.permissions.filter((permission) => !isHiddenPermission(permission.name)),
  };
}

export function sanitizeRoles(roles: RoleDefinition[]): RoleDefinition[] {
  return roles.map(sanitizeRole);
}

export function sanitizePermissionCatalog(catalog: PermissionCatalogGroup[]): PermissionCatalogGroup[] {
  return catalog
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => !isHiddenPermission(permission.name)),
    }))
    .filter((group) => group.permissions.length > 0);
}