import { useCallback, useSyncExternalStore } from 'react';
import type { CashSession, ID } from '@/api/types';
import { nextShiftStep, shiftStepsFromSession, type ShiftSteps } from '@/ui/shift';
import { arqueoReady, EMPTY_ARQUEO, type ArqueoState } from './arqueo';

/**
 * The drawer count in progress, per cash session, shared by Caja (where it is
 * typed), the top-bar shift chip and Resumen so the shift brick says the same
 * thing everywhere. Survives reloads in sessionStorage (best effort).
 */

const KEY = (id: ID) => `shs:arqueo:${id}`;
const cache = new Map<string, ArqueoState>();
const listeners = new Set<() => void>();

function isArqueoState(v: unknown): v is ArqueoState {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.counts === 'object' &&
    o.counts !== null &&
    (o.coinsCents === null || typeof o.coinsCents === 'number') &&
    typeof o.confirmedZero === 'boolean'
  );
}

export function getArqueoDraft(id: ID | null | undefined): ArqueoState {
  if (id === null || id === undefined) return EMPTY_ARQUEO;
  const k = String(id);
  const hit = cache.get(k);
  if (hit) return hit;
  let value = EMPTY_ARQUEO;
  try {
    const raw = window.sessionStorage.getItem(KEY(id));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isArqueoState(parsed)) value = parsed;
    }
  } catch {
    /* storage unavailable: keep the empty count */
  }
  cache.set(k, value);
  return value;
}

export function setArqueoDraft(id: ID, state: ArqueoState): void {
  cache.set(String(id), state);
  try {
    if (state === EMPTY_ARQUEO) window.sessionStorage.removeItem(KEY(id));
    else window.sessionStorage.setItem(KEY(id), JSON.stringify(state));
  } catch {
    /* storage unavailable: the in-memory copy still works */
  }
  for (const l of listeners) l();
}

export function clearArqueoDraft(id: ID): void {
  setArqueoDraft(id, EMPTY_ARQUEO);
}

/** Test helper: forget every in-memory draft. */
export function resetArqueoDrafts(): void {
  cache.clear();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** [count, setCount] for one session, shared across the app. */
export function useArqueoDraft(id: ID | null | undefined): [ArqueoState, (next: ArqueoState) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => getArqueoDraft(id),
    () => EMPTY_ARQUEO,
  );
  const set = useCallback(
    (next: ArqueoState) => {
      if (id !== null && id !== undefined) setArqueoDraft(id, next);
    },
    [id],
  );
  return [value, set];
}

/**
 * The shift brick for a session: one derivation for the top bar, Resumen and Caja.
 * The arqueo quarter counts the drawer count typed in Caja (or the server's counted amount).
 */
export function useShiftSteps(session: CashSession | null | undefined): { steps: ShiftSteps; next: keyof ShiftSteps | null } {
  const open = session && session.status === 'open' ? session : null;
  const [draft] = useArqueoDraft(open?.id);
  const steps = shiftStepsFromSession(open, arqueoReady(draft));
  return { steps, next: nextShiftStep(steps) };
}
