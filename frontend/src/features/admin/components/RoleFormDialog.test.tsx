import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleFormDialog } from './RoleFormDialog';

const permissionCatalog = [
  {
    module: 'invoices',
    label: 'Facturación',
    permissions: [{ name: 'invoices.create', label: 'Crear facturas' }],
  },
];

function criticalPermission(name: string, label: string) {
  return {
    name,
    label,
    critical: true,
    risk_level: 'critical',
    risk_label: 'Permiso operativo sensible.',
  };
}

describe('RoleFormDialog', () => {
  it('renders the role name input and disables it for protected roles', () => {
    const { rerender } = render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={permissionCatalog}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    const roleInput = screen.getByLabelText(/nombre del rol/i) as HTMLInputElement;
    expect(roleInput).not.toBeDisabled();
    expect(roleInput.value).toBe('');

    rerender(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={{
          id: 1,
          name: 'admin',
          protected: true,
          permissions: [],
        }}
        permissionCatalog={permissionCatalog}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByLabelText(/nombre del rol/i)).toBeDisabled();
  });

  it('shows error when no permission is selected on submit', () => {
    const onSubmit = vi.fn();

    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={permissionCatalog}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError="Seleccione al menos un permiso para el rol."
        onSubmit={onSubmit}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/seleccione al menos un permiso para el rol/i)).toBeInTheDocument();
  });

  it('toggles a permission when the checkbox changes', () => {
    const onTogglePermission = vi.fn();

    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={permissionCatalog}
        selectedPermissions={['invoices.create']}
        onTogglePermission={onTogglePermission}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /crear facturas/i });
    fireEvent.click(checkbox);

    expect(onTogglePermission).toHaveBeenCalledWith('invoices.create', false);
  });

  it('filters the visible permissions when the search input changes', () => {
    const widerCatalog = [
      ...permissionCatalog,
      {
        module: 'cash',
        label: 'Caja',
        permissions: [
          { name: 'cash.view', label: 'Ver caja' },
          { name: 'cash.open', label: 'Abrir caja' },
        ],
      },
    ];

    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={widerCatalog}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /crear facturas/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /abrir caja/i })).toBeInTheDocument();

    const search = screen.getByLabelText(/buscar permiso/i);
    fireEvent.change(search, { target: { value: 'abrir' } });

    expect(screen.queryByRole('checkbox', { name: /crear facturas/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /abrir caja/i })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'no-existe' } });
    expect(screen.getByText(/no se encontraron permisos/i)).toBeInTheDocument();
  });

  it('does not match technical permission slugs from the normal search box', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'settings',
            label: 'Configuracion',
            permissions: [
              criticalPermission('settings.operational.update', 'Editar reglas operativas'),
            ],
          },
        ]}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /editar reglas operativas/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/buscar permiso/i), {
      target: { value: 'settings.operational.update' },
    });

    expect(screen.queryByRole('checkbox', { name: /editar reglas operativas/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no se encontraron permisos/i)).toBeInTheDocument();
  });

  it('marks critical permissions with a visible risk label', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              criticalPermission('receipt_settings.advanced', 'Modo soporte tecnico de recibos'),
            ],
          },
        ]}
        selectedPermissions={[]}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /modo soporte tecnico de recibos/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/receipt_settings\.advanced/i)).not.toBeInTheDocument();
    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
  });

  it('uses backend risk metadata for permissions outside the local catalog names', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'support',
            label: 'Soporte',
            permissions: [
              {
                name: 'support.remote_unlock',
                label: 'Desbloquear soporte remoto',
                critical: true,
                risk_level: 'critical',
                risk_label: 'Permite habilitar soporte tecnico temporal.',
              },
            ],
          },
        ]}
        selectedPermissions={['support.remote_unlock']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    expect(screen.getAllByText(/habilitar soporte tecnico temporal/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /crear rol/i })).toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with critical permissions', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              criticalPermission('receipt_settings.advanced', 'Modo soporte tecnico de recibos'),
            ],
          },
        ]}
        selectedPermissions={['receipt_settings.advanced']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('enumerates critical permissions added and removed before confirmation', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={{
          id: 7,
          name: 'supervision_turno',
          protected: false,
          permissions: [{
            name: 'cash.close_any',
            module: 'cash',
            label: 'Cerrar cualquier caja',
            critical: true,
            risk_level: 'critical',
            risk_label: 'Puede cerrar cajas de otros usuarios.',
          }],
        }}
        permissionCatalog={[
          {
            module: 'cash',
            label: 'Caja',
            permissions: [
              criticalPermission('cash.close_any', 'Cerrar cualquier caja'),
              {
                ...criticalPermission('cash.open', 'Abrir caja'),
                risk_label: 'Permite iniciar una nueva sesión de caja.',
              },
            ],
          },
        ]}
        selectedPermissions={['cash.open']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    const added = screen.getByRole('region', { name: /permisos cr[ií]ticos añadidos/i });
    const removed = screen.getByRole('region', { name: /permisos cr[ií]ticos retirados/i });
    expect(added).toHaveTextContent(/abrir caja/i);
    expect(added).toHaveTextContent(/iniciar una nueva sesi[oó]n/i);
    expect(removed).toHaveTextContent(/cerrar cualquier caja/i);
    expect(removed).toHaveTextContent(/cerrar cajas de otros usuarios/i);
    expect(screen.getByRole('button', { name: /guardar rol/i })).toBeDisabled();
  });

  it('treats operational settings updates as critical permissions', () => {
    const onTogglePermission = vi.fn();

    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'settings',
            label: 'Configuracion',
            permissions: [
              criticalPermission('settings.operational.update', 'Editar reglas operativas'),
            ],
          },
        ]}
        selectedPermissions={['settings.operational.update']}
        onTogglePermission={onTogglePermission}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.queryByText(/settings\.operational\.update/i)).not.toBeInTheDocument();
    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear rol/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /editar reglas operativas/i }));
    expect(onTogglePermission).toHaveBeenCalledWith('settings.operational.update', false);
  });

  it('requires explicit confirmation before saving a role that can download backups', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'backups',
            label: 'Respaldos',
            permissions: [
              criticalPermission('backups.download', 'Descargar respaldos'),
            ],
          },
        ]}
        selectedPermissions={['backups.download']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with managerial report permissions', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'reports',
            label: 'Reportes',
            permissions: [
              criticalPermission('reports.managerial.view', 'Ver reportes gerenciales'),
              criticalPermission('reports.export', 'Exportar reportes'),
            ],
          },
        ]}
        selectedPermissions={['reports.managerial.view', 'reports.export']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getAllByText(/permiso critico/i)).toHaveLength(2);
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with audit permission', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'audit',
            label: 'Auditoria',
            permissions: [
              criticalPermission('audit.view', 'Ver auditoria'),
            ],
          },
        ]}
        selectedPermissions={['audit.view']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with operate-any invoice permission', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'invoices',
            label: 'Facturacion',
            permissions: [
              criticalPermission('invoices.operate_any', 'Operar cualquier factura'),
            ],
          },
        ]}
        selectedPermissions={['invoices.operate_any']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with fiscal sequence reset permission', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'fiscal',
            label: 'Fiscal',
            permissions: [
              criticalPermission('fiscal.sequences.reset', 'Reiniciar correlativo fiscal'),
            ],
          },
        ]}
        selectedPermissions={['fiscal.sequences.reset']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving a role with user disable permission', () => {
    render(
      <RoleFormDialog
        open
        onOpenChange={vi.fn()}
        editingRole={null}
        permissionCatalog={[
          {
            module: 'users',
            label: 'Usuarios',
            permissions: [
              criticalPermission('users.disable', 'Desactivar usuarios'),
            ],
          },
        ]}
        selectedPermissions={['users.disable']}
        onTogglePermission={vi.fn()}
        globalError={null}
        onSubmit={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /crear rol/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este rol necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });
});
