<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public const PERMISSIONS = [
        'settings.fiscal.view',
        'settings.fiscal.update',
        'catalog.view',
        'catalog.manage',
        'invoices.view',
        'invoices.create',
        'invoices.operate_any',
        'invoices.void',
        'invoices.reverse',
        'cash.view',
        'cash.open',
        'cash.close',
        'cash.close_any',
        'payments.create',
        'payments.view',
        'payments.void',
        'receipts.view',
        'receipts.reprint',
        'receipts.reprint_any',
        'receipts.void',
        'receipts.print_test',
        'receipt_settings.view',
        'receipt_settings.update',
        'receipt_settings.advanced',
        'reports.view',
        'reports.managerial.view',
        'reports.cash_session.view',
        'reports.export',
        'users.view',
        'users.create',
        'users.update',
        'users.disable',
        'users.assign_admin_role',
        'backups.view',
        'backups.create',
        'backups.download',
        'backups.restore',
        'system.status.view',
        'audit.view',
        'patients.mark_dialysis_prescription',
        'system.exact_user_permissions',
        'fiscal.sequences.reset',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        cache()->forget(config('permission.cache.key'));

        $permissions = collect(self::PERMISSIONS)
            ->map(fn (string $permission) => Permission::query()->firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]));

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Role::findOrCreate('admin', 'web')->syncPermissions($permissions);

        Role::findOrCreate('supervisor', 'web')->syncPermissions($permissions->whereIn('name', [
            'settings.fiscal.view',
            'catalog.view',
            'invoices.view',
            'invoices.create',
            'invoices.operate_any',
            'invoices.void',
            'invoices.reverse',
            'cash.view',
            'cash.open',
            'cash.close',
            'cash.close_any',
            'payments.create',
            'payments.view',
            'payments.void',
            'receipts.view',
            'receipts.reprint',
            'receipts.reprint_any',
            'receipts.void',
            'receipts.print_test',
            'receipt_settings.view',
            'reports.view',
            'reports.managerial.view',
            'reports.cash_session.view',
            'reports.export',
            'audit.view',
        ]));

        Role::findOrCreate('auditor', 'web')->syncPermissions($permissions->whereIn('name', [
            'settings.fiscal.view',
            'catalog.view',
            'invoices.view',
            'cash.view',
            'payments.view',
            'receipts.view',
            'reports.view',
            'reports.managerial.view',
            'backups.view',
            'audit.view',
        ]));

        Role::findOrCreate('soporte_tecnico', 'web')->syncPermissions($permissions->whereIn('name', [
            'system.status.view',
            'receipt_settings.view',
            'receipt_settings.update',
            'receipt_settings.advanced',
        ]));

        Role::findOrCreate('cajero', 'web')->syncPermissions($permissions->whereIn('name', [
            'catalog.view',
            'invoices.view',
            'invoices.create',
            'cash.view',
            'cash.open',
            'cash.close',
            'payments.create',
            'payments.view',
            'receipts.view',
            'receipts.reprint',
        ]));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        app(PermissionRegistrar::class)->clearPermissionsCollection();
        cache()->forget(config('permission.cache.key'));
    }
}
