/**
 * Clases compartidas de Caja (identidad dark institucional 2026-10-16).
 *
 * Un solo idioma visual: borde hairline, radios concéntricos, un único acento
 * de acción (`--ui-action`) para la acción primaria de la pantalla con etiqueta
 * `--ui-action-foreground` (nunca blanco: 2.20 FAIL en dark, 8.03 con el
 * token) y cromo neutro tinta/secundario para el resto. Hover del acento y de
 * los enlaces siempre MÁS CLARO (`--ui-action-hover`): en dark el acento
 * oscurecido desaparece. Foco visible siempre presente y feedback de presión
 * con `scale(0.96)` (better-ui/emil). No usa el lenguaje R2 de
 * tarjetas/pills/foco teal. Deshabilitado = opacidad 0.55 (identidad §5).
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const TEXTAREA_CLASS = `min-h-20 w-full resize-y rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] aria-invalid:border-[var(--ui-danger)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

/** Acción primaria de la pantalla: único acento de acción cobalto. */
export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ICON_BUTTON = `inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink-soft)] transition-[color,background-color] duration-[100ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:hover:text-[color:var(--ui-ink)] disabled:opacity-55 ${FOCUS_RING}`;

/* Enlaces: hover más claro (regla dark del acento); el alias `--ui-navy*` no
   recibe nuevos usos, así que los enlaces leen directamente `--ui-action*`. */
export const LINK_BUTTON = `rounded-[var(--ui-radius-control)] text-left font-semibold text-[color:var(--ui-action)] underline underline-offset-4 transition-colors duration-[120ms] ease-[var(--ui-ease-out)] enabled:hover:text-[color:var(--ui-action-hover)] ${FOCUS_RING}`;

export const LINK_INLINE = `rounded-[var(--ui-radius-control)] font-medium text-[color:var(--ui-action)] underline underline-offset-4 transition-colors duration-[120ms] ease-[var(--ui-ease-out)] hover:text-[color:var(--ui-action-hover)] ${FOCUS_RING}`;
