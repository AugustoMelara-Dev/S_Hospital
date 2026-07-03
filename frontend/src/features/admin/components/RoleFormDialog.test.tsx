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
              {
                name: 'receipt_settings.advanced',
                label: 'Modo soporte tecnico de recibos',
              },
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
    expect(screen.getByText(/receipt_settings\.advanced/i)).toBeInTheDocument();
    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
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
              {
                name: 'receipt_settings.advanced',
                label: 'Modo soporte tecnico de recibos',
              },
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
              {
                name: 'backups.download',
                label: 'Descargar respaldos',
              },
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
});
