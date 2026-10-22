/**
 * Clases compartidas de Configuración hospitalaria (identidad admin).
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const SELECT_CLASS = `${INPUT_CLASS} pr-1`;

export const TEXTAREA_CLASS = `min-h-20 w-full resize-y rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] aria-invalid:border-[var(--ui-danger)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const CHECKBOX_CLASS =
  'size-4 shrink-0 rounded-[3px] border border-[var(--ui-control-border)] accent-[var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ADMIN_TAG =
  'inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]';

export const STICKY_ACTIONS = 'sticky bottom-20 z-20 flex items-center justify-between gap-3 border-t border-[var(--ui-line)] bg-[var(--ui-surface)] p-3 lg:bottom-0';
