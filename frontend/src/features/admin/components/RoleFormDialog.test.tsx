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
});