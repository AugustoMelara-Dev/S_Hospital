import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, FileWarning, LockOpen, ReceiptText, ShoppingCart, TriangleAlert, Wallet } from 'lucide-react';
import { api, isApiError } from '@/lib/api';
import { BUSINESS_TZ, formatLongDate, formatTime } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import { PAYMENT_METHOD_LABEL, type Invoice, type Paginated, type PaymentMethod, type ReportToday } from '@/api/types';
import { useAuth, usePermissions } from '@/auth/hooks';
import { Button, Card, DataTable, EmptyState, KpiTile, Money, PageHeader, Skeleton, StatusStamp, type Column } from '@/ui';
import { buttonSizes, buttonVariants } from '@/ui/Button';
import { useCurrentSession } from '@/features/caja/queries';
import { registerName } from '@/features/caja/types';
import { MethodBars } from '@/features/reportes/MethodBars';
import { cn } from '@/lib/cn';

type RecentInvoice = Pick<Invoice, 'id' | 'number' | 'issued_at' | 'patient_name' | 'status' | 'settlement' | 'total_cents'>;

const forbidden = (e: unknown) => isApiError(e) && e.status === 403;

/** Hour in Honduras business time (0–23). */
export function hondurasHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, hour: '2-digit', hourCycle: 'h23' }).format(now);
  return Number(h) % 24;
}

export function greeting(now: Date = new Date()): string {
  const h = hondurasHour(now);
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

const linkBtn = (variant: 'primary' | 'secondary') =>
  cn(
    'pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium whitespace-nowrap',
    buttonVariants[variant],
    buttonSizes.md,
  );

export default function ResumenPage() {
  const { me } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const canReports = can(['reports.own', 'reports.all']);
  const canInvoices = can('invoices.view');
  const canCash = can('cash.view');

  const today = useQuery({
    queryKey: qk.reportToday,
    queryFn: () => api.get<ReportToday>('/reports/today'),
    enabled: canReports,
    refetchInterval: 30_000,
  });
  const recent = useQuery({
    queryKey: qk.invoices({ per_page: 8 }),
    queryFn: () => api.get<Paginated<RecentInvoice>>('/invoices', { per_page: 8 }),
    enabled: canInvoices,
    refetchInterval: 30_000,
  });
  const cash = useCurrentSession(canCash);

  const showToday = canReports && !forbidden(today.error);
  const showRecent = canInvoices && !forbidden(recent.error);
  const showCash = canCash && !forbidden(cash.error);
  const session = cash.data && cash.data.status === 'open' ? cash.data : null;
  const t = today.data;

  const firstName = me?.name.split(/\s+/)[0] ?? '';
  const dateText = formatLongDate(new Date());

  // "Atención ahora": from today's report, falling back to the current session reconciliation.
  const attention = t?.attention ?? (session?.reconciliation
    ? {
        pending_count: session.reconciliation.pending_count,
        pending_cents: session.reconciliation.pending_cents,
        missing_receipts_count: session.reconciliation.missing_receipts_count,
      }
    : null);
  const attentionKnown = attention !== null;

  const recentCols: Column<RecentInvoice>[] = [
    {
      key: 'doc',
      header: 'Documento',
      cell: (i) => (
        <Link to={`/recibos/${i.id}`} className="num text-brand underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
          {i.number}
        </Link>
      ),
    },
    { key: 'time', header: 'Hora', cell: (i) => <span className="num">{formatTime(i.issued_at)}</span> },
    { key: 'patient', header: 'Paciente', cell: (i) => <span className="line-clamp-1">{i.patient_name}</span> },
    { key: 'status', header: 'Estado', cell: (i) => <StatusStamp status={i} /> },
    { key: 'total', header: 'Total', numeric: true, cell: (i) => <Money cents={i.total_cents} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<span className="normal-case first-letter:uppercase">{dateText}</span>}
        title="Resumen"
        description={
          <span data-testid="resumen-saludo">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`} Así va la operación de hoy.
          </span>
        }
        actions={
          <>
            {can('invoices.create') && (
              <Link to="/cobrar" className={linkBtn('primary')}>
                <ShoppingCart className="size-4" aria-hidden="true" />
                Cobrar
              </Link>
            )}
            {can('cash.open') && showCash && !cash.isPending && !session && (
              <Link to="/caja" className={linkBtn('secondary')}>
                <LockOpen className="size-4" aria-hidden="true" />
                Abrir caja
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {showToday && (
          <section aria-label="Indicadores del día" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Facturado" cents={t?.billed_cents} loading={today.isPending} tone="brand" />
            <KpiTile label="Cobrado" cents={t?.collected_cents} loading={today.isPending} tone="ok" />
            <KpiTile label="Saldo pendiente" cents={t?.pending_cents} loading={today.isPending} tone="warn" />
            <KpiTile
              label="Operaciones sin cobro"
              value={t?.without_charge_count}
              loading={today.isPending}
              hint={t && t.voided_count > 0 ? `${t.voided_count} anuladas hoy` : undefined}
            />
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {showRecent && (
              <Card
                title="Operaciones recientes"
                flush
                actions={
                  <Link to="/recibos" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                    Ver recibos <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                }
              >
                <DataTable
                  caption="Operaciones recientes"
                  columns={recentCols}
                  rows={recent.data?.items}
                  rowKey={(i) => i.id}
                  loading={recent.isPending}
                  skeletonRows={5}
                  density="compact"
                  onRowClick={(i) => navigate(`/recibos/${i.id}`)}
                  empty={<EmptyState compact icon={<ReceiptText />} title="Aún no hay operaciones hoy" />}
                />
              </Card>
            )}
            {showToday && (
              <Card title="Cobros por método">
                {t ? (
                  <MethodBars
                    label="Cobros del día por método"
                    rows={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => {
                      const r = t.by_method.find((x) => x.method === m);
                      return { method: m, amount_cents: r?.amount_cents ?? 0, count: r?.count ?? 0 };
                    })}
                  />
                ) : (
                  <Skeleton lines={4} />
                )}
              </Card>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {showCash && (
              <Card title="Caja y turno actual">
                {cash.isPending ? (
                  <Skeleton lines={3} />
                ) : session ? (
                  <div className="flex flex-col gap-3 text-[13.5px]">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <span aria-hidden="true" className="size-2 rounded-full bg-ok" />
                      {registerName(session)} · abierta desde <span className="num">{formatTime(session.opened_at)}</span>
                    </p>
                    <dl className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-2">Apertura</dt>
                        <dd>
                          <Money cents={session.opening_cents} />
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-2">Efectivo esperado</dt>
                        <dd>
                          <Money cents={session.reconciliation?.expected_cash_cents ?? null} />
                        </dd>
                      </div>
                    </dl>
                    <Link to="/caja" className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-brand hover:underline">
                      Ir a caja <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <p className="flex items-center gap-2 text-[13.5px] text-ink-2">
                      <Wallet className="size-4 text-warn" aria-hidden="true" />
                      Sin caja abierta
                    </p>
                    {can('cash.open') && (
                      <Button size="sm" variant="primary" leftIcon={<LockOpen />} onClick={() => navigate('/caja')}>
                        Abrir caja
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )}

            {(showToday || showCash) && (
              <Card title="Atención ahora">
                {!attentionKnown && (today.isPending || cash.isPending) ? (
                  <Skeleton lines={2} />
                ) : attention && (attention.pending_count > 0 || attention.missing_receipts_count > 0) ? (
                  <ul className="flex flex-col gap-2">
                    {attention.pending_count > 0 && (
                      <li>
                        <Link
                          to="/recibos?pending=1"
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-warn/30 bg-warn-soft px-3 py-2 text-[13.5px] hover:border-warn/50"
                        >
                          <span className="flex items-center gap-2 text-ink">
                            <TriangleAlert className="size-4 text-warn" aria-hidden="true" />
                            {attention.pending_count} {attention.pending_count === 1 ? 'operación pendiente' : 'operaciones pendientes'} de cobro
                          </span>
                          <Money cents={attention.pending_cents} className="text-ink" />
                        </Link>
                      </li>
                    )}
                    {attention.missing_receipts_count > 0 && (
                      <li>
                        <Link
                          to="/recibos?pending=1"
                          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13.5px] text-ink hover:border-danger/50"
                        >
                          <FileWarning className="size-4 text-danger" aria-hidden="true" />
                          {attention.missing_receipts_count}{' '}
                          {attention.missing_receipts_count === 1 ? 'recibo institucional faltante' : 'recibos institucionales faltantes'}
                        </Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-[13.5px] text-ink-2">
                    <CircleCheck className="size-4 text-ok" aria-hidden="true" />
                    No hay pendientes que requieran acción
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>

        {!showToday && !showRecent && !showCash && (
          <Card>
            <EmptyState
              icon={<ReceiptText />}
              title="Sin indicadores disponibles"
              description="Su rol no tiene acceso a reportes, recibos ni caja. Use el menú lateral para ir a sus secciones."
            />
          </Card>
        )}
      </div>
    </>
  );
}
