import { SearchOutlined } from '@ant-design/icons';
import { render, screen, within } from '@testing-library/react';
import { Button } from 'antd';
import { describe, expect, it } from 'vitest';
import { PrintPreviewFrame, StatGrid } from './InstitutionalComponents';

describe('shared design system components', () => {
  it('keeps statistics presentational', () => {
    const { container } = render(
      <StatGrid items={[{ label: 'Facturas', value: '12', helper: 'Emitidas hoy', icon: <SearchOutlined /> }]} />,
    );

    expect(container.querySelector('[data-slot="stat-grid-item"]')).toHaveClass('ant-card');
    expect(container.querySelector('.ant-statistic')).toBeInTheDocument();
    expect(screen.getByText('12')).toHaveClass('tabular-nums');
  });

  it('keeps print preview actions outside its viewport content', () => {
    const { container } = render(
      <PrintPreviewFrame title="Recibo institucional" actions={<Button>Imprimir vista</Button>}>
        <p>Paciente: Maria Lopez</p>
      </PrintPreviewFrame>,
    );

    const preview = container.querySelector('[data-slot="print-preview-frame"]');
    expect(preview).toHaveClass('ant-card');
    expect(preview).toHaveClass('bg-muted');
    expect(within(preview as HTMLElement).getByText('Paciente: Maria Lopez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir vista' })).toBeInTheDocument();
  });
});
