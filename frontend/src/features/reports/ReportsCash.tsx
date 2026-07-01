import { useState } from 'react';
import { EmptyState } from '@/components/ui/states';
import { OperationalBanner } from '@/components/shared';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
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

  async function loadCashReport() {
    if (!cashReportId.trim()) {
      setCashError('Ingrese el numero de caja.');
      return;
    }
    try {
      setCashError('');
      setCashSessionReport(await apiClient.getCashSessionReport(cashReportId));
    } catch (err) {
      setCashError(userSafeErrorMessage(err, 'No se pudo cargar la caja.'));
    }
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
        loading={false}
        exporting={false}
        error={cashError}
        onCashReportIdChange={setCashReportId}
        onExport={() => {}}
        onSubmit={(event) => {
          event.preventDefault();
          void loadCashReport();
        }}
      />

      {!canViewCash && !canViewManagerial ? (
        <EmptyState
          title="Reporte de caja no disponible"
          description="Este usuario no tiene permiso para consultar cajas."
        />
      ) : null}
    </section>
  );
}
