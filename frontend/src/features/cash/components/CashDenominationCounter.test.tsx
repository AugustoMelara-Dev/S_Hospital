import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cashDenominationTotalCents,
  CashDenominationCounter,
  createEmptyDenominationCounts,
  hasCashDenominationCount,
  isZeroCashCountConfirmed,
  type DenominationCounts,
} from './CashDenominationCounter';

afterEach(() => {
  cleanup();
});

function countsWith(overrides: Partial<DenominationCounts>): DenominationCounts {
  return { ...createEmptyDenominationCounts(), ...overrides };
}

function renderCounter(props: {
  counts?: DenominationCounts;
  expectedAmount?: string | null;
  otherAmount?: string;
} = {}) {
  const onCountChange = vi.fn();
  const onOtherAmountChange = vi.fn();
  const onConfirmZero = vi.fn();

  render(
    <CashDenominationCounter
      counts={props.counts ?? createEmptyDenominationCounts()}
      expectedAmount={props.expectedAmount ?? '500.00'}
      otherAmount={props.otherAmount ?? ''}
      onConfirmZero={onConfirmZero}
      onContinue={vi.fn()}
      onCountChange={onCountChange}
      onOtherAmountChange={onOtherAmountChange}
      onReset={vi.fn()}
    />,
  );

  return { onCountChange, onOtherAmountChange, onConfirmZero };
}

describe('CashDenominationCounter — T-UI-23 ausente ≠ cero', () => {
  it('sin conteo ingresado muestra "Pendiente" y nunca L 0.00', () => {
    renderCounter();

    const total = screen.getByRole('status', { name: /total contado por denominaciones/i });
    expect(total).toHaveTextContent('Pendiente');
    expect(total).not.toHaveTextContent(/L\.\s*0\.00/);

    // Un placeholder «0» parecía un conteo ya introducido: 0 ≠ no contado,
    // así que el campo vacío usa el glifo de ausencia del producto.
    expect(screen.getByLabelText(/cantidad de billetes de L 500/i)).toHaveAttribute('placeholder', '—');

    // La diferencia tampoco se calcula contra un cero implícito.
    expect(screen.getByText('Diferencia').closest('div')).toHaveTextContent('Pendiente');
    expect(screen.getByRole('button', { name: /continuar al cierre/i })).toBeDisabled();
  });

  it('con conteo parcial suma solo lo ingresado en centavos exactos', () => {
    renderCounter({
      counts: countsWith({ 50: '2', 20: '1' }),
      expectedAmount: '200.00',
    });

    const total = screen.getByRole('status', { name: /total contado por denominaciones/i });
    // 50×2 + 20×1 = L 120.00 → 12_000 centavos.
    expect(total).toHaveTextContent(/L\.\s*120\.00/);
    expect(total).not.toHaveTextContent('Pendiente');
  });

  it('suma el campo "Monedas y otros" con precisión de centavos', () => {
    renderCounter({
      counts: countsWith({ 20: '3' }),
      otherAmount: '0.55',
    });

    const total = screen.getByRole('status', { name: /total contado por denominaciones/i });
    // 20×3 = 6000 centavos + 55 centavos = 6055 → L 60.55.
    expect(total).toHaveTextContent(/L\.\s*60\.55/);
    expect(cashDenominationTotalCents(countsWith({ 20: '3' }), '0.55')).toBe(6055);
  });

  it('un cero explícito del operador sí es un cero legítimo', () => {
    renderCounter({ counts: countsWith({ 100: '0' }), expectedAmount: '100.00' });

    const total = screen.getByRole('status', { name: /total contado por denominaciones/i });
    expect(total).toHaveTextContent(/L\.\s*0\.00/);
    // Con un cero contado la diferencia sí se calcula: 0 - 100 = -L 100.00.
    expect(screen.getByText('Diferencia').closest('div')).toHaveTextContent(/-?\s*L\.\s*100\.00/);
  });

  it('hasCashDenominationCount distingue ausente de cero', () => {
    expect(hasCashDenominationCount(createEmptyDenominationCounts(), '')).toBe(false);
    expect(hasCashDenominationCount(createEmptyDenominationCounts(), '   ')).toBe(false);
    expect(hasCashDenominationCount(countsWith({ 500: '1' }), '')).toBe(true);
    expect(hasCashDenominationCount(createEmptyDenominationCounts(), '12.00')).toBe(true);
    expect(hasCashDenominationCount(countsWith({ 500: '0' }), '')).toBe(true);
  });

  it('distingue conteo en cero confirmado de conteo no realizado', () => {
    const { onConfirmZero } = renderCounter();

    // No realizado: sin cantidades y sin monto, el estado lo declara.
    expect(screen.getByText(/conteo no realizado/i)).toBeInTheDocument();
    expect(screen.queryByText(/conteo en cero confirmado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /total contado por denominaciones/i }))
      .toHaveTextContent('Pendiente');

    fireEvent.click(screen.getByRole('button', { name: /confirmar conteo en cero/i }));
    expect(onConfirmZero).toHaveBeenCalledTimes(1);
    cleanup();

    // Cero confirmado: cantidades registradas en 0 → L 0.00 explícito.
    renderCounter({ counts: countsWith({ 500: '0' }), expectedAmount: '500.00' });
    expect(screen.getByText(/conteo en cero confirmado/i)).toBeInTheDocument();
    expect(screen.queryByText(/conteo no realizado/i)).not.toBeInTheDocument();
    expect(isZeroCashCountConfirmed(countsWith({ 500: '0' }), '')).toBe(true);
    expect(isZeroCashCountConfirmed(createEmptyDenominationCounts(), '')).toBe(false);
    expect(isZeroCashCountConfirmed(countsWith({ 500: '1' }), '')).toBe(false);
    expect(isZeroCashCountConfirmed(createEmptyDenominationCounts(), '0.00')).toBe(true);
  });

  it('al borrar el último conteo vuelve a "Pendiente"', () => {
    const { onCountChange } = renderCounter({ counts: countsWith({ 50: '2' }) });
    const input = screen.getByLabelText(/cantidad de billetes de L 50$/i);

    expect(screen.getByRole('status', { name: /total contado por denominaciones/i }))
      .toHaveTextContent(/L\.\s*100\.00/);

    fireEvent.change(input, { target: { value: '' } });
    expect(onCountChange).toHaveBeenCalledWith(50, '');
  });

  it('conserva el botón de continuar habilitado con conteo parcial', () => {
    renderCounter({ counts: countsWith({ 500: '1' }) });

    const output = screen.getByRole('status', { name: /total contado por denominaciones/i });
    expect(within(output).getByText(/L\.\s*500\.00/)).toBeVisible();
    expect(screen.getByRole('button', { name: /continuar al cierre/i })).toBeEnabled();
  });

  it('no inventa la diferencia cuando el efectivo esperado no es un importe válido', () => {
    renderCounter({ counts: countsWith({ 100: '1' }), expectedAmount: 'no-numero' });

    expect(screen.getByRole('status', { name: /total contado por denominaciones/i }))
      .toHaveTextContent(/L\.\s*100\.00/);
    expect(screen.getByText('Diferencia').closest('div')).toHaveTextContent('No disponible');
    expect(document.body.textContent).not.toMatch(/no-numero|\bNaN\b/);
  });
});
