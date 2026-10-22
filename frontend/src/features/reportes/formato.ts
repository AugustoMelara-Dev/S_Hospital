import { parseCents } from '@/lib/moneyCents';
import type { AdminStatus } from '@/design-system/admin/components';
import type { ReporteCobro, ReporteOperacion } from './types';

/** Convierte un importe decimal del backend ("1500.00") a centavos. */
export function reporteCents(value: string | number | null | undefined): number | null {
  return parseCents(value);
}

/**
 * Pluralización del período en días: «1 día», «2 días», «0 días».
 * El literal «día(s)» es copy defectuoso en español (C4-VISUAL MEDIUM) y no
 * depende de patrones de búsqueda: la forma se decide por el número.
 */
export function formatDias(days: number): string {
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

/**
 * Agrupa los cobros autorizados por método para leer la distribución sin
 * recorrer la tabla fila a fila. No inventa valores: suma lo que el servidor ya
 * entregó en `collections` (conjunto completo, no la página visible).
 */
export function summarizeCollectionMethods(
  collections: ReporteCobro[],
): { label: string; cents: number }[] {
  const totals = new Map<string, number>();
  for (const row of collections) {
    const cents = parseCents(row.amount) ?? 0;
    totals.set(row.method_label, (totals.get(row.method_label) ?? 0) + cents);
  }

  return [...totals.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((left, right) => right.cents - left.cents);
}

/**
 * Mapea el estado textual del reporte al sello del sistema admin.
 * El estado del servidor nunca se muestra como `open/closed`.
 */
export function reporteStatusTone(statusLabel: string): { status: AdminStatus; label: string } {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes('anulad') || normalized.includes('reversad')) {
    return { status: 'anulado', label: statusLabel };
  }
  if (normalized.includes('sin cobro') || normalized.includes('gratuit')) {
    return { status: 'gratuito', label: statusLabel };
  }
  if (normalized.includes('pagad') || normalized.includes('cobrad')) {
    return { status: 'cobrado', label: statusLabel };
  }
  if (normalized.includes('parcial')) {
    return { status: 'listo', label: statusLabel };
  }

  return { status: 'valorada', label: statusLabel };
}

export function reporteOperationKey(operation: ReporteOperacion, index: number): string {
  return `${operation.invoice_number}-${index}`;
}

export function formatCajaLabel(
  name: string | null | undefined,
  code: string | null | undefined,
  sessionId: number,
): string {
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return `Sesión #${sessionId}`;
}
