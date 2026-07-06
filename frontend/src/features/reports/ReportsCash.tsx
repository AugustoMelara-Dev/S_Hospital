import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/states';
import { OperationalBanner } from '@/components/shared';
import { apiClient, type CashSession, userSafeErrorMessage } from '@/lib/api';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';
import { CashSessionReportTab } from './components/CashSessionReportTab';

type ReportsCashProps = {
  canBrowseCashSessions: boolean;
  canExport: boolean;
  canViewCash: boolean;
  canViewManagerial: boolean;
};

export function ReportsCash({
  canBrowseCashSessions,
  canExport,
  canViewCash,
  canViewManagerial,
}: ReportsCashProps) {
  const [cashSessionReport, setCashSessionReport] = useState<Awaited<ReturnType<typeof apiClient.getCashSessionReport>> | null>(null);
  const [cashReportId, setCashReportId] = useState('');
  const [cashError, setCashError] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashExporting, setCashExporting] = useState<'excel' | 'pdf' | null>(null);
  const [recentCashSessions, setRecentCashSessions] = useState<CashSession[]>([]);
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false);

  const loadCashReportById = useCallback(async (normalizedCashReportId: string) => {
    try {
      setCashError('');
      setCashLoading(true);
      setCashSessionReport(await apiClient.getCashSessionReport(normalizedCashReportId));
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo cargar la caja.'));
    } finally {
      setCashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canBrowseCashSessions) {
      return;
    }

    let cancelled = false;

    async function loadRecentCashSessions() {
      try {
        setCashSessionsLoading(true);
        const response = await apiClient.getCashSessions({ page: 1, perPage: 5 });
        if (cancelled) return;

        const sessions = Array.isArray(response.data) ? response.data : [];
        const firstSessionId = sessions[0]?.id ? String(sessions[0].id) : '';
        setRecentCashSessions(sessions);
        setCashReportId((current) => current.trim() || firstSessionId);
        if (firstSessionId) {
          await loadCashReportById(firstSessionId);
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
  }, [canBrowseCashSessions, loadCashReportById]);

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

    await loadCashReportById(normalizedCashReportId);
  }

  async function exportCashReport() {
    if (!cashSessionReport || cashExporting !== null) {
      return;
    }

    const cashSessionId = cashSessionReport.cash_session.id;
    const dateFrom = dateOnly(cashSessionReport.cash_session.opened_at);
    const dateTo = dateOnly(cashSessionReport.cash_session.closed_at ?? cashSessionReport.cash_session.opened_at);

    try {
      setCashError('');
      setCashExporting('excel');
      const blob = await apiClient.downloadReportExport({
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
      });
      downloadBlob(blob, `reporte-caja-${cashSessionId}.xlsx`);
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo exportar la caja.'));
    } finally {
      setCashExporting(null);
    }
  }

  async function exportCashReportPdf() {
    if (!cashSessionReport || cashExporting !== null) {
      return;
    }

    const cashSessionId = cashSessionReport.cash_session.id;
    const dateFrom = dateOnly(cashSessionReport.cash_session.opened_at);
    const dateTo = dateOnly(cashSessionReport.cash_session.closed_at ?? cashSessionReport.cash_session.opened_at);

    try {
      setCashError('');
      setCashExporting('pdf');
      const blob = await apiClient.downloadReportPdf({
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
      });
      openBlobInNewTab(blob, `reporte-caja-${cashSessionId}.pdf`);
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo abrir el PDF de caja.'));
    } finally {
      setCashExporting(null);
    }
  }

  if (!canViewCash && !canViewManagerial) {
    return (
      <EmptyState
        title="Reporte de caja no disponible"
        description="Este usuario no tiene permiso para consultar cajas."
      />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Reporte de caja">
      <OperationalBanner
        meta="Reporte de caja"
        title="Operacion de caja"
        description="Sesiones, cajeros, metodos de pago y diferencias de caja."
      />

      <CashSessionReportTab
        canExport={canExport}
        cashSession={cashSessionReport}
        cashReportId={cashReportId}
        recentCashSessions={recentCashSessions}
        sessionsLoading={cashSessionsLoading}
        loading={cashLoading}
        exporting={cashExporting !== null}
        exportingType={cashExporting}
        error={cashError}
        onCashReportIdChange={(value) => {
          setCashReportId(value);
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
