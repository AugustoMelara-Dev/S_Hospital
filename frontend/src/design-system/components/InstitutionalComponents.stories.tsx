import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrintPreviewFrame, StatGrid } from './InstitutionalComponents';

const meta: Meta = {
  title: 'Institutional/SharedComponents',
  parameters: { layout: 'padded' },
};

export default meta;

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
      <div className="border border-receipt-border bg-receipt-paper p-8 font-serif text-receipt-ink">Contenido del recibo</div>
    </PrintPreviewFrame>
  ),
};
