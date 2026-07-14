<?php

namespace App\Support;

class RoleCatalog
{
    private const PROTECTED_ROLES = ['admin', 'root'];

    private const ELEVATED_ROLES = ['supervisor', 'auditor'];

    private const RESERVED_ROLE_PERMISSIONS = [
        'users.assign_admin_role',
    ];

    private const ELEVATED_ROLE_PERMISSIONS = [
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
        'receipts.void',
        'reports.export',
        'reports.managerial.view',
        'settings.fiscal.update',
        'settings.operational.update',
        'users.disable',
        'users.update',
    ];

    private const ELEVATED_PERMISSION_RISK_LABELS = [
        'audit.view' => 'Permite revisar auditoria administrativa.',
        'backups.create' => 'Permite generar respaldos del sistema.',
        'backups.download' => 'Permite descargar respaldos con datos hospitalarios.',
        'cash.close_any' => 'Permite cerrar o revisar cajas de otros cajeros.',
        'fiscal.sequences.reset' => 'Permite ajustar correlativos fiscales.',
        'invoices.operate_any' => 'Permite operar facturas de otros usuarios.',
        'invoices.reverse' => 'Permite reversar pagos y facturas.',
        'invoices.void' => 'Permite anular facturas.',
        'payments.void' => 'Permite reversar pagos registrados.',
        'receipt_settings.advanced' => 'Permite usar soporte tecnico de impresion.',
        'receipt_settings.update' => 'Permite cambiar recibos y series.',
        'receipts.reprint_any' => 'Permite reimprimir recibos de otros cajeros.',
        'receipts.void' => 'Permite anular recibos.',
        'reports.export' => 'Permite exportar reportes operativos.',
        'reports.managerial.view' => 'Permite ver reportes ejecutivos.',
        'settings.fiscal.update' => 'Permite cambiar configuracion fiscal.',
        'settings.operational.update' => 'Permite cambiar reglas operativas.',
        'users.disable' => 'Permite desactivar usuarios.',
        'users.update' => 'Permite editar usuarios y roles.',
    ];

    /**
     * @return list<string>
     */
    public static function protectedRoleNames(): array
    {
        return self::PROTECTED_ROLES;
    }

    public static function isProtectedRoleName(string $role): bool
    {
        return in_array(strtolower($role), self::PROTECTED_ROLES, true);
    }

    public static function isElevatedRoleName(string $role): bool
    {
        $normalized = strtolower($role);

        return self::isProtectedRoleName($role) || in_array($normalized, self::ELEVATED_ROLES, true);
    }

    /**
     * @param  iterable<string>  $permissions
     */
    public static function containsReservedPermissions(iterable $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (in_array($permission, self::RESERVED_ROLE_PERMISSIONS, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  iterable<string>  $permissions
     */
    public static function containsElevatedPermissions(iterable $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (self::isElevatedPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    public static function isElevatedPermission(string $permission): bool
    {
        return in_array($permission, self::ELEVATED_ROLE_PERMISSIONS, true);
    }

    /**
     * @return array{critical: bool, risk_level: 'critical'|'standard', risk_label: string|null}
     */
    public static function permissionRiskMetadata(string $permission): array
    {
        $critical = self::isElevatedPermission($permission);

        return [
            'critical' => $critical,
            'risk_level' => $critical ? 'critical' : 'standard',
            'risk_label' => $critical ? self::ELEVATED_PERMISSION_RISK_LABELS[$permission] ?? 'Permiso operativo sensible.' : null,
        ];
    }

    /**
     * @return list<string>
     */
    public static function hiddenPermissionNames(): array
    {
        return array_values(array_unique([
            ...VisiblePermissions::hiddenPermissionNames(),
            ...self::RESERVED_ROLE_PERMISSIONS,
        ]));
    }

    public static function notProtectedRoleNameRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (is_string($value) && self::isProtectedRoleName($value)) {
                $fail('El nombre del rol esta reservado.');
            }
        };
    }
}
