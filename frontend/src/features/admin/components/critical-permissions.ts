const CRITICAL_PERMISSION_NAMES = new Set([
  'audit.view',
  'backups.create',
  'backups.download',
  'cash.close_any',
  'fiscal.sequences.reset',
  'invoices.operate_any',
  'invoices.reverse',
  'invoices.void',
  'payments.void',
  'receipt_settings.advanced',
  'receipt_settings.update',
  'receipts.reprint_any',
  'reports.export',
  'reports.managerial.view',
  'settings.fiscal.update',
  'settings.operational.update',
  'users.assign_admin_role',
  'users.disable',
  'users.update',
]);

export function isCriticalPermission(permissionName: string): boolean {
  return CRITICAL_PERMISSION_NAMES.has(permissionName);
}
