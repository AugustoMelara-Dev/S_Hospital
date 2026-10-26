import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDownIcon, FileSpreadsheetIcon } from 'lucide-react';
import { reports, userSafeErrorMessage, type ExecutiveReportFilters } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useCategories } from '@/hooks/useCategories';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import {
  AdminCallout,
  AdminChip,
  AdminEmpty,
  AdminPageHeader,
  AdminStatBand,
} from '@/design-system/admin/components';
import { computePresetRange, parseReportDate, type PresetKey } from '@/features/reports/components/reportDateRanges';
import { SECONDARY_BUTTON } from './reportesUi';
import { formatDias, formatPeriodo } from './formato';
import { useCashSessionOptions } from '@/hooks/useCashSessionOptions';
import { CashOptionsSearch } from '@/features/cash/components/CashOptionsSearch';
import {
  ReportesFiltrosPanel,
  METHOD_OPTIONS,
  STATUS_OPTIONS,
  type FiltroOpcion,
  type OpcionesAuxiliaresEstado,
} from './components/ReportesFiltrosPanel';
import { ReporteResumen } from './components/ReporteResumen';
import { ReporteDesglose } from './components/ReporteTablas';
import { useReporteEjecutivo } from './useReporteEjecutivo';
import type { ReportesFiltros } from './types';

const MAX_RANGE_DAYS = 92;

function optionLabel(options: FiltroOpcion[], value: string | number | undefined): string | null {
  if (value === undefined) return null;
  return options.find((option) => option.value === String(value))?.label ?? null;
}

/**
 * Reportes — composición de informe profesional: encabezado con el alcance en
 * chips, barra de filtros compacta (período segmentado + rango, secundarios
 * plegables con contador), banda de cohortes y un cuerpo de desglose con una
 * tabla por propósito. El saldo al corte no se calcula como facturado − cobrado
 * del mismo período: cada cohorte viene resuelta por el servidor.
 */
export function ReportesView() {
  const { has, onStatus, cashSession, cashSessionLoading } = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManagerial = has('reports.managerial.view');
  const canCashSession = has('reports.cash_session.view');
  const canExport = has('reports.export');
  const canView = canManagerial || canCashSession;
  const missingScopedSession = !canManagerial && canCashSession && !cashSession;

  const scopedSessionId = !canManagerial && canCashSession ? cashSession?.id : undefined;
  const initial = useMemo(() => initialFilters(searchParams, scopedSessionId, canManagerial), [searchParams, scopedSessionId, canManagerial]);
  const [draftFilters, setFilters] = useState<ReportesFiltros>(initial);
  const [storedAppliedFilters, setAppliedFilters] = useState<ReportesFiltros>(initial);
  // El turno vigente puede llegar o cambiar antes de que se sincronicen los
  // filtros. Consulta y exportaciones deben usarlo desde ese mismo render.
  const filters = useMemo(
    () => canManagerial ? draftFilters : { ...draftFilters, user_id: undefined, cash_session_id: scopedSessionId },
    [canManagerial, draftFilters, scopedSessionId],
  );
  const appliedFilters = useMemo(
    () => canManagerial ? storedAppliedFilters : { ...storedAppliedFilters, user_id: undefined, cash_session_id: scopedSessionId },
    [canManagerial, storedAppliedFilters, scopedSessionId],
  );
  const [preset, setPreset] = useState<PresetKey>(() => detectPreset(initial));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const next = initialFilters(searchParams, scopedSessionId, canManagerial);
    setFilters((current) => (sameFilters(current, next) ? current : next));
    setAppliedFilters((current) => (sameFilters(current, next) ? current : next));
    setPreset(detectPreset(next));
  }, [searchParams, scopedSessionId, canManagerial]);

  const rangeError = validateRange(filters.date_from, filters.date_to);
  const hasUnappliedChanges = !sameFilters(filters, appliedFilters);

  const reportQuery = useReporteEjecutivo(
    appliedFilters,
    canView && !missingScopedSession && (canManagerial || !cashSessionLoading) && rangeError === null,
  );
  const report = reportQuery.data;

  const cashierOptions = useCashSessionOptions('cashiers', { enabled: canManagerial, selectedId: filters.user_id });
  const sessionOptions = useCashSessionOptions('sessions', { enabled: canManagerial, selectedId: filters.cash_session_id });
  const categoriesQuery = useCategories(true);
  const cajeros = cashierOptions.options;
  const cajas = sessionOptions.options;

  const categorias = useMemo<FiltroOpcion[]>(
    () => (categoriesQuery.data ?? []).map((category) => ({ value: String(category.id), label: category.name })),
    [categoriesQuery.data],
  );
  const cashOptionsStatus: OpcionesAuxiliaresEstado = !canManagerial
    ? 'ready'
    : cashierOptions.isError || sessionOptions.isError
      ? 'error'
      : cashierOptions.isPending || sessionOptions.isPending
        ? 'pending'
        : cajas.length === 0 && cajeros.length === 0
          ? 'empty'
          : 'ready';
  const categoryOptionsStatus: OpcionesAuxiliaresEstado = !canManagerial
    ? 'ready'
    : categoriesQuery.isError
      ? 'error'
      : categoriesQuery.isPending
        ? 'pending'
        : categorias.length === 0
          ? 'empty'
          : 'ready';
  const draftScopeUnavailable = scopeSelectionUnavailable(filters, cashOptionsStatus, categoryOptionsStatus);
  const appliedScopeUnavailable = scopeSelectionUnavailable(appliedFilters, cashOptionsStatus, categoryOptionsStatus);

  // Chips de alcance: ámbito, período aplicado y filtros secundarios activos.
  // Sustituyen el párrafo técnico permanente por detalle contextual breve.
  const scopeChips = useMemo<ReactNode[]>(() => {
    const chips: ReactNode[] = [];
    if (appliedFilters.method) {
      const label = optionLabel(METHOD_OPTIONS, appliedFilters.method);
      if (label) chips.push(<AdminChip key="method">Método: {label}</AdminChip>);
    }
    if (appliedFilters.status) {
      const label = optionLabel(STATUS_OPTIONS, appliedFilters.status);
      if (label) chips.push(<AdminChip key="status">Estado: {label}</AdminChip>);
    }
    if (appliedFilters.user_id !== undefined) {
      const label = optionLabel(cajeros, appliedFilters.user_id);
      chips.push(<AdminChip key="user">Cajero: {label ?? 'seleccionado'}</AdminChip>);
    }
    if (appliedFilters.cash_session_id !== undefined) {
      const label = optionLabel(cajas, appliedFilters.cash_session_id);
      chips.push(<AdminChip key="session">Turno: {label ?? 'seleccionado'}</AdminChip>);
    }
    if (appliedFilters.category_id !== undefined) {
      const label = optionLabel(categorias, appliedFilters.category_id);
      chips.push(<AdminChip key="category">Categoría: {label ?? 'seleccionada'}</AdminChip>);
    }
    return chips;
  }, [appliedFilters, cajas, cajeros, categorias]);

  function applyFilters() {
    if (rangeError) {
      onStatus({ key: 'reportes:filtros', level: 'warning', message: rangeError });
      return;
    }
    if (draftScopeUnavailable) {
      onStatus({
        key: 'reportes:filtros',
        level: 'warning',
        message: 'Vuelva a cargar los filtros antes de aplicar esta selección.',
      });
      return;
    }

    setAppliedFilters(filters);
    setSearchParams((current) => filtersToSearchParams(current, filters));
  }

  function expandToThisMonth() {
    const range = computePresetRange('thisMonth');
    const next = { ...filters, date_from: range.from, date_to: range.to };
    setFilters(next);
    setAppliedFilters(next);
    setPreset('thisMonth');
    setSearchParams((current) => filtersToSearchParams(current, next));
  }

  function exportPdf() {
    runExport(async () => {
      const blob = await reports.downloadExecutivePdf(appliedFilters);
      downloadBlob(blob, `reporte-${appliedFilters.date_from}-a-${appliedFilters.date_to}.pdf`);
    }, 'PDF');
  }

  function exportExcel() {
    runExport(async () => {
      const blob = await reports.downloadExecutiveExcel(appliedFilters);
      downloadBlob(blob, `reporte-${appliedFilters.date_from}-a-${appliedFilters.date_to}.xlsx`);
    }, 'Excel');
  }

  function runExport(task: () => Promise<void>, label: string) {
    if (!canExport) {
      onStatus({ key: 'reportes:export', level: 'warning', message: `Su usuario no puede exportar el reporte en ${label}.` });
      return;
    }
    if (hasUnappliedChanges) {
      onStatus({ key: 'reportes:export', level: 'warning', message: 'Aplique el período antes de exportar.' });
      return;
    }
    if (appliedScopeUnavailable) {
      onStatus({
        key: 'reportes:export',
        level: 'warning',
        message: 'Vuelva a cargar los filtros antes de exportar el reporte.',
      });
      return;
    }
    if (exporting) return;

    setExporting(true);
    onStatus({ key: 'reportes:export', level: 'info', message: `Preparando ${label}...`, toast: false });
    void task()
      .then(() => onStatus({ key: 'reportes:export', level: 'success', message: `${label} listo para descargar.` }))
      .catch((error: unknown) =>
        onStatus({
          key: 'reportes:export',
          level: 'error',
          message: userSafeErrorMessage(error, `No se pudo generar el ${label}.`),
        }),
      )
      .finally(() => setExporting(false));
  }

  const isEmpty =
    report !== undefined &&
    report.summary.invoice_count === 0 &&
    report.summary.receipt_count === 0 &&
    report.operations.length === 0 &&
    report.detail.length === 0 &&
    report.collections.length === 0 &&
    report.cash_sessions.length === 0 &&
    report.gratuities.length === 0;

  const exportBlocked = exporting || hasUnappliedChanges || rangeError !== null || appliedScopeUnavailable || (!canManagerial && cashSessionLoading);
  const pageHeader = (
    <AdminPageHeader
      headingId="reportes-titulo"
      title="Reportes"
      description="Período, resumen del corte y desglose por operación, producto, cobro y caja."
      meta={
        <div data-testid="reporte-scope" className="flex flex-wrap items-center gap-2">
          <AdminChip tone={canManagerial ? 'accent' : 'neutral'}>
            {!canView ? 'Acceso no habilitado' : canManagerial ? 'Todas las cajas' : 'Solo su caja'}
          </AdminChip>
          {canView ? (
            <AdminChip>
              {formatPeriodo(appliedFilters.date_from, appliedFilters.date_to)}
            </AdminChip>
          ) : null}
          {report ? <AdminChip>{formatDias(report.period.days)}</AdminChip> : null}
          {canView ? scopeChips : null}
        </div>
      }
      actions={
        canView && !missingScopedSession && canExport ? (
          <>
            <button
              type="button"
              data-ui-press
              className={SECONDARY_BUTTON}
              onClick={exportPdf}
              disabled={exportBlocked}
            >
              <FileDownIcon aria-hidden="true" data-icon="inline-start" className="size-4 shrink-0" />
              Exportar PDF
            </button>
            <button
              type="button"
              data-ui-press
              className={SECONDARY_BUTTON}
              onClick={exportExcel}
              disabled={exportBlocked}
            >
              <FileSpreadsheetIcon aria-hidden="true" data-icon="inline-start" className="size-4 shrink-0" />
              Exportar Excel
            </button>
          </>
        ) : null
      }
    />
  );

  if (!canView) {
    return (
      <section className="flex flex-col gap-5" aria-labelledby="reportes-titulo">
        {pageHeader}
        <AdminEmpty
          title="Reportes no disponibles"
          description="Su usuario no tiene permiso para consultar reportes. Solicite acceso a un supervisor."
        />
      </section>
    );
  }

  if (missingScopedSession && cashSessionLoading) {
    return (
      <section className="flex flex-col gap-5" aria-labelledby="reportes-titulo" aria-busy="true">
        {pageHeader}
        <p role="status" className="py-5 text-[color:var(--ui-ink-soft)]">Consultando su caja…</p>
      </section>
    );
  }

  if (missingScopedSession) {
    return (
      <section className="flex flex-col gap-5" aria-labelledby="reportes-titulo">
        {pageHeader}
        <AdminEmpty
          title="Sin caja activa"
          description="El reporte por sesión requiere una caja abierta a su nombre. Abra caja o solicite acceso al reporte general."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="reportes-titulo">
      {pageHeader}

      <ReportesFiltrosPanel
        filters={filters}
        preset={preset}
        onPresetChange={setPreset}
        onChange={setFilters}
        onApply={applyFilters}
        canFilterScope={canManagerial}
        loading={reportQuery.isFetching}
        rangeError={rangeError}
        hasUnappliedChanges={hasUnappliedChanges}
        cajeros={cajeros}
        cajas={cajas}
        categorias={categorias}
        cashOptionsStatus={cashOptionsStatus}
        categoryOptionsStatus={categoryOptionsStatus}
        onRetryCashOptions={() => void Promise.all([cashierOptions.refetch(), sessionOptions.refetch()])}
        onRetryCategoryOptions={() => void categoriesQuery.refetch()}
        cajerosSearch={canManagerial ? <CashOptionsSearch picker={cashierOptions} label="Buscar cajeros" /> : null}
        cajasSearch={canManagerial ? <CashOptionsSearch picker={sessionOptions} label="Buscar turnos" /> : null}
      />

      {reportQuery.isError ? (
        <AdminCallout tone="error" title="No se pudo cargar el reporte">
          <div className="flex flex-col items-start gap-3">
            <span>{userSafeErrorMessage(reportQuery.error, 'Revise la conexión local y vuelva a intentar.')}</span>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void reportQuery.refetch()}>
              Reintentar
            </button>
          </div>
        </AdminCallout>
      ) : null}

      {reportQuery.isFetching && !report ? (
        <AdminStatBand role="region" aria-label="Resumen del período" aria-busy="true">
          <p role="status" className="col-span-full px-4 py-5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Cargando reporte…
          </p>
        </AdminStatBand>
      ) : null}

      {report && isEmpty ? (
        <AdminEmpty
          title="Sin datos en el rango"
          description="No hay operaciones, cobros, caja ni gratuidades para el período y filtros aplicados. Amplíe el período o quite filtros."
          action={
            <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={expandToThisMonth}>
              Ampliar a este mes
            </button>
          }
        />
      ) : null}

      {report && !isEmpty ? (
        <div className="flex flex-col gap-4">
          <ReporteResumen report={report} updatedAt={reportQuery.dataUpdatedAt} />
          <ReporteDesglose report={report} />
        </div>
      ) : null}
    </section>
  );
}

function initialFilters(searchParams: URLSearchParams, scopedSessionId?: number, canManagerial = false): ReportesFiltros {
  const defaultRange = computePresetRange('thisMonth');
  const positiveId = (key: string): number | undefined => {
    const raw = searchParams.get(key);
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  };
  const method = searchParams.get('method');
  const status = searchParams.get('status');
  return {
    date_from: searchParams.get('from') ?? defaultRange.from,
    date_to: searchParams.get('to') ?? defaultRange.to,
    cash_session_id: canManagerial ? positiveId('cash_session_id') : scopedSessionId,
    user_id: canManagerial ? positiveId('user_id') : undefined,
    category_id: positiveId('category_id'),
    area_id: positiveId('area_id'),
    ...(METHOD_OPTIONS.some((option) => option.value === method && method !== 'todos') ? { method: method as ReportesFiltros['method'] } : {}),
    ...(STATUS_OPTIONS.some((option) => option.value === status && status !== 'todos') ? { status: status as ReportesFiltros['status'] } : {}),
  };
}

function filtersToSearchParams(current: URLSearchParams, filters: ReportesFiltros): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('from', filters.date_from);
  next.set('to', filters.date_to);
  for (const key of ['cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'] as const) {
    const value = filters[key];
    if (value === undefined) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function detectPreset(filters: ExecutiveReportFilters): PresetKey {
  const presets: PresetKey[] = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth'];
  return presets.find((candidate) => {
    const range = computePresetRange(candidate);
    return range.from === filters.date_from && range.to === filters.date_to;
  }) ?? 'custom';
}

function sameFilters(left: ExecutiveReportFilters, right: ExecutiveReportFilters): boolean {
  return (
    left.date_from === right.date_from &&
    left.date_to === right.date_to &&
    left.user_id === right.user_id &&
    left.cash_session_id === right.cash_session_id &&
    left.category_id === right.category_id &&
    left.area_id === right.area_id &&
    left.method === right.method &&
    left.status === right.status
  );
}

function validateRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Seleccione fecha de inicio y fin para el reporte.';
  }

  const start = parseReportDate(dateFrom);
  const end = parseReportDate(dateTo);
  if (!start || !end) {
    return 'Seleccione fechas válidas para el reporte.';
  }

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (diffDays < 1) {
    return 'La fecha de inicio debe ser anterior o igual a la fecha de fin.';
  }
  if (diffDays > MAX_RANGE_DAYS) {
    return `El rango máximo permitido para reportes es de ${MAX_RANGE_DAYS} días.`;
  }

  return null;
}

function scopeSelectionUnavailable(
  filters: ReportesFiltros,
  cashOptionsStatus: OpcionesAuxiliaresEstado,
  categoryOptionsStatus: OpcionesAuxiliaresEstado,
): boolean {
  return (
    ((filters.user_id !== undefined || filters.cash_session_id !== undefined) && cashOptionsStatus !== 'ready') ||
    (filters.category_id !== undefined && categoryOptionsStatus !== 'ready')
  );
}
