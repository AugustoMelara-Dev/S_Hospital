/**
 * Clases y lecturas de estado compartidas por la estación Cobrar.
 *
 * Un solo idioma visual (panel administrativo). Aquí viven las anatomías que
 * varias zonas comparten: el control de cantidad continuo, la fila-acción del
 * catálogo y el tinte de estado de la barra de total/acción. Los estados se
 * distinguen por color + etiqueta (nunca solo por movimiento).
 */

import type { AdminStatus } from '@/design-system/admin/components';
import type { CobrarStatus, CobrarStatusCode } from '../state/status';

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] ${FOCUS_RING}`;

export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ICON_BUTTON = `inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink-soft)] transition-[color,background-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-alt)] enabled:hover:text-[color:var(--ui-ink)] enabled:active:scale-[0.96] disabled:opacity-40 motion-reduce:transition-none ${FOCUS_RING}`;

export const ICON_BUTTON_COMPACT = ICON_BUTTON;

/** Acción textual dentro de una barra (reintentar valoración). */
export const LINK_BUTTON = `inline-flex items-center gap-1 rounded-[var(--ui-radius)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-action)] underline decoration-[var(--ui-action-subtle-strong)] underline-offset-2 transition-[background-color,color] duration-[100ms] ease-out hover:bg-[var(--ui-action-subtle)] hover:decoration-current ${FOCUS_RING}`;

/* -------------------------------------------------------------------------- */
/* Catálogo: fila de selección (un solo control por resultado)                 */
/* -------------------------------------------------------------------------- */

export const PICK_ROW = `group flex w-full items-center gap-3 px-3 py-2 text-left outline-none transition-[background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ui-focus)]`;

export const PICK_ROW_GLYPH =
  'flex size-7 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] text-[color:var(--ui-ink-soft)] transition-[background-color,border-color,color] duration-[var(--ui-duration-state)] ease-out group-hover:border-[var(--ui-action-subtle-strong)] group-hover:bg-[var(--ui-action-subtle)] group-hover:text-[color:var(--ui-action)]';

/* -------------------------------------------------------------------------- */
/* Cantidad: un control continuo, no tres cajas sueltas                        */
/* -------------------------------------------------------------------------- */

export const STEPPER =
  'inline-flex h-10 items-stretch overflow-hidden rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] [@media(pointer:coarse)]:h-11';

export const STEPPER_BUTTON = `inline-flex w-10 shrink-0 items-center justify-center text-[color:var(--ui-ink-soft)] outline-none transition-[background-color,color] duration-[100ms] ease-out enabled:hover:bg-[var(--ui-surface-alt)] enabled:hover:text-[color:var(--ui-ink)] disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ui-focus)] [@media(pointer:coarse)]:w-11`;

export const STEPPER_INPUT =
  'w-[5.5rem] min-w-0 border-x border-[var(--ui-line)] bg-transparent px-1 text-center text-[length:var(--ui-text-base)] tabular-nums text-[color:var(--ui-ink)] outline-none focus-visible:bg-[var(--ui-action-subtle)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/* -------------------------------------------------------------------------- */
/* Estado del recorrido                                                        */
/* -------------------------------------------------------------------------- */

export type CobrarStateTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'free';

/**
 * Tinte del estado del recorrido. `listo` usa el acento cobalto (accionable);
 * los bloqueos usan warn/danger; la gratuidad usa el acento canónico o neutro.
 */
export function cobrarStateTone(code: CobrarStatusCode): CobrarStateTone {
  switch (code) {
    case 'listo':
    case 'emitiendo':
      return 'accent';
    case 'pagado':
      return 'success';
    case 'sin_cobro':
    case 'emitido_sin_cobro':
      return 'free';
    case 'servidor_no_disponible':
      return 'danger';
    case 'invalido':
    case 'pendiente_cobro':
      return 'warn';
    case 'calculando':
    case 'borrador':
    default:
      return 'neutral';
  }
}

export const STATE_BORDER_TOP: Record<CobrarStateTone, string> = {
  neutral: 'border-t-[var(--ui-line-strong)]',
  accent: 'border-t-[var(--ui-action)]',
  success: 'border-t-[var(--ui-success)]',
  warn: 'border-t-[var(--ui-warn)]',
  danger: 'border-t-[var(--ui-danger)]',
  free: 'border-t-[var(--ui-action)]',
};

export const STATE_TEXT: Record<CobrarStateTone, string> = {
  neutral: 'text-[color:var(--ui-ink-soft)]',
  accent: 'text-[color:var(--ui-action)]',
  success: 'text-[color:var(--ui-success)]',
  warn: 'text-[color:var(--ui-warn)]',
  danger: 'text-[color:var(--ui-danger)]',
  free: 'text-[color:var(--ui-action)]',
};

/** Etiqueta de estado del panel (una sola lectura para cabecera y resultado). */
export function cobrarStamp(status: CobrarStatus): { status: AdminStatus; label?: string } {
  switch (status.code) {
    case 'pagado':
      return { status: 'cobrado' };
    case 'emitido_sin_cobro':
      return { status: 'gratuito' };
    case 'sin_cobro':
      return { status: 'gratuito', label: 'Sin cobro' };
    case 'listo':
      return { status: 'listo' };
    case 'emitiendo':
      return { status: 'valorada', label: 'Emitiendo…' };
    case 'pendiente_cobro':
      return { status: 'valorada', label: 'Pendiente de cobro' };
    case 'calculando':
      return { status: 'borrador', label: 'Calculando…' };
    case 'servidor_no_disponible':
      return { status: 'borrador', label: 'No se pudo confirmar el total' };
    case 'invalido':
      return { status: 'borrador', label: 'Revise la cuenta' };
    case 'borrador':
    default:
      return { status: 'borrador' };
  }
}
