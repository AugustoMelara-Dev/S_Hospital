/**
 * Clases compartidas de Respaldos (identidad "Panel administrativo").
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const DANGER_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-danger)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,opacity] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:opacity-90 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ICON_BUTTON = `inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink-soft)] transition-[color,background-color] duration-[100ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:hover:text-[color:var(--ui-ink)] disabled:opacity-55 ${FOCUS_RING}`;

export const ADMIN_TAG =
  'inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]';
