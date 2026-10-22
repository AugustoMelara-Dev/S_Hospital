/**
 * Controles de la identidad administrativa usados por Recibos/Historial y por
 * el cobro del POS. La superficie y la estructura del diálogo viven en el
 * `AdminDialog` compartido.
 *
 * Los tokens `--ui-*` se declaran en `:root`
 * (`design-system/admin/tokens.css`), así que resuelven también dentro del
 * portal de Radix.
 *
 * Solo presentación: no decide reglas fiscales ni de cobro.
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS =
  `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

export const TEXTAREA_CLASS =
  `min-h-[5.5rem] w-full min-w-0 resize-y rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

/** Botón primario administrativo (cobalto): reimprimir, guardar, confirmar historial.
 *  Comparte el token `--ui-action`; la distinción con `ACTION_BUTTON` es semántica
 *  (alcance operativo), no de color. */
export const PRIMARY_BUTTON =
  `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[background-color,transform] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/** Acento único de acción monetaria (cobalto): cobrar/confirmar cobro (altura operativa 44 px). */
export const ACTION_BUTTON =
  `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON =
  `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[background-color,border-color,transform] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/** Confirmación destructiva (anular/revertir): misma acción primaria en rojo admin.
 *  Etiqueta sobre relleno: tinta oscura del sistema (`--ui-action-foreground`):
 *  blanco sobre `#F87171` rinde 2.77 (FAIL AA); la tinta oscura 6.99 (verificado). */
export const DANGER_BUTTON =
  `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-danger)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[background-color,transform,opacity] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:opacity-90 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const LINK_CLASS =
  `rounded-[var(--ui-radius-control)] text-left font-semibold text-[color:var(--ui-action)] underline underline-offset-4 transition-colors duration-[120ms] ease-[var(--ui-ease-out)] enabled:hover:text-[color:var(--ui-action-hover)] ${FOCUS_RING}`;
