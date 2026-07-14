import type { RolePermission } from '@/lib/api';

export type PermissionRiskInfo = Pick<RolePermission, 'critical' | 'risk_level' | 'risk_label'>;

export function isCriticalPermission(permission: PermissionRiskInfo | null | undefined): boolean {
  return permission?.critical === true || permission?.risk_level === 'critical';
}

export function permissionRiskLabel(permission: PermissionRiskInfo | null | undefined): string | null {
  const label = permission?.risk_label?.trim();

  return label ? label : null;
}
