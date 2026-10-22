/**
 * Clases compartidas del Catálogo institucional.
 *
 * Un solo idioma visual (admin "Panel administrativo"): borde hairline, radios
 * concéntricos, un único acento de acción (`--ui-action`) para la acción
 * primaria de la pantalla y cromo neutro para el resto. Foco visible
 * siempre presente y feedback táctil de presión con `scale(0.96)`.
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const SELECT_CLASS = `${INPUT_CLASS} pr-1`;

export const TEXTAREA_CLASS = `min-h-20 w-full resize-y rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] aria-invalid:border-[var(--ui-danger)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const CHECKBOX_CLASS =
  'size-4 shrink-0 rounded-[3px] border border-[var(--ui-control-border)] accent-[var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/** Acción primaria de la pantalla: relleno de acción único y etiqueta oscura
 * del sistema (`--ui-action-foreground`): texto blanco rinde 2.20 sobre relleno
 * cobalto en dark y suspende AA (§1.3, regla 2). */
export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const DANGER_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-danger)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,opacity] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:opacity-90 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const ICON_BUTTON = `inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink-soft)] transition-[color,background-color,transform] duration-[100ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-alt)] enabled:hover:text-[color:var(--ui-ink)] enabled:active:scale-[0.96] disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/**
 * Columna de acciones fijada al borde derecho de la tabla (`position: sticky`).
 *
 * A 1366 px el listado ya desplaza en horizontal cuando la categoría o el área
 * son largas; sin fijar la última columna, «Acciones» quedaba fuera de vista y
 * el menú por fila era inalcanzable. La celda fijada pinta su propio fondo
 * opaco (el mismo del encabezado) para cubrir el contenido que pasa por debajo
 * y un hairline la separa del resto: se lee como columna de mando, no como
 * una fila resaltada.
 */
export const PINNED_ACTIONS_CELL =
  'sticky right-0 z-[2] border-l border-[var(--ui-line)] bg-[var(--ui-surface-alt)]';

export const LINK_BUTTON = `rounded-[var(--ui-radius-control)] text-left font-semibold text-[color:var(--ui-action)] underline underline-offset-4 transition-colors duration-[120ms] ease-[var(--ui-ease-out)] enabled:hover:text-[color:var(--ui-action-active)] ${FOCUS_RING}`;
