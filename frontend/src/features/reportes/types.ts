import type { ExecutiveReport, ExecutiveReportFilters } from '@/lib/api';

/**
 * Tipos locales de la pantalla `/reportes`.
 *
 * `lib/api/types.ts` pertenece a otro propietario: la vista consume el contrato
 * existente y extiende aqui las secciones nuevas del reporte ejecutivo
 * (`operations`, `detail`, `collections`, `gratuities` y las metricas de
 * gratuidad del resumen) sin tocar `lib/**`.
 */
export type ReportesFiltros = ExecutiveReportFilters;

export type ReportePeriodo = ExecutiveReport['period'];

export type ReporteOperacion = {
  date: string | null;
  invoice_number: string;
  patient: string;
  cash_session_id: number | null;
  cash_session_label: string | null;
  cashier: string | null;
  total: string;
  paid: string;
  balance: string;
  status: string;
  status_label: string;
  settlement: string;
  settlement_label: string;
  receipt_document: string | null;
};

export type ReporteDetalleLinea = {
  date: string | null;
  invoice_number: string;
  patient: string;
  service: string;
  category: string | null;
  area: string | null;
  quantity: string;
  unit_price: string;
  tax: string;
  line_total: string;
  rule_adjustment: string;
  rule_adjustment_persisted: boolean;
  is_free: boolean;
  rule_code: string | null;
  rule_label: string | null;
  settlement: string;
};

export type ReporteCobro = {
  paid_at: string | null;
  invoice_number: string;
  patient: string;
  cash_session_id: number | null;
  cash_session_label: string | null;
  cashier: string | null;
  method: string;
  method_label: string;
  reference: string | null;
  amount: string;
  status: string;
  status_label: string;
};

export type ReporteCaja = ExecutiveReport['cash_sessions'][number] & {
  cash_register_id?: number | null;
  cash_register_code?: string | null;
  cash_register_name?: string | null;
  status_label?: string;
};

export type ReporteGratuidad = {
  date: string | null;
  invoice_number: string;
  patient: string;
  service: string;
  category: string | null;
  quantity: string;
  unit_price: string;
  line_total: string;
  adjustment_value: string;
  adjustment_persisted: boolean;
  rule_code: string | null;
  reason: string;
  settlement: string;
};

export type ReporteResumen = ExecutiveReport['summary'] & {
  without_charge_count: number;
  gratuity_item_count: number;
  gratuity_adjustment_total: string;
  gratuity_adjustment_persisted: boolean;
};

export type ReporteEjecutivo = Omit<ExecutiveReport, 'summary' | 'cash_sessions'> & {
  summary: ReporteResumen;
  operations: ReporteOperacion[];
  detail: ReporteDetalleLinea[];
  collections: ReporteCobro[];
  cash_sessions: ReporteCaja[];
  gratuities: ReporteGratuidad[];
};

/** El backend puede no incluir aun las secciones nuevas (versiones previas). */
export function normalizeReporte(report: ExecutiveReport): ReporteEjecutivo {
  const summary = report.summary as ReporteResumen;
  return {
    ...report,
    summary: {
      ...summary,
      without_charge_count: summary.without_charge_count ?? 0,
      gratuity_item_count: summary.gratuity_item_count ?? 0,
      gratuity_adjustment_total: summary.gratuity_adjustment_total ?? '0.00',
      gratuity_adjustment_persisted: summary.gratuity_adjustment_persisted ?? false,
    },
    operations: (report as Partial<ReporteEjecutivo>).operations ?? [],
    detail: (report as Partial<ReporteEjecutivo>).detail ?? [],
    collections: (report as Partial<ReporteEjecutivo>).collections ?? [],
    gratuities: (report as Partial<ReporteEjecutivo>).gratuities ?? [],
  };
}
