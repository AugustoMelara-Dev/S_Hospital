import { render, screen, within } from '@testing-library/react';
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
];

describe('PermissionMatrix', () => {
  it('renders the matrix with all role columns and group sections', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);

    expect(screen.getByRole('heading', { name: /matriz de permisos/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /cajero/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /auditor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /facturacion/i })).toBeInTheDocument();
  });

  it('marks granted and denied permissions with text, not color alone', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);

    const grantedCell = screen.getByLabelText('Cajero tiene Crear facturas');
    expect(grantedCell).toBeInTheDocument();
    expect(within(grantedCell).getByText('Si')).toBeInTheDocument();

    const deniedCell = screen.getByLabelText('Auditor no tiene Crear facturas');
    expect(deniedCell).toBeInTheDocument();
    expect(within(deniedCell).getByText('No')).toBeInTheDocument();
  });

  it('uses human role names in assistive labels', () => {
    render(<PermissionMatrix roles={roles} permissionCatalog={catalog} />);

    expect(screen.getByRole('columnheader', { name: /catalog manager/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Catalog Manager tiene Ver caja')).toBeInTheDocument();
    expect(screen.queryByLabelText('catalog_manager tiene Ver caja')).not.toBeInTheDocument();
  });

  it('returns null when no roles or catalog are provided', () => {
    const { container } = render(<PermissionMatrix roles={[]} permissionCatalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });
});
