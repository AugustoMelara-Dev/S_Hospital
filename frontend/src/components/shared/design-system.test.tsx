import { render, screen, within } from '@testing-library/react';
import { Search } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Button } from '../ui/button';
import {
  AppSurface,
  CashStatusCard,
  ChartCard,
  CommandPanel,
  InfoPanel,
  OperationalBanner,
  OfflineState,
  PageShell,
  PermissionBadge,
  PermissionState,
  PrintPreviewFrame,
  ReceiptDocumentShell,
  SectionHeader,
  StatGrid,
  WorkflowPanel,
} from './design-system';

describe('v1.2 shared design system components', () => {
  it('renders page and section structure with stable slots', () => {
    render(
      <AppSurface>
        <PageShell>
          <SectionHeader
            eyebrow="Caja local"
            title="Facturacion"
            description="Operacion diaria"
            actions={<Button>Nuevo recibo</Button>}
          />
        </PageShell>
      </AppSurface>,
    );

    expect(screen.getByText('Caja local').closest('[data-slot="section-header"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Facturacion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo recibo' })).toBeInTheDocument();
    expect(screen.getByText('Facturacion').closest('[data-slot="app-surface"]')).toHaveClass('bg-operational-bg');
    expect(screen.getByText('Facturacion').closest('[data-slot="page-shell"]')).toHaveClass('max-w-7xl');
  });

  it('keeps command, workflow and chart panels presentational', () => {
    render(
      <>
        <CommandPanel title="Busqueda" description="Filtros operativos" actions={<Button variant="secondary">Limpiar</Button>}>
          <label htmlFor="service-query">Servicio</label>
          <input id="service-query" />
        </CommandPanel>
        <WorkflowPanel
          title="Cobro"
          description="Paso de caja"
          tone="warning"
          status={<span>Pendiente</span>}
          footer="Validar antes de continuar"
        >
          <Button>Continuar</Button>
        </WorkflowPanel>
        <ChartCard title="Ingresos" description="Resumen visual">
          <div role="img" aria-label="Grafico de ingresos" />
        </ChartCard>
      </>,
    );

    expect(screen.getByLabelText('Servicio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument();
    expect(screen.getByText('Cobro').closest('[data-slot="workflow-panel"]')).toHaveClass('border-warning/40');
    expect(screen.getByText('Validar antes de continuar')).toBeInTheDocument();
    expect(screen.getByRole('figure')).toHaveAccessibleName('Ingresos');
    expect(screen.getByRole('img', { name: 'Grafico de ingresos' })).toBeInTheDocument();
  });

  it('renders operational states without encoding business rules', () => {
    render(
      <>
        <OperationalBanner
          title="Centro operativo"
          description="Estado general"
          meta="LAN"
          status={<span>Servidor local</span>}
        />
        <StatGrid
          items={[
            { label: 'Facturas', value: '12', helper: 'Emitidas hoy', icon: <Search data-icon aria-hidden="true" /> },
            { label: 'Pagos', value: 'L 1,250.00', tone: 'success' },
          ]}
        />
        <InfoPanel title="Atencion" description="Revisar informacion visible" tone="warning" />
        <PermissionBadge permission="users.view" state="granted">Usuarios</PermissionBadge>
        <PermissionState state="readonly" action={<Button variant="outline">Solicitar permiso</Button>} />
        <CashStatusCard status="open" amount="L 500.00" cashier="Caja 1" timestamp="2026-06-26 08:00" />
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Centro operativo' })).toBeInTheDocument();
    expect(screen.getByText('L 1,250.00')).toHaveClass('tabular-nums');
    expect(screen.getByRole('alert')).toHaveTextContent('Revisar informacion visible');
    expect(screen.getByText('Usuarios').closest('[data-slot="permission-badge"]')).toHaveAttribute('title', 'Permitido: users.view');
    expect(screen.getByRole('status')).toHaveTextContent('Solo lectura');
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(screen.getByText('L 500.00')).toHaveClass('tabular-nums');
  });

  it('uses polished Spanish copy for shared permission and offline states', () => {
    const { rerender } = render(<PermissionState state="denied" />);

    expect(screen.getByRole('status')).toHaveTextContent('Tu usuario no tiene permiso para esta acción.');

    rerender(<PermissionState state="readonly" />);
    expect(screen.getByRole('status')).toHaveTextContent('Puedes revisar esta información, pero no modificarla.');

    rerender(<PermissionState state="unavailable" />);
    expect(screen.getByRole('status')).toHaveTextContent('Acción no disponible');
    expect(screen.getByRole('status')).toHaveTextContent('La acción está bloqueada por el estado actual.');

    rerender(<OfflineState />);
    expect(screen.getByRole('alert')).toHaveTextContent('Verifique la conexion local con el servidor antes de continuar.');
  });

  it('wraps receipt preview with print-safe hooks and format metadata', () => {
    const { container } = render(
      <PrintPreviewFrame title="Recibo institucional" description="Formato carta" actions={<Button>Imprimir vista</Button>}>
        <ReceiptDocumentShell format="half-letter" title="Hospital San Isidro">
          <p>Paciente: Maria Lopez</p>
        </ReceiptDocumentShell>
      </PrintPreviewFrame>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Recibo institucional' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir vista' })).toBeInTheDocument();
    expect(screen.getByText('Hospital San Isidro')).toHaveClass('hospital-name');

    const receipt = container.querySelector('[data-slot="receipt-document-shell"]');
    expect(receipt).toHaveAttribute('data-receipt-format', 'half-letter');
    expect(receipt).toHaveAttribute('data-receipt-print-root');
    expect(receipt).toHaveClass('institutional-receipt', 'receipt-half-letter', 'border-receipt-border');

    const preview = container.querySelector('[data-slot="print-preview-frame"]');
    expect(preview).toHaveClass('bg-operational-panel');
    expect(within(preview as HTMLElement).getByText('Paciente: Maria Lopez')).toBeInTheDocument();
  });
});
