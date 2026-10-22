import type { InvoicePreview } from '@/lib/api';
import { asCents, parseCents, type Cents } from '@/lib/moneyCents';
import { serverPreviewBlockReason } from '@/features/invoices/state/serverPreview';
import { normalizePatientName } from '../cobrarSchema';
import type { CobrarResult } from './types';

/**
 * Estados explícitos del recorrido de Cobrar. Un dato no confirmado viaja como
 * `totalCents: null` (la capa de presentación muestra "No disponible"), jamás
 * como `L 0.00`. El cero solo es válido cuando el servidor confirma total 0.
 */
export type CobrarStatusCode =
  | 'borrador'
  | 'calculando'
  | 'listo'
  | 'sin_cobro'
  | 'invalido'
  | 'servidor_no_disponible'
  | 'emitiendo'
  | 'pendiente_cobro'
  | 'pagado'
  | 'emitido_sin_cobro';

export type CobrarStatus = {
  code: CobrarStatusCode;
  label: string;
  detail: string | null;
  totalCents: Cents | null;
  canConfirm: boolean;
  confirmKind: 'pay' | 'zero' | 'retry' | null;
};

export type CobrarStatusInput = {
  patientName: string;
  lineCount: number;
  hasCashSession: boolean;
  cashSessionLoading: boolean;
  canCreatePayments: boolean;
  preview: InvoicePreview | null;
  previewing: boolean;
  previewError: string | null;
  /** Primer problema local de precio/cantidad, si existe. */
  lineIssue: string | null;
  /** La valoración vigente corresponde a la revisión actual de la cuenta. */
  previewMatchesRevision: boolean;
  submitting: boolean;
  result: CobrarResult | null;
};

function previewTotalCents(preview: InvoicePreview | null): Cents | null {
  if (!preview || preview.status === 'tax_unavailable') {
    return null;
  }

  return asCents(preview.totals.total_cents);
}

const CALCULATING: CobrarStatus = {
  code: 'calculando',
  label: 'Calculando…',
  detail: 'Comprobando el total de la cuenta.',
  totalCents: null,
  canConfirm: false,
  confirmKind: null,
};

export function deriveCobrarStatus(input: CobrarStatusInput): CobrarStatus {
  const {
    patientName,
    lineCount,
    hasCashSession,
    cashSessionLoading,
    canCreatePayments,
    preview,
    previewing,
    previewError,
    lineIssue,
    previewMatchesRevision,
    submitting,
    result,
  } = input;
  const patientReady = normalizePatientName(patientName).length > 0;

  if (result) {
    if (result.outcome === 'paid') {
      return {
        code: 'pagado',
        label: 'Pagado',
        detail: null,
        totalCents: parseCents(result.invoice.total),
        canConfirm: false,
        confirmKind: null,
      };
    }

    if (result.outcome === 'sin_cobro') {
      return {
        code: 'emitido_sin_cobro',
        label: 'Emitida sin cobro',
        detail: 'La operación quedó emitida sin pago registrado.',
        totalCents: 0 as Cents,
        canConfirm: false,
        confirmKind: null,
      };
    }

    return {
      code: 'pendiente_cobro',
      label: 'Emitido pendiente de cobrar',
      detail: result.receiptRecovery,
      totalCents: parseCents(result.invoice.balance_due),
      canConfirm: hasCashSession && canCreatePayments,
      confirmKind: hasCashSession && canCreatePayments ? 'retry' : null,
    };
  }

  if (submitting) {
    return {
      code: 'emitiendo',
      label: 'Emitiendo…',
      detail: null,
      totalCents: previewMatchesRevision ? previewTotalCents(preview) : null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  if (previewError) {
    return {
      code: 'servidor_no_disponible',
      label: 'No se pudo confirmar el total',
      detail: previewError,
      totalCents: null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  if (lineCount === 0) {
    return {
      code: 'borrador',
      label: 'Borrador',
      detail: 'Agregue un servicio para comenzar la cuenta.',
      totalCents: null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  if (cashSessionLoading) {
    return {
      ...CALCULATING,
      detail: 'Consultando la caja del turno.',
    };
  }

  if (lineIssue) {
    return {
      code: 'invalido',
      label: 'Revise la cuenta',
      detail: lineIssue,
      totalCents: null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  if (previewing || !previewMatchesRevision || preview === null) {
    return CALCULATING;
  }

  const blockReason = serverPreviewBlockReason(preview);

  if (blockReason) {
    return {
      code: 'invalido',
      label: 'Total no confirmado',
      detail: blockReason,
      totalCents: null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  const total = previewTotalCents(preview);

  if (total === null) {
    return {
      code: 'invalido',
      label: 'Total no confirmado',
      detail: 'No se recibió un total válido. Revise la cuenta y vuelva a intentar.',
      totalCents: null,
      canConfirm: false,
      confirmKind: null,
    };
  }

  const missing: string[] = [];

  if (!patientReady) {
    missing.push('Ingrese el nombre del paciente.');
  }

  if (!hasCashSession) {
    missing.push('Abra caja antes de emitir y cobrar una factura.');
  }

  if (missing.length > 0) {
    return {
      code: 'invalido',
      label: 'Faltan datos',
      detail: missing.join(' '),
      totalCents: total,
      canConfirm: false,
      confirmKind: null,
    };
  }

  if (total === 0) {
    const zeroByRule = preview.zero_reason === 'all_lines_free_by_rule';

    return {
      code: 'sin_cobro',
      label: 'Emisión válida sin cobro',
      detail: zeroByRule
        ? 'El total confirmado es L 0.00 porque todas las líneas elegibles quedaron sin cobro por receta. No se registra pago.'
        : 'El total confirmado es L 0.00. No se registra pago ni efectivo.',
      totalCents: 0 as Cents,
      canConfirm: true,
      confirmKind: 'zero',
    };
  }

  if (!canCreatePayments) {
    return {
      code: 'invalido',
      label: 'Cobro no autorizado',
      detail: 'Su usuario no puede registrar pagos. Solicite acceso al administrador.',
      totalCents: total,
      canConfirm: false,
      confirmKind: null,
    };
  }

  return {
    code: 'listo',
    label: 'Listo para cobrar',
    detail: null,
    totalCents: total,
    canConfirm: true,
    confirmKind: 'pay',
  };
}
