import type { InvoicePreview } from '../../../lib/api';
import { toExchangeDecimal, type ExchangeDecimal } from '../../../lib/moneyCents';

/**
 * Adaptador puro entre la prevalidación del servidor (centavos enteros) y el
 * estado de presentación del POS (decimales de intercambio). Nunca convierte
 * `null` en cero: un impuesto o total no disponible viaja como cadena vacía y
 * la última capa muestra "No disponible".
 */
export type ServerPreviewDisplay = {
  subtotal: string;
  exempt: string;
  tax: string;
  total: string;
};

export function serverPreviewToDisplay(preview: InvoicePreview): ServerPreviewDisplay {
  return {
    subtotal: decimalOrEmpty(preview.totals.subtotal_cents),
    exempt: decimalOrEmpty(preview.totals.exempt_cents),
    tax: decimalOrEmpty(preview.totals.tax_cents),
    total: decimalOrEmpty(preview.totals.total_cents),
  };
}

export function serverPreviewIsChargeable(preview: InvoicePreview): boolean {
  return preview.status !== 'tax_unavailable'
    && preview.totals.total_cents !== null
    && preview.totals.tax_cents !== null;
}

export function serverPreviewBlockReason(preview: InvoicePreview): string | null {
  if (preview.status === 'tax_unavailable') {
    return 'El servidor no pudo determinar el impuesto porque la tasa configurada no es válida. Corrija la configuración fiscal antes de emitir.';
  }

  if (preview.totals.total_cents === null || preview.totals.tax_cents === null) {
    return 'El servidor no informó un total confirmado. No se puede emitir esta cuenta.';
  }

  return null;
}

/** Aviso no descartable cuando la tasa procede del valor por defecto del sistema. */
export function serverPreviewTaxOriginWarning(preview: InvoicePreview): string | null {
  if (preview.tax.origin === 'code_default') {
    return 'La tasa de ISV proviene del valor por defecto del sistema y no de la configuración fiscal del hospital. Confirme la configuración del ISV en Configuración fiscal.';
  }

  return null;
}

function decimalOrEmpty(cents: number | null | undefined): ExchangeDecimal | '' {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return '';
  }

  return toExchangeDecimal(cents);
}
