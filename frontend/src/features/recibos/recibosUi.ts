/**
 * Clases compartidas de la pantalla Recibos.
 *
 * Un solo idioma visual (dark institucional, identidad 2026-10-16): superficies
 * por niveles token-based (`--ui-*`), borde hairline estructural, radios
 * concéntricos, un único acento de acción y foco visible. No usa el lenguaje
 * R2 de tarjetas/pills, ni etiquetas claras sobre relleno de acción.
 *
 * La familia Recibos es una herramienta densa: barra de filtros compacta
 * (32 px), fila de tabla con una acción contextual principal y panel de detalle
 * con controles estándar (40 px). Los tamaños existen para que cada superficie
 * tenga la densidad que le corresponde, no para mezclarlas.
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/* -------------------------------------------------------------------------- */
/* Controles                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Contorno de control: los campos viven sobre `--ui-surface`. Usan
 * `--ui-control-border` (≥3:1 sobre surface/elevated, 1.4.11), nunca
 * `--ui-line` ni `--ui-line-strong`, que son estructura decorativa.
 */
export const COMPACT_INPUT_CLASS = `h-[var(--ui-control-h-compact)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-soft)] ${FOCUS_RING}`;

export const COMPACT_SELECT_CLASS = `${COMPACT_INPUT_CLASS} pr-1`;

/**
 * Marco que agrupa un rango (desde → hasta) en un solo control: dos campos
 * dentro de un único borde, sin dos cajas sueltas ni doble anillo de foco
 * (`data-ui-focus-frame` suprime el outline interior).
 */
export const RANGE_FRAME_CLASS =
  'flex h-[var(--ui-control-h-compact)] items-center gap-1 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]';

export const RANGE_INPUT_CLASS =
  'h-full min-w-0 bg-transparent text-[length:var(--ui-text-sm)] tabular-nums text-[color:var(--ui-ink)] outline-none';

/* -------------------------------------------------------------------------- */
/* Botones                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Acción primaria de la página (Buscar/Cobrar). Etiqueta sobre relleno de
 * acción SIEMPRE con `--ui-action-foreground`: en dark, blanco rinde 2.20
 * (FAIL AA) y la tinta oscura del token 8.03 (§1.3 identidad dark). El hover
 * sube luminancia (`--ui-action-hover`), nunca baja: el acento oscurecido
 * desaparece sobre paper/surface.
 */
export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[background-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[background-color,border-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/** Botones de la barra de filtros: misma altura que los controles (32 px). */
export const TOOLBAR_PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h-compact)] items-center justify-center gap-1.5 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action-foreground)] transition-[background-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

export const TOOLBAR_SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h-compact)] items-center justify-center gap-1.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)] transition-[background-color,border-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/**
 * Acción visible de la fila, en TODAS las filas: discreta (contorno de control)
 * para no competir con la acción principal de la página. El relleno sólido de
 * acento no se repite por registro aunque la acción contextual sea «Cobrar».
 */
export const ROW_ACTION_BUTTON = `inline-flex h-[var(--ui-control-h-compact)] shrink-0 items-center justify-center gap-1.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)] transition-[background-color,border-color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/**
 * Identidad de la fila (número de documento) como control de tabla: en tinta
 * principal con subrayado solo al pasar el puntero. No es un enlace azul
 * permanente que compita con las acciones.
 */
export const TABLE_IDENTITY_BUTTON = `rounded-[var(--ui-radius)] text-left font-semibold tabular-nums text-[color:var(--ui-ink)] underline-offset-4 transition-[color] duration-[120ms] ease-out enabled:hover:text-[color:var(--ui-action)] enabled:hover:underline ${FOCUS_RING}`;

/** Destructiva secundaria (contorno): texto y borde danger, sin relleno rojo. */
export const DANGER_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-danger)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-danger)] transition-[background-color,color,transform] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-surface-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

const ICON_BUTTON_BASE = `inline-flex shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] text-[color:var(--ui-ink-soft)] transition-[color,background-color] duration-[100ms] ease-out enabled:hover:bg-[var(--ui-surface-hover)] enabled:hover:text-[color:var(--ui-ink)] disabled:opacity-40 ${FOCUS_RING}`;

export const ICON_BUTTON = `size-8 ${ICON_BUTTON_BASE}`;

/** Variante táctil: 44×44 px para la lista móvil de Recibos (touch target ≥ 44 px). */
export const ICON_BUTTON_TOUCH = `size-11 ${ICON_BUTTON_BASE}`;

/**
 * Sello del estado «emisión sin cobro» (SINCOBRO): cero legal por regla. La
 * receta semántica del acento (§1.3/§5: tinte translúcido + texto action) y el
 * texto SIEMPRE acompaña (no-solo-color). Jamás danger: un cobro legítimo en
 * cero no es un error.
 */
export const STATUS_SINCOBRO_STAMP_CLASS =
  'border-[var(--ui-action-border)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]';

/* -------------------------------------------------------------------------- */
/* Tipografía de sección                                                      */
/* -------------------------------------------------------------------------- */

/** Etiqueta sobre el dato (cabecera de columna, campo de filtro, contexto). */
export const MICRO_LABEL =
  'text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]';

/** Título de sección dentro del panel de detalle. */
export const SECTION_TITLE = 'text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]';
