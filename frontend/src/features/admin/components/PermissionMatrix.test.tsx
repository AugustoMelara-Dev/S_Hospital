import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { PermissionMatrix } from './PermissionMatrix';

const roles: RoleDefinition[] = [
  {
    id: 1,
    name: 'cajero',
    protected: false,
    permissions: [
      { name: 'invoices.create', module: 'invoices', label: 'Crear facturas' },
      { name: 'cash.view', module: 'cash', label: 'Ver caja' },
    ],
  },
  {
    id: 2,
    name: 'auditor',
    protected: false,
    permissions: [{ name: 'audit.view', module: 'audit', label: 'Ver auditoria' }],
  },
  {
    id: 3,
    name: 'catalog_manager',
    protected: false,
    permissions: [{ name: 'cash.view', module: 'cash', label: 'Ver caja' }],
  },
];

const catalog: PermissionCatalogGroup[] = [
  {
    module: 'invoices',
    label: 'Facturacion',
    permissions: [{ name: 'invoices.create', module: 'invoices', label: 'Crear facturas' }],
  },
  {
    module: 'cash',
    label: 'Caja',
    permissions: [{ name: 'cash.view', module: 'cash', label: 'Ver caja' }],
  },
  {
    module: 'audit',
    label: 'Auditoria',
    permissions: [
      {
        name: 'audit.view',
        module: 'audit',
        label: 'Ver auditoria',
        critical: true,
        risk_level: 'critical',
        risk_label: 'Permite revisar auditoria administrativa.',
      },
    ],
  },
];

describe('PermissionMatrix', () => {
  function openPermissionMatrix() {
    fireEvent.click(screen.getByRole('button', { name: /mostrar matriz de permisos/i }));
  }

  it('renders the matrix with all role columns and group sections', () => {
    const { container } = render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);

    expect(screen.getByRole('heading', { name: /matriz de permisos/i })).toBeInTheDocument();
    openPermissionMatrix();

    expect(container.querySelector('.ant-table')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: /matriz de permisos/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /cajero/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^auditor$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /facturacion/i })).toBeInTheDocument();
  });

  it('keeps role comparison collapsed until explicitly opened', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);

    expect(screen.queryByRole('rowheader', { name: /crear facturas invoices\.create/i })).not.toBeInTheDocument();

    openPermissionMatrix();

    expect(screen.getByRole('rowheader', { name: /^crear facturas$/i })).toBeInTheDocument();
    expect(screen.queryByText('invoices.create')).not.toBeInTheDocument();
  });

  it('marks granted and denied permissions with text, not color alone', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);
    openPermissionMatrix();

    const grantedCell = screen.getByLabelText('Cajero tiene Crear facturas');
    expect(grantedCell).toBeInTheDocument();
    expect(within(grantedCell).getByText('Si')).toBeInTheDocument();

    const deniedCell = screen.getByLabelText('Auditor no tiene Crear facturas');
    expect(deniedCell).toBeInTheDocument();
    expect(within(deniedCell).getByText('No')).toBeInTheDocument();
  });

  it('uses human role names in assistive labels', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);
    openPermissionMatrix();

    expect(screen.getByRole('columnheader', { name: /catalog manager/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Catalog Manager tiene Ver caja')).toBeInTheDocument();
    expect(screen.queryByLabelText('catalog_manager tiene Ver caja')).not.toBeInTheDocument();
  });

  it('marks critical permissions with a visible risk label', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);
    openPermissionMatrix();

    const auditPermission = screen.getByRole('rowheader', { name: /^ver auditoria\b/i });

    expect(within(auditPermission).getByText(/permiso critico/i)).toBeInTheDocument();
    expect(screen.queryByText('audit.view')).not.toBeInTheDocument();
  });

  it('uses backend risk metadata when rendering critical labels', () => {
    render(
      <PermissionMatrix
        roles={roles}
        permissionCatalog={[
          {
            module: 'support',
            label: 'Soporte',
            permissions: [
              {
                name: 'support.remote_unlock',
                module: 'support',
                label: 'Desbloquear soporte remoto',
                critical: true,
                risk_level: 'critical',
                risk_label: 'Permite habilitar soporte tecnico temporal.',
              },
            ],
          },
        ]}
      />,
    );
    openPermissionMatrix();

    const supportPermission = screen.getByRole('rowheader', { name: /^desbloquear soporte remoto\b/i });

    expect(within(supportPermission).getByText(/permiso critico/i)).toBeInTheDocument();
    expect(within(supportPermission).getByText(/habilitar soporte tecnico temporal/i)).toBeInTheDocument();
    expect(screen.queryByText('support.remote_unlock')).not.toBeInTheDocument();
  });

  it('returns null when no roles or catalog are provided', () => {
    const { container } = render(<PermissionMatrix roles={[]} permissionCatalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });
});
