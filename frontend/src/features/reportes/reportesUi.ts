/**
 * Clases compartidas de la pantalla Reportes (identidad dark institucional
 * 2026-10-16 · `hospital-ai/diseno/IDENTIDAD_DARK_20261016.md`).
 *
 * Un solo idioma visual: superficie `--ui-surface`, límite de control
 * `--ui-control-border` (§1.1: `--ui-line`/`--ui-line-strong` son estructura
 * decorativa, nunca límite de control), acento cobalto `--ui-action`
 * exclusivo para la acción primaria («Aplicar») y su selector plegado, y
 * etiqueta `--ui-action-foreground` sobre relleno de acción (§1.3 regla 2:
 * blanco sobre cobalto falla AA en dark, 2.20). El hover sube luminancia
 * (`--ui-action-hover` / `--ui-surface-hover`), nunca baja (§1.3 regla 1).
 * Foco visible 2 px con `--ui-focus`, feedback táctil `scale(0.96)`,
 * deshabilitado a 0.55 (§5) y transiciones por propiedad exacta (sin
 * `transition: all`). Los fallbacks hex son los valores canónicos del
 * documento de identidad: aplican solo si el puente de tokens aún no declara
 * el token dark; cuando existe, el token manda. No se usan primitivas R2
 * (`bg-primary`/`ring-ring`) ni alias retirados (`--ui-navy*`).
 */

export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

export const INPUT_CLASS = `h-[var(--ui-control-h)] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border,#616A79)] bg-[var(--ui-surface,#111318)] px-2.5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink,#F5F7FA)] placeholder:text-[color:var(--ui-ink-soft,#A1A8B3)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const SELECT_CLASS = `${INPUT_CLASS} pr-1`;

/** Acción primaria de la pantalla: único relleno de acento, etiqueta dark-AA. */
export const PRIMARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action,#70A8FF)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground,#0B0E14)] transition-[background-color,transform] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-action-hover,#8FBAFF)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/** Acciones secundarias (exportar, reintentar, ampliar): borde de control + superficie. */
export const SECONDARY_BUTTON = `inline-flex h-[var(--ui-control-h)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border,#616A79)] bg-[var(--ui-surface,#111318)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink,#F5F7FA)] transition-[background-color,border-color,transform] duration-[140ms] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-hover,#14181F)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/** Control terciario de tabla («Ver todas»/«Ver menos»): acento textual. */
export const GHOST_BUTTON = `inline-flex items-center gap-1.5 rounded-[var(--ui-radius-control)] px-1.5 py-0.5 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action,#70A8FF)] transition-colors duration-[120ms] ease-[var(--ui-ease-out)] enabled:hover:text-[color:var(--ui-action-hover,#8FBAFF)] disabled:opacity-55 ${FOCUS_RING}`;

/**
 * Período rápido como control segmentado (no un `<select>`): el período es la
 * decisión principal del reporte y se lee de un vistazo. El activo usa el tinte
 * translúcido de acción; el resto queda neutro hasta hover (§1.3 regla 4).
 */
export const SEGMENT_GROUP =
  'inline-flex flex-wrap items-center gap-0.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border,#616A79)] bg-[var(--ui-surface,#111318)] p-0.5';

export const SEGMENT_BUTTON = `rounded-[var(--ui-radius)] px-2.5 py-1 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink-soft,#A1A8B3)] transition-colors duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] enabled:hover:bg-[var(--ui-surface-hover,#14181F)] enabled:hover:text-[color:var(--ui-ink,#F5F7FA)] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS_RING}`;

export const SEGMENT_BUTTON_ACTIVE =
  'bg-[var(--ui-action-subtle,#70A8FF24)] text-[color:var(--ui-action,#70A8FF)] enabled:hover:bg-[var(--ui-action-subtle,#70A8FF24)] enabled:hover:text-[color:var(--ui-action,#70A8FF)]';

/**
 * Plegable «Filtros» expandido: énfasis de selección con el tinte translúcido
 * de acción, el lenguaje por defecto de selección/énfasis en dark (§1.3 regla 4).
 */
export const FILTERS_TOGGLE_OPEN = 'border-[var(--ui-action-border,#70A8FF5C)] bg-[var(--ui-action-subtle,#70A8FF24)]';

/**
 * Línea gratuita / gratuidad en dark: cobalto con etiqueta textual explícita
 * (§2 del documento de identidad: el violeta de la identidad anterior queda
 * retirado; la gratuidad no es una segunda marca). El sello conserva el texto
 * de la regla que lo compone — nunca solo color.
 */
export const FREE_LINE_BADGE_CLASS =
  'border-[color:var(--ui-action-border,#70A8FF5C)] bg-[var(--ui-action-subtle,#70A8FF24)] text-[color:var(--ui-action,#70A8FF)]';
