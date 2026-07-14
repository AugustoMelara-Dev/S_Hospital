import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Empty, Typography } from 'antd';
import { apiClient, type CashSession, userSafeErrorMessage } from '@/lib/api';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';
import { CashSessionReportPanel } from './components/CashSessionReportPanel';
import { ReportScope } from './components/ReportScope';

type ReportsCashProps = {
  canBrowseCashSessions: boolean;
  canExport: boolean;
  canViewCash: boolean;
  canViewManagerial: boolean;
};

type CashExportError = {
  message: string;
  title: string;
};

export function ReportsCash({
  canBrowseCashSessions,
  canExport,
  canViewCash,
  canViewManagerial,
}: ReportsCashProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCashSessionId = searchParams.get('cash_session_id') ?? '';
  const initialUrlCashSessionId = useRef(urlCashSessionId).current;
  const [cashSessionReport, setCashSessionReport] = useState<Awaited<ReturnType<typeof apiClient.getCashSessionReport>> | null>(null);
  const [cashReportId, setCashReportId] = useState(() => isPositiveInteger(urlCashSessionId) ? urlCashSessionId : '');
  const [cashError, setCashError] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashExporting, setCashExporting] = useState<'excel' | 'pdf' | null>(null);
  const [cashExportError, setCashExportError] = useState<CashExportError | null>(null);
  const [recentCashSessions, setRecentCashSessions] = useState<CashSession[]>([]);
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false);
  const requestSequence = useRef(0);
  const recentSessionsRequested = useRef(false);
  const visibleCashSessionReport = cashSessionReport
    && String(cashSessionReport.cash_session.id) === cashReportId.trim()
    && (!urlCashSessionId || String(cashSessionReport.cash_session.id) === urlCashSessionId)
    ? cashSessionReport
    : null;

  const loadCashReportById = useCallback(async (normalizedCashReportId: string) => {
    const requestId = ++requestSequence.current;
    try {
      setCashError('');
      setCashExportError(null);
      setCashLoading(true);
      setCashSessionReport(null);
      const report = await apiClient.getCashSessionReport(normalizedCashReportId);
      if (requestSequence.current === requestId) {
        setCashSessionReport(report);
      }
    } catch (err) {
      if (requestSequence.current === requestId) {
        setCashSessionReport(null);
        setCashError(userSafeErrorMessage(err, 'No se pudo cargar la caja.'));
      }
    } finally {
      if (requestSequence.current === requestId) {
        setCashLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!canViewCash && !canViewManagerial) return;

    if (!urlCashSessionId) return;

    setCashReportId(urlCashSessionId);
    if (!isPositiveInteger(urlCashSessionId)) {
      requestSequence.current += 1;
      setCashSessionReport(null);
      setCashLoading(false);
      setCashError('Ingrese un numero de caja valido.');
      return;
    }

    void loadCashReportById(urlCashSessionId);
  }, [canViewCash, canViewManagerial, loadCashReportById, urlCashSessionId]);

  useEffect(() => {
    if (!canBrowseCashSessions) {
      return;
    }
    if (recentSessionsRequested.current) return;
    recentSessionsRequested.current = true;

    let cancelled = false;

    async function loadRecentCashSessions() {
      try {
        setCashSessionsLoading(true);
        const response = await apiClient.getCashSessions({ page: 1, perPage: 5 });
        if (cancelled) return;

        const sessions = Array.isArray(response.data) ? response.data : [];
        const firstSessionId = sessions[0]?.id ? String(sessions[0].id) : '';
        setRecentCashSessions(sessions);
        if (firstSessionId && !initialUrlCashSessionId) {
          setCashReportId(firstSessionId);
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('cash_session_id', firstSessionId);
            return next;
          }, { replace: true });
        }
      } catch {
        if (!cancelled) {
          setRecentCashSessions([]);
        }
      } finally {
        if (!cancelled) {
          setCashSessionsLoading(false);
        }
      }
    }

    void loadRecentCashSessions();

    return () => {
      cancelled = true;
    };
  }, [canBrowseCashSessions, initialUrlCashSessionId, setSearchParams]);

  async function loadCashReport() {
    if (cashLoading) {
      return;
    }

    const normalizedCashReportId = cashReportId.trim();

    if (!normalizedCashReportId) {
      setCashError('Ingrese el numero de caja.');
      return;
    }

    if (!isPositiveInteger(normalizedCashReportId)) {
      setCashError('Ingrese un numero de caja valido.');
      return;
    }

    if (urlCashSessionId === normalizedCashReportId) {
      await loadCashReportById(normalizedCashReportId);
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('cash_session_id', normalizedCashReportId);
      return next;
    });
  }

  async function exportCashReport() {
    if (!visibleCashSessionReport || cashLoading || cashExporting !== null) {
      return;
    }

    const cashSessionId = visibleCashSessionReport.cash_session.id;
    const dateFrom = dateOnly(visibleCashSessionReport.cash_session.opened_at);
    const dateTo = dateOnly(visibleCashSessionReport.cash_session.closed_at ?? visibleCashSessionReport.cash_session.opened_at);

    try {
      setCashExportError(null);
      setCashExporting('excel');
      const blob = await apiClient.downloadCashSessionReportExcel({
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
      });
      downloadBlob(blob, `reporte-caja-${cashSessionId}.xlsx`);
    } catch (err) {
      setCashExportError({
        title: 'No se pudo exportar Excel',
        message: userSafeErrorMessage(err, 'No se pudo exportar el reporte de caja en Excel. Intente nuevamente.'),
      });
    } finally {
      setCashExporting(null);
    }
  }

  async function exportCashReportPdf() {
    if (!visibleCashSessionReport || cashLoading || cashExporting !== null) {
      return;
    }

    const cashSessionId = visibleCashSessionReport.cash_session.id;
    const dateFrom = dateOnly(visibleCashSessionReport.cash_session.opened_at);
    const dateTo = dateOnly(visibleCashSessionReport.cash_session.closed_at ?? visibleCashSessionReport.cash_session.opened_at);

    try {
      setCashExportError(null);
      setCashExporting('pdf');
      const blob = await apiClient.downloadCashSessionReportPdf({
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
      });
      openBlobInNewTab(blob, `reporte-caja-${cashSessionId}.pdf`);
    } catch (err) {
      setCashExportError({
        title: 'No se pudo abrir el PDF de caja',
        message: userSafeErrorMessage(err, 'No se pudo abrir el reporte PDF de caja. Intente nuevamente.'),
      });
    } finally {
      setCashExporting(null);
    }
  }

  if (!canViewCash && !canViewManagerial) {
    return (
      <Empty description={<><Typography.Title level={3}>Reporte de caja no disponible</Typography.Title><Typography.Text>Este usuario no tiene permiso para consultar cajas.</Typography.Text></>} />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte de caja">
      <header className="border-b border-border pb-4"><Typography.Text>Reporte de caja</Typography.Text><Typography.Title level={1}>Operación de caja</Typography.Title><Typography.Paragraph>Sesiones, cajeros, métodos de pago y diferencias de caja.</Typography.Paragraph></header>

      {visibleCashSessionReport ? (
        <ReportScope
          ariaLabel="Alcance del reporte de caja"
          from={dateOnly(visibleCashSessionReport.cash_session.opened_at)}
          to={dateOnly(visibleCashSessionReport.cash_session.closed_at ?? visibleCashSessionReport.cash_session.opened_at)}
          source={`Sesión de caja ${visibleCashSessionReport.cash_session.id} · ${visibleCashSessionReport.cash_session.user?.name ?? 'Cajero no disponible'}`}
        />
      ) : null}

      {cashExportError ? (
        <Alert type="error" title={cashExportError.title} description={cashExportError.message} showIcon />
      ) : null}

      <CashSessionReportPanel
        canExport={canExport}
        cashSession={visibleCashSessionReport}
        cashReportId={cashReportId}
        recentCashSessions={recentCashSessions}
        sessionsLoading={cashSessionsLoading}
        loading={cashLoading}
        exporting={cashExporting !== null}
        exportingType={cashExporting}
        error={cashError}
        onCashReportIdChange={(value) => {
          requestSequence.current += 1;
          setCashExportError(null);
          setCashReportId(value);
          if (String(cashSessionReport?.cash_session.id ?? '') !== value.trim()) {
            setCashSessionReport(null);
            setCashLoading(false);
          }
          if (cashError && (value.trim() === '' || isPositiveInteger(value.trim()))) {
            setCashError('');
          }
        }}
        onExport={() => {
          void exportCashReport();
        }}
        onExportPdf={() => {
          void exportCashReportPdf();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void loadCashReport();
        }}
      />
    </section>
  );
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function isPositiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}
