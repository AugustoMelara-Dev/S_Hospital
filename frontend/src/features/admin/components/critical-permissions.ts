const CRITICAL_PERMISSION_NAMES = new Set([
  'backups.create',
  'backups.download',
  'backups.restore',
  'cash.close_any',
  'invoices.reverse',
  'invoices.void',
  'payments.void',
  'receipt_settings.advanced',
  'receipt_settings.update',
  'receipts.reprint_any',
  'settings.fiscal.update',
  'users.assign_admin_role',
  'users.update',
]);

export function isCriticalPermission(permissionName: string): boolean {
  return CRITICAL_PERMISSION_NAMES.has(permissionName);
}
