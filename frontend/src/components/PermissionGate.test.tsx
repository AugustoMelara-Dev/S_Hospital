import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissionGate } from './PermissionGate';

describe('PermissionGate', () => {
  it('keeps a route-level heading when access is denied', () => {
    render(
      <PermissionGate allowed={false} reason="No puede consultar reportes.">
        <p>Contenido protegido</p>
      </PermissionGate>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Sin permisos' })).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });
});
