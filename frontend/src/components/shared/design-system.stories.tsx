import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import {
  CommandPanel,
  PrintPreviewFrame,
  SectionHeader,
  StatGrid,
  WorkflowPanel,
} from './design-system';

const meta: Meta = {
  title: 'Institutional/SharedComponents',
  parameters: { layout: 'padded' },
};

export default meta;

export const Header: StoryObj = {
  render: () => (
    <SectionHeader
      title="Facturación de paciente"
      description="Operación hospitalaria local."
      eyebrow="Operaciones de caja"
      actions={<Button type="primary">Nueva acción</Button>}
    />
  ),
};

export const Panels: StoryObj = {
  render: () => (
    <div className="flex max-w-4xl flex-col gap-6 p-4">
      <CommandPanel title="Filtros de búsqueda" description="Filtrar facturas por fecha o estado.">
        <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">Contenido del filtro</div>
      </CommandPanel>
      <WorkflowPanel title="Apertura de turno" description="Caja chica y saldo inicial." tone="info">
        <div className="p-4 text-sm text-foreground">Saldo inicial sugerido: L 500.00.</div>
      </WorkflowPanel>
    </div>
  ),
};

export const Statistics: StoryObj = {
  render: () => (
    <StatGrid
      items={[
        { label: 'Total facturado', value: 'L 24,500.00', helper: 'Hoy' },
        { label: 'Facturas emitidas', value: '142', helper: '120 pagadas' },
      ]}
    />
  ),
};

export const Printing: StoryObj = {
  render: () => (
    <PrintPreviewFrame title="Recibo institucional" description="Vista previa">
      <div className="border border-border bg-white p-8 font-serif text-slate-800">Contenido del recibo</div>
    </PrintPreviewFrame>
  ),
};
