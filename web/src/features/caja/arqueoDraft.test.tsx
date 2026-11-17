import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { CashSession } from '@/api/types';
import { getArqueoDraft, resetArqueoDrafts, setArqueoDraft, useShiftSteps } from './arqueoDraft';
import { EMPTY_ARQUEO } from './arqueo';

const session = { id: 7, status: 'open', payments_count: 2, counted_cents: null, reconciliation: { payments_count: 2 } } as unknown as CashSession;

afterEach(() => {
  window.sessionStorage.clear();
  resetArqueoDrafts();
});

describe('arqueo draft store', () => {
  it('shares the count between readers and drives the arqueo quarter', () => {
    const { result } = renderHook(() => useShiftSteps(session));
    expect(result.current.next).toBe('arqueo');
    act(() => setArqueoDraft(7, { counts: { 100: 2 }, coinsCents: null, confirmedZero: false }));
    expect(result.current.steps.arqueo).toBe(true);
    expect(result.current.next).toBe('cierre');
  });

  it('persists to sessionStorage and restores after a reload', () => {
    setArqueoDraft(7, { ...EMPTY_ARQUEO, confirmedZero: true });
    resetArqueoDrafts();
    expect(getArqueoDraft(7).confirmedZero).toBe(true);
  });
});
