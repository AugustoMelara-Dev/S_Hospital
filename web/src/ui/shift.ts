import type { CashSession } from '@/api/types';

/** The four quarters of a cashier's shift, in order. */
export type ShiftSteps = { apertura: boolean; cobros: boolean; arqueo: boolean; cierre: boolean };

export const SHIFT_STEP_ORDER = ['apertura', 'cobros', 'arqueo', 'cierre'] as const;

export const SHIFT_STEP_LABEL: Record<keyof ShiftSteps, string> = {
  apertura: 'Apertura',
  cobros: 'Cobros',
  arqueo: 'Arqueo',
  cierre: 'Cierre',
};

export const NO_SHIFT: ShiftSteps = { apertura: false, cobros: false, arqueo: false, cierre: false };

/**
 * Derives the shift steps from GET /cash-sessions/current plus whether the drawer
 * has been counted. Quarters fill strictly in order; one can never be done while
 * an earlier one is pending:
 *   apertura = session open
 *   cobros   = at least one payment registered
 *   arqueo   = cobros done and the cash was actually counted (`counted`, or the
 *              server's counted_cents)
 *   cierre   = false while open (the session is gone once closed)
 * Without an open session every quarter is empty.
 */
export function shiftStepsFromSession(session: CashSession | null | undefined, counted = false): ShiftSteps {
  if (!session || session.status !== 'open') return NO_SHIFT;
  const payments = session.reconciliation?.payments_count ?? session.payments_count ?? 0;
  const apertura = true;
  const cobros = apertura && payments > 0;
  const arqueo = cobros && (counted || session.counted_cents != null);
  return { apertura, cobros, arqueo, cierre: false };
}

/** First pending step ("Sigue: Arqueo"), or null when all are done. */
export function nextShiftStep(steps: ShiftSteps): keyof ShiftSteps | null {
  return SHIFT_STEP_ORDER.find((k) => !steps[k]) ?? null;
}

/** "Turno: Apertura completado, Cobros completado, Arqueo pendiente, Cierre pendiente". */
export function shiftLabel(steps: ShiftSteps): string {
  return `Turno: ${SHIFT_STEP_ORDER.map((k) => `${SHIFT_STEP_LABEL[k]} ${steps[k] ? 'completado' : 'pendiente'}`).join(', ')}`;
}
