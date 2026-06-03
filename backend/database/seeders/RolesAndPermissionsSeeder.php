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
        'reports.view',
        'reports.managerial.view',
        'reports.cash_session.view',
        'reports.export',
        'users.view',
        'users.create',
        'users.update',
        'users.disable',
        'backups.view',
        'backups.create',
        'backups.download',
        'system.status.view',
        'audit.view',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

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
            'reports.view',
            'reports.managerial.view',
            'reports.cash_session.view',
            'reports.export',
            'audit.view',
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
    }
}
