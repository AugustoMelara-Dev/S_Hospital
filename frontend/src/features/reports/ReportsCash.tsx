import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/states';
import { OperationalBanner } from '@/components/shared';
import { apiClient, type CashSession, userSafeErrorMessage } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { CashSessionReportTab } from './components/CashSessionReportTab';

type ReportsCashProps = {
  canViewCash: boolean;
  canViewManagerial: boolean;
};

export function ReportsCash({
  canViewCash,
  canViewManagerial,
}: ReportsCashProps) {
  const [cashSessionReport, setCashSessionReport] = useState<Awaited<ReturnType<typeof apiClient.getCashSessionReport>> | null>(null);
  const [cashReportId, setCashReportId] = useState('');
  const [cashError, setCashError] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashExporting, setCashExporting] = useState(false);
  const [recentCashSessions, setRecentCashSessions] = useState<CashSession[]>([]);
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false);

  useEffect(() => {
    if (!canViewCash && !canViewManagerial) {
      return;
    }

    let cancelled = false;

    async function loadRecentCashSessions() {
      try {
        setCashSessionsLoading(true);
        const response = await apiClient.getCashSessions({ page: 1, perPage: 5 });
        if (cancelled) return;

        const sessions = Array.isArray(response.data) ? response.data : [];
        setRecentCashSessions(sessions);
        setCashReportId((current) => current.trim() || (sessions[0]?.id ? String(sessions[0].id) : ''));
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
  }, [canViewCash, canViewManagerial]);

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

    try {
      setCashError('');
      setCashLoading(true);
      setCashSessionReport(await apiClient.getCashSessionReport(normalizedCashReportId));
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo cargar la caja.'));
    } finally {
      setCashLoading(false);
    }
  }

  async function exportCashReport() {
    if (!cashSessionReport || cashExporting) {
      return;
    }

    const cashSessionId = cashSessionReport.cash_session.id;
    const dateFrom = dateOnly(cashSessionReport.cash_session.opened_at);
    const dateTo = dateOnly(cashSessionReport.cash_session.closed_at ?? cashSessionReport.cash_session.opened_at);

    try {
      setCashError('');
      setCashExporting(true);
      const blob = await apiClient.downloadReportExport({
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
      });
      downloadBlob(blob, `reporte-caja-${cashSessionId}.xlsx`);
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo exportar la caja.'));
    } finally {
      setCashExporting(false);
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
        canExport={canViewManagerial}
        cashSession={cashSessionReport}
        cashReportId={cashReportId}
        recentCashSessions={recentCashSessions}
        sessionsLoading={cashSessionsLoading}
        loading={cashLoading}
        exporting={cashExporting}
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
