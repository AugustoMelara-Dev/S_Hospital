import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CashSession } from '@/api/types';
import { ShiftTile } from './ShiftTile';
import { StatusStamp } from './Badge';
import { nextShiftStep, shiftStepsFromSession } from './shift';

const session = (over: Partial<CashSession> & { can_close?: boolean; count?: number }) =>
  ({
    status: 'open',
    payments_count: 0,
    reconciliation: { payments_count: over.count ?? 0, can_close: over.can_close ?? false, blockers: [] },
    ...over,
  }) as unknown as CashSession;

describe('shift steps', () => {
  it('derives the quarters from the current session', () => {
    expect(shiftStepsFromSession(null)).toEqual({ apertura: false, cobros: false, arqueo: false, cierre: false });
    expect(shiftStepsFromSession(session({}))).toEqual({ apertura: true, cobros: false, arqueo: false, cierre: false });
    const s = shiftStepsFromSession(session({ count: 3, can_close: true }), true);
    expect(s).toEqual({ apertura: true, cobros: true, arqueo: true, cierre: false });
    expect(nextShiftStep(s)).toBe('cierre');
  });

  it('does not fill Arqueo without a cash count, even when the session can close', () => {
    const s = shiftStepsFromSession(session({ count: 3, can_close: true }));
    expect(s.arqueo).toBe(false);
    expect(nextShiftStep(s)).toBe('arqueo');
  });

  it('fills quarters in order: no Arqueo before any Cobro', () => {
    const s = shiftStepsFromSession(session({ count: 0, can_close: true }), true);
    expect(s).toEqual({ apertura: true, cobros: false, arqueo: false, cierre: false });
    expect(nextShiftStep(s)).toBe('cobros');
  });

  it("counts the server's counted amount as an arqueo", () => {
    const s = shiftStepsFromSession(session({ count: 2, counted_cents: 5000 }));
    expect(s.arqueo).toBe(true);
  });

  it('labels the tile in words', () => {
    render(<ShiftTile steps={{ apertura: true, cobros: true, arqueo: false, cierre: false }} />);
    expect(
      screen.getByRole('img', { name: 'Turno: Apertura completado, Cobros completado, Arqueo pendiente, Cierre pendiente' }),
    ).toBeInTheDocument();
  });
});

describe('StatusStamp', () => {
  it('keeps the label next to the shape glyph', () => {
    render(<StatusStamp status="void" />);
    expect(screen.getByText('Anulada')).toBeInTheDocument();
  });
});
