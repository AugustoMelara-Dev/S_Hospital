import type { ReceiptPaperSize, ReceiptPrintProfile } from '../../lib/api/types';

export type InstitutionalPaper = Extract<ReceiptPaperSize, 'letter' | 'letter_portrait' | 'half_letter' | 'a5' | 'a4' | 'custom'>;
export type ThermalSupportPaper = Extract<ReceiptPaperSize, '80mm' | '58mm'>;

export type PaperChoiceDefinition = {
  value: InstitutionalPaper;
  label: string;
  description: string;
  group: 'institutional';
  aspectRatio: string;
};

export type ThermalSupportChoiceDefinition = {
  value: ThermalSupportPaper;
  label: string;
  description: string;
  group: 'compatibility';
};

export const PAPER_CHOICES = [
  {
    value: 'letter',
    label: 'Carta horizontal',
    description: 'Compatibilidad institucional apaisada.',
    group: 'institutional',
    aspectRatio: '11 / 8.5',
  },
  {
    value: 'letter_portrait',
    label: 'Carta vertical',
    description: 'Diseño principal propuesto: 215.9 × 279.4 mm.',
    group: 'institutional',
    aspectRatio: '215.9 / 279.4',
  },
  {
    value: 'half_letter',
    label: 'Media carta',
    description: 'Entrega compacta en medio formato horizontal.',
    group: 'institutional',
    aspectRatio: '8.5 / 5.5',
  },
  {
    value: 'a5',
    label: 'A5',
    description: 'Formato institucional compacto.',
    group: 'institutional',
    aspectRatio: '210 / 148',
  },
  {
    value: 'a4',
    label: 'A4',
    description: 'Alternativa configurable: 210 × 297 mm.',
    group: 'institutional',
    aspectRatio: '210 / 297',
  },
  {
    value: 'custom',
    label: 'Personalizado',
    description: 'Medidas institucionales configuradas en milímetros.',
    group: 'institutional',
    aspectRatio: '215.9 / 139.7',
  },
] as const satisfies readonly PaperChoiceDefinition[];

export const THERMAL_COMPATIBILITY_CHOICES = [
  {
    value: '80mm',
    label: '80 mm',
    description: 'Soporte secundario para impresora térmica de 80 mm.',
    group: 'compatibility',
  },
  {
    value: '58mm',
    label: '58 mm',
    description: 'Soporte secundario para impresora térmica de 58 mm.',
    group: 'compatibility',
  },
] as const satisfies readonly ThermalSupportChoiceDefinition[];

export const INSTITUTIONAL_PAPER_OPTIONS = PAPER_CHOICES;

const PAPER_TO_PROFILE: Record<InstitutionalPaper, ReceiptPrintProfile['code']> = {
  letter: 'carta_horizontal',
  letter_portrait: 'carta_vertical',
  half_letter: 'media_carta_horizontal',
  a5: 'a5_horizontal',
  a4: 'a4_vertical',
  custom: 'recibo_pequeno_personalizado',
};

const PROFILE_TO_PAPER: Partial<Record<ReceiptPrintProfile['code'], InstitutionalPaper>> = {
  carta_horizontal: 'letter',
  carta_vertical: 'letter_portrait',
  media_carta_horizontal: 'half_letter',
  a5_horizontal: 'a5',
  a4_vertical: 'a4',
  recibo_pequeno_personalizado: 'custom',
};

export function normalizeInstitutionalPaper(value: unknown): InstitutionalPaper {
  const match = PAPER_CHOICES.find((choice) => choice.value === value);
  return match?.value ?? 'half_letter';
}

export function paperChoiceFor(value: InstitutionalPaper): PaperChoiceDefinition {
  return PAPER_CHOICES.find((choice) => choice.value === value)
    ?? PAPER_CHOICES.find((choice) => choice.value === 'half_letter')
    ?? PAPER_CHOICES[0];
}

export function paperPresentation(value: InstitutionalPaper): {
  previewClass: string;
  printClass: string;
} {
  return receiptPaperPresentation(value);
}

export function receiptPaperPresentation(value: ReceiptPaperSize): {
  previewClass: string;
  printClass: string;
} {
  const suffix = value === 'half_letter'
    ? 'half-letter'
    : value === 'letter_portrait'
      ? 'letter-portrait'
      : value;
  return {
    previewClass: `receipt-paper-preview--${suffix}`,
    printClass: `receipt-${suffix}`,
  };
}

export function paperProfileCode(value: InstitutionalPaper): ReceiptPrintProfile['code'] {
  return PAPER_TO_PROFILE[value];
}

export function institutionalPaperFromProfile(
  profile: Pick<ReceiptPrintProfile, 'code'> | null | undefined,
): InstitutionalPaper {
  return profile ? PROFILE_TO_PAPER[profile.code] ?? 'half_letter' : 'half_letter';
}

export function isThermalPaper(value: unknown): value is ThermalSupportPaper {
  return value === '80mm' || value === '58mm';
}
