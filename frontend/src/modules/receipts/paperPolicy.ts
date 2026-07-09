export const INSTITUTIONAL_PAPER_OPTIONS = [
  { value: 'letter', label: 'Carta' },
  { value: 'half_letter', label: 'Media carta' },
  { value: 'a5', label: 'A5' },
] as const;

export type InstitutionalPaper = (typeof INSTITUTIONAL_PAPER_OPTIONS)[number]['value'];

const HISTORICAL_THERMAL_VALUES = new Set(['80mm', '58mm']);

export function isLegacyThermalPaper(value: unknown): boolean {
  return typeof value === 'string' && HISTORICAL_THERMAL_VALUES.has(value);
}

export function normalizeInstitutionalPaper(value: unknown): InstitutionalPaper {
  const match = INSTITUTIONAL_PAPER_OPTIONS.find((option) => option.value === value);
  return match?.value ?? 'half_letter';
}
