import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricsGlossary } from './MetricsGlossary';

describe('MetricsGlossary', () => {
  it('opens and closes the compact glossary dialog', () => {
    render(<MetricsGlossary compact />);

    fireEvent.click(screen.getByRole('button', { name: /definicion de metricas/i }));

    expect(screen.getByRole('dialog', { name: /definicion de metricas/i })).toBeInTheDocument();
    expect(screen.getByText(/facturas emitidas en el periodo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar glosario/i }));

    expect(screen.queryByRole('dialog', { name: /definicion de metricas/i })).not.toBeInTheDocument();
  });
});
