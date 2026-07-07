import { type AuthUser, type PermissionCatalogGroup, type RoleDefinition, type UserPayload } from '@/lib/api';

type UserFormPayloadInput = {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: string;
};

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

export function buildUpdateUserPayload(
  data: UserFormPayloadInput,
  selectedPermissions: string[],
  advancedPermissionsMode: boolean,
): Omit<UserPayload, 'password'> {
  const payload: Omit<UserPayload, 'password'> = {
    name: data.name,
    email: data.email,
    username: data.username,
    role: data.role,
  };

  if (advancedPermissionsMode) {
    payload.permissions = visiblePermissionNames(selectedPermissions);
  }

  return payload;
}

export function buildCreateUserPayload(
  data: UserFormPayloadInput,
  selectedPermissions: string[],
  advancedPermissionsMode: boolean,
): UserPayload {
  const payload: UserPayload = {
    ...buildUpdateUserPayload(data, selectedPermissions, advancedPermissionsMode),
    password: data.password || '',
    active: true,
  };

  return payload;
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
