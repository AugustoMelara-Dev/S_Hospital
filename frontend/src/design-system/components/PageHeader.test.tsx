import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders one institutional level-one heading with description and actions', () => {
    render(
      <PageHeader
        eyebrow="Operación local"
        title="Nueva factura"
        description="Seleccione servicios y cobre desde la caja activa."
        actions={<Button>Acción</Button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva factura' })).toBeInTheDocument();
    expect(screen.getByText('Operación local')).toBeInTheDocument();
    expect(screen.getByText('Seleccione servicios y cobre desde la caja activa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });
});
