import {
  Activity,
  ClipboardList,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { type CashSession, type DailyReport, apiClient } from '../../lib/api';

type DashboardViewProps = {
  canCreateInvoices: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewManagerialReports: boolean;
  canViewReports: boolean;
  cashSession: CashSession | null;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
  onStatus: (message: string) => void;
};

const today = localDateString();

export function DashboardView({
  canCreateInvoices,
  canViewBackups,
  canViewCash,
  canViewCatalog,
  canViewFiscalSettings,
  canViewInvoices,
  canViewManagerialReports,
  canViewReports,
  cashSession,
  onQuickCash,
  onQuickInvoice,
  onStatus,
}: DashboardViewProps) {
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyError, setDailyError] = useState('');
  const [loadingDaily, setLoadingDaily] = useState(false);

  useEffect(() => {
    if (!canViewManagerialReports) {
      return;
    }

    let active = true;
    setLoadingDaily(true);

    apiClient
      .getDailyReport(today)
      .then((report) => {
        if (!active) {
          return;
        }

        setDailyReport(report);
        setDailyError('');
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : 'No se pudo cargar el resumen diario.';
        setDailyError(message);
        onStatus(message);
      })
      .finally(() => {
        if (active) {
          setLoadingDaily(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewManagerialReports, onStatus]);

  const enabledModuleCount = [
    canCreateInvoices,
    canViewBackups,
    canViewCash,
    canViewCatalog,
    canViewFiscalSettings,
    canViewInvoices,
    canViewReports,
  ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Panel operativo para caja hospitalaria local. Prioriza facturacion, caja abierta y estado del dia."
      />

      <div className="grid gap-4">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores del dia">
          <MetricCard
            helper={cashSession ? 'Lista para cobrar facturas.' : 'Abrir caja antes de operar POS.'}
            label="Caja activa"
            value={cashSession ? `#${cashSession.id}` : 'Sin caja'}
            variant={cashSession ? 'success' : 'warning'}
          />
          <MetricCard
            helper={canViewManagerialReports ? 'Total emitido segun backend.' : 'Requiere permiso gerencial.'}
            label="Facturado hoy"
            value={dailyReport ? `L. ${dailyReport.total_billed}` : loadingDaily ? 'Cargando...' : 'No disponible'}
          />
          <MetricCard
            helper={canViewManagerialReports ? 'Pagos registrados del dia.' : 'Requiere permiso gerencial.'}
            label="Cobrado hoy"
            value={dailyReport ? `L. ${dailyReport.total_collected}` : loadingDaily ? 'Cargando...' : 'No disponible'}
          />
          <MetricCard
            helper={dailyReport ? `${dailyReport.payment_count} pagos registrados.` : 'Resumen operativo.'}
            label="Facturas hoy"
            value={dailyReport ? String(dailyReport.invoice_count) : loadingDaily ? '...' : 'No disponible'}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <Activity className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Estado operativo</CardTitle>
                <CardDescription>Lo minimo que caja debe saber antes de atender.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusRow label="Caja" ok={Boolean(cashSession)} text={cashSession ? 'Abierta' : 'Pendiente'} />
            <StatusRow label="Reportes" ok={!dailyError} text={dailyError || 'Sin alertas visibles'} />
            <StatusRow label="Modulos" ok={enabledModuleCount > 0} text={`${enabledModuleCount} disponibles`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Siguiente accion</CardTitle>
            <CardDescription>
              Un solo camino principal, sin repetir el tablero completo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!cashSession && canViewCash ? (
              <Button type="button" onClick={onQuickCash}>
                <WalletCards aria-hidden="true" />
                Abrir caja
              </Button>
            ) : canCreateInvoices ? (
              <Button type="button" onClick={onQuickInvoice}>
                <ReceiptText aria-hidden="true" />
                Emitir factura
              </Button>
            ) : null}
            {canViewReports ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <ClipboardList aria-hidden="true" />
                Revise reportes solo cuando ya haya movimientos del dia.
              </div>
            ) : null}
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  helper,
  label,
  value,
  variant = 'neutral',
}: {
  helper: string;
  label: string;
  value: string;
  variant?: 'neutral' | 'success' | 'warning';
}) {
  const badge = {
    neutral: 'Operativo',
    success: 'Listo',
    warning: 'Atencion',
  }[variant];

  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Badge variant={variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'info'}>{badge}</Badge>
      </div>
      <strong className="text-2xl">{value}</strong>
      <p className="text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function StatusRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
      <span className="text-sm font-semibold">{label}</span>
      <Badge variant={ok ? 'secondary' : 'outline'}>{text}</Badge>
    </div>
  );
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
