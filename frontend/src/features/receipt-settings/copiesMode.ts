/**
 * Canonical copies-mode catalog for institutional receipt settings.
 *
 * `copies_mode` is persisted by the backend as one of a fixed enum. The settings
 * form, the copies stat card and the engine preview must all agree on the same
 * value set; this module is the only place that maps it to a human label and
 * detects an unrecognized persisted value.
 *
 * The copy COUNT is NOT derived here for display: the backend engine
 * (`InstitutionalReceiptHtmlBuilder::copyLabels()/copyCount()`) is the single
 * source of truth and exposes it through `/test-preview` as `copy_count` /
 * `copy_labels`. `copyLabelsForMode` below is only a transient first-render
 * fallback and must never be presented as a confirmed count.
 */

export type CopiesMode = 'original_only' | 'original_first' | 'original_first_second';

export type CopiesModeOption = {
  value: CopiesMode;
  label: string;
  description: string;
};

export const COPIES_MODE_OPTIONS: readonly CopiesModeOption[] = [
  {
    value: 'original_only',
    label: 'Solo original',
    description: 'Un solo ejemplar (el original). No incluye copias adicionales.',
  },
  {
    value: 'original_first',
    label: 'Original + primera copia',
    description: 'Incluye el original y una primera copia.',
  },
  {
    value: 'original_first_second',
    label: 'Original + dos copias',
    description: 'Incluye el original, una primera copia y una segunda copia.',
  },
] as const;

const COPIES_MODE_VALUES = COPIES_MODE_OPTIONS.map((option) => option.value);

/**
 * True only for a value that belongs to the persisted enum. Anything else
 * (undefined, null, a future server value, legacy data) is rejected so the form
 * can surface a recoverable error instead of rendering an empty control.
 */
export function isCopiesMode(value: unknown): value is CopiesMode {
  return typeof value === 'string' && (COPIES_MODE_VALUES as readonly string[]).includes(value);
}

export function normalizeCopiesMode(value: unknown): CopiesMode | null {
  return isCopiesMode(value) ? value : null;
}

export function copiesModeLabel(value: CopiesMode): string {
  return COPIES_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/**
 * Human description of an unrecognized persisted value, used in the recoverable
 * error message. Never interpolates HTML; it is shown as text.
 */
export function describeUnknownCopiesMode(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'el perfil guardado no informa un modo de copias';
  }

  return `el perfil guardado usa un valor no reconocido (${String(value)})`;
}

/**
 * Transient fallback labels for the very first render only. The engine response
 * always wins; see `ReceiptSettingsPreview`.
 */
export function copyLabelsForMode(mode: CopiesMode | null | undefined): string[] {
  if (mode === 'original_first') return ['ORIGINAL', 'PRIMERA COPIA'];
  if (mode === 'original_first_second') return ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'];

  return ['ORIGINAL'];
}
