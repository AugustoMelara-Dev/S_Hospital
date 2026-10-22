/**
 * Clases del lenguaje "Panel administrativo" para la configuración de recibos.
 *
 * Solo este feature las usa: la identidad admin exige borde hairline, radios
 * concéntricos, un único acento de acción (`--ui-action`) y foco visible en
 * todo control. No se importan primitivas R2 (Card/Button/Input shadcn) para
 * que la pantalla no mezcle dos lenguajes visuales.
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--ui-danger)] ${FOCUS_RING}`;

export const SELECT_CLASS = `${INPUT_CLASS} pr-1`;

export const TEXTAREA_CLASS = `min-h-20 w-full resize-y rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--ui-danger)] ${FOCUS_RING}`;

export const CHECKBOX_CLASS =
  'size-4 shrink-0 rounded-[3px] border border-[var(--ui-control-border)] accent-[var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] disabled:cursor-not-allowed disabled:opacity-50';

/** Acción primaria de la pantalla: único acento de acción azul. La etiqueta NO
 * es blanco fijo: sobre relleno de acción `text-white` suspende AA en dark
 * (2.20). Se liga al token de etiqueta de relleno definido por la identidad;
 * mientras no exista, el fallback es `--ui-surface` (Equivalente en light:
 * blanco; en dark el proxy #111318 que documenta la identidad §1.3). */
export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground,var(--ui-surface))] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ICON_BUTTON = `inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-ink)] transition-[transform,background-color,color] duration-[100ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;
