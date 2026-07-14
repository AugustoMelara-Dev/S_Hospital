import { SearchOutlined } from '@ant-design/icons';
import { render, screen, within } from '@testing-library/react';
import { Button } from 'antd';
import { describe, expect, it } from 'vitest';
import {
  AppSurface,
  CommandPanel,
  PageShell,
  PrintPreviewFrame,
  SectionHeader,
  StatGrid,
  WorkflowPanel,
} from './design-system';

describe('shared design system components', () => {
  it('renders page and section structure with stable slots', () => {
    render(
      <AppSurface>
        <PageShell>
          <SectionHeader eyebrow="Caja local" title="Facturacion" description="Operacion diaria" actions={<Button>Nuevo recibo</Button>} />
        </PageShell>
      </AppSurface>,
    );

    expect(screen.getByText('Caja local').closest('[data-slot="section-header"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Facturacion' })).toBeInTheDocument();
    expect(screen.getByText('Facturacion').closest('[data-slot="app-surface"]')).toHaveClass('bg-background');
  });

  it('keeps command, workflow and statistics panels presentational', () => {
    render(
      <>
        <CommandPanel title="Busqueda" description="Filtros operativos" actions={<Button>Limpiar</Button>}>
          <label htmlFor="service-query">Servicio</label>
          <input id="service-query" />
        </CommandPanel>
        <WorkflowPanel title="Cobro" tone="warning" footer="Validar antes de continuar">
          <Button>Continuar</Button>
        </WorkflowPanel>
        <StatGrid items={[{ label: 'Facturas', value: '12', helper: 'Emitidas hoy', icon: <SearchOutlined /> }]} />
      </>,
    );

    expect(screen.getByLabelText('Servicio')).toBeInTheDocument();
    expect(screen.getByText('Cobro').closest('[data-slot="workflow-panel"]')).toHaveClass('border-warning/40');
    expect(screen.getByText('12')).toHaveClass('tabular-nums');
  });

  it('keeps print preview actions outside its viewport content', () => {
    const { container } = render(
      <PrintPreviewFrame title="Recibo institucional" actions={<Button>Imprimir vista</Button>}>
        <p>Paciente: Maria Lopez</p>
      </PrintPreviewFrame>,
    );

    const preview = container.querySelector('[data-slot="print-preview-frame"]');
    expect(preview).toHaveClass('bg-muted');
    expect(within(preview as HTMLElement).getByText('Paciente: Maria Lopez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir vista' })).toBeInTheDocument();
  });
});
