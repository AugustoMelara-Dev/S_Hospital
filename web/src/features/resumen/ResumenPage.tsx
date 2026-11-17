import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, LockOpen, ReceiptText, ShoppingCart } from 'lucide-react';
import { api, isApiError } from '@/lib/api';
import { BUSINESS_TZ, formatDate, formatTime, todayISO } from '@/lib/dates';
import { qk } from '@/api/queryClient';
import {
  PAYMENT_METHOD_LABEL,
  type CashSession,
  type FiscalSequence,
  type InvoiceSummary,
  type Paginated,
  type PaymentMethod,
  type ReportToday,
} from '@/api/types';
import { useAuth, usePermissions } from '@/auth/hooks';
import {
  Card,
  DataTable,
  EmptyState,
  KpiGrid,
  KpiTile,
  Money,
  PageHeader,
  SHIFT_STEP_LABEL,
  ShiftTile,
  Kbd,
  Skeleton,
  StatusGlyph,
  StatusStamp,
  type Column,
  type GlyphShape,
} from '@/ui';
import { buttonSizes, buttonVariants } from '@/ui/Button';
import { useCurrentSession } from '@/features/caja/queries';
import { registerName } from '@/features/caja/types';
import { useShiftSteps } from '@/features/caja/arqueoDraft';
import { MethodBars } from '@/features/reportes/MethodBars';
import { cn } from '@/lib/cn';

type RecentInvoice = Pick<InvoiceSummary, 'id' | 'number' | 'issued_at' | 'patient_name' | 'status' | 'settlement' | 'total_cents'>;

const RECENT_ROWS = 10;

const forbidden = (e: unknown) => isApiError(e) && e.status === 403;

/** Hour in Honduras business time (0–23). */
export function hondurasHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return Number(h) % 24;
}

export function greeting(now: Date = new Date()): string {
  const h = hondurasHour(now);
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

const linkBtn = (variant: 'primary' | 'secondary', size: 'md' | 'lg' = 'md') =>
  cn(
    'pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold whitespace-nowrap',
    buttonVariants[variant],
    buttonSizes[size],
  );

const subtleLink = 'inline-flex items-center gap-1 text-[13px] font-semibold text-slate-text underline-offset-2 hover:underline';

/** Days to warn before the CAI's last emission date. */
export const CAI_WARN_DAYS = 30;

type Tone = 'ok' | 'warn' | 'danger';
type Alert = {
  key: string;
  tone: Tone;
  shape: GlyphShape;
  text: ReactNode;
  aside?: ReactNode;
  to?: string;
};

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T12:00:00Z`) - Date.parse(`${fromISO}T12:00:00Z`)) / 86_400_000);
}

/** Fiscal numbering alerts from GET /fiscal-sequences (active sequences only). */
export function fiscalAlerts(seqs: FiscalSequence[], today: string = todayISO()): Alert[] {
  const out: Alert[] = [];
  for (const s of seqs.filter((x) => x.active)) {
    const to = '/admin/ajustes';
    if (s.expired) {
      out.push({
        key: `exp-${s.id}`,
        tone: 'danger',
        shape: 'struck',
        to,
        text: (
          <>
            CAI vencido el <span className="num">{formatDate(s.valid_until)}</span>
          </>
        ),
      });
    } else {
      const days = daysBetween(today, s.valid_until);
      if (days <= CAI_WARN_DAYS) {
        out.push({
          key: `due-${s.id}`,
          tone: 'warn',
          shape: 'half',
          to,
          text: (
            <>
              CAI vence el <span className="num">{formatDate(s.valid_until)}</span>
            </>
          ),
          aside: <span className="num">{days === 0 ? 'hoy' : days === 1 ? 'en 1 día' : `en ${days} días`}</span>,
        });
      }
    }
    if (s.exhausted) {
      out.push({
        key: `exh-${s.id}`,
        tone: 'danger',
        shape: 'struck',
        to,
        text: 'Rango de numeración agotado',
      });
    } else if (s.low_range) {
      out.push({
        key: `low-${s.id}`,
        tone: 'warn',
        shape: 'half',
        to,
        text: 'Rango por agotarse',
        aside: (
          <span className="num">{s.remaining === 1 ? 'queda 1 número' : `quedan ${s.remaining.toLocaleString('en-US')} números`}</span>
        ),
      });
    }
  }
  return out;
}

function AlertRow({ a }: { a: Alert }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2.5 text-ink">
        <StatusGlyph shape={a.shape} className={TONE_TEXT[a.tone]} />
        <span className="min-w-0">{a.text}</span>
      </span>
      {a.aside && <span className="shrink-0 text-ink-2">{a.aside}</span>}
    </>
  );
  const row = 'flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]';
  return (
    <li className="border-b border-junta last:border-b-0">
      {a.to ? (
        <Link to={a.to} className={cn(row, 'hover:bg-surface-2')}>
          {inner}
        </Link>
      ) : (
        <div className={row}>{inner}</div>
      )}
    </li>
  );
}

/** Shift cell: the brick, what comes next and the way to Caja. Lives in the KPI junta grid. */
function ShiftCell({ session, loading, canOpen }: { session: CashSession | null; loading: boolean; canOpen: boolean }) {
  const { steps, next } = useShiftSteps(session);
  return (
    <section aria-labelledby="resumen-turno" className="flex min-w-0 items-center gap-4 bg-surface px-4 py-3">
      {loading ? (
        <Skeleton lines={3} className="w-full" />
      ) : (
        <>
          <ShiftTile steps={steps} className="size-14" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id="resumen-turno" className="truncate text-[16px] leading-6 font-bold text-ink">
              {session ? registerName(session) : 'Sin caja abierta'}
            </h2>
            <p className="flex flex-wrap gap-x-3 text-[12.5px] leading-4 text-ink-2">
              {session && (
                <span>
                  Abierta desde <span className="num text-ink">{formatTime(session.opened_at)}</span>
                </span>
              )}
              {next && (
                <span>
                  Sigue: <span className="font-semibold text-ink">{SHIFT_STEP_LABEL[next]}</span>
                </span>
              )}
              {session?.reconciliation && (
                <span>
                  Efectivo esperado <Money cents={session.reconciliation.expected_cash_cents} className="font-semibold text-ink" />
                </span>
              )}
            </p>
          </div>
          {session ? (
            <Link to="/caja" className={cn(linkBtn('secondary'), 'shrink-0')}>
              Ir a caja <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            canOpen && (
              <Link to="/caja" className={cn(linkBtn('primary'), 'shrink-0')}>
                <LockOpen className="size-4" aria-hidden="true" />
                Abrir caja
              </Link>
            )
          )}
        </>
      )}
    </section>
  );
}

/** Empty day: the Cobrar entry as the main block, next to the shift. */
function CobrarEntry({ primary }: { primary: boolean }) {
  return (
    <section aria-labelledby="resumen-cobrar" className="flex min-w-0 flex-col justify-center gap-3 bg-surface px-5 py-5">
      <div className="flex flex-col gap-1">
        <h2 id="resumen-cobrar" className="text-[18px] leading-6 font-bold text-ink">
          Aún no hay operaciones hoy
        </h2>
        <p className="text-[13.5px] leading-5 text-ink-2">
          La primera cuenta del día empieza en Cobrar. Desde cualquier pantalla, <Kbd>F2</Kbd> abre una operación nueva.
        </p>
      </div>
      <Link
        to="/cobrar"
        aria-keyshortcuts="F2"
        className={cn(
          linkBtn(primary ? 'primary' : 'secondary', 'lg'),
          'h-12 justify-between self-stretch px-5 text-[16px] sm:self-start sm:min-w-[260px]',
        )}
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingCart className="size-4" aria-hidden="true" />
          Cobrar
        </span>
        <span aria-hidden="true" className="inline-flex">
          <Kbd tone={primary ? 'oxide' : 'default'}>F2</Kbd>
        </span>
      </Link>
    </section>
  );
}

/** Empty day: today's zero figures in one compact ledger line instead of a row of zero tiles. */
function TodayStrip({ t }: { t: ReportToday }) {
  const items: Array<[string, ReactNode]> = [
    ['Facturado', <Money key="b" cents={t.billed_cents} />],
    ['Cobrado', <Money key="c" cents={t.collected_cents} />],
    ['Saldo pendiente', <Money key="p" cents={t.pending_cents} />],
    [
      'Operaciones sin cobro',
      <span key="w" className="num">
        {t.without_charge_count}
      </span>,
    ],
  ];
  return (
    <dl
      aria-label="Indicadores del día"
      className="flex flex-wrap items-center gap-x-6 gap-y-1 border-y border-junta px-1 py-2.5 text-[13px] text-ink-2"
    >
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-2">
          <dt>{label}</dt>
          <dd className="font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ResumenPage() {
  const { me } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const canReports = can(['reports.own', 'reports.all']);
  const canInvoices = can('invoices.view');
  const canCash = can('cash.view');
  const canFiscal = can('settings.view');

  const today = useQuery({
    queryKey: qk.reportToday,
    queryFn: () => api.get<ReportToday>('/reports/today'),
    enabled: canReports,
    refetchInterval: 30_000,
  });
  const recent = useQuery({
    queryKey: qk.invoices({ per_page: RECENT_ROWS }),
    queryFn: () => api.get<Paginated<RecentInvoice>>('/invoices', { per_page: RECENT_ROWS }),
    enabled: canInvoices,
    refetchInterval: 30_000,
  });
  const fiscal = useQuery({
    queryKey: ['fiscal-sequences', 'alerts'],
    queryFn: async () => (await api.get<Paginated<FiscalSequence>>('/fiscal-sequences')).items,
    enabled: canFiscal,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const cash = useCurrentSession(canCash);

  const showToday = canReports && !forbidden(today.error);
  const showRecent = canInvoices && !forbidden(recent.error);
  const showCash = canCash && !forbidden(cash.error);
  const session = cash.data && cash.data.status === 'open' ? cash.data : null;
  const t = today.data;

  const firstName = me?.name.split(/\s+/)[0] ?? '';
  // Without an open drawer the primary action of the screen is opening it.
  const needsOpening = showCash && !cash.isPending && !session && can('cash.open');

  // "Atención ahora": from today's report, falling back to the current session reconciliation.
  const attention =
    t?.attention ??
    (session?.reconciliation
      ? {
          pending_count: session.reconciliation.pending_count,
          pending_cents: session.reconciliation.pending_cents,
          missing_receipts_count: session.reconciliation.missing_receipts_count,
        }
      : null);
  const attentionKnown = attention !== null;

  const alerts: Alert[] = [];
  if (attention && attention.pending_count > 0) {
    alerts.push({
      key: 'pending',
      tone: 'warn',
      shape: 'hollow',
      to: '/recibos?pending=1',
      text: `${attention.pending_count} ${attention.pending_count === 1 ? 'operación pendiente' : 'operaciones pendientes'} de cobro`,
      aside: <Money cents={attention.pending_cents} className="text-ink" />,
    });
  }
  if (attention && attention.missing_receipts_count > 0) {
    alerts.push({
      key: 'receipts',
      tone: 'danger',
      shape: 'struck',
      to: '/recibos?pending=1',
      text: `${attention.missing_receipts_count} ${
        attention.missing_receipts_count === 1 ? 'recibo institucional faltante' : 'recibos institucionales faltantes'
      }`,
    });
  }
  if (fiscal.data) alerts.push(...fiscalAlerts(fiscal.data));

  const recentCols: Column<RecentInvoice>[] = [
    {
      key: 'doc',
      header: 'Documento',
      width: '190px',
      cell: (i) => (
        <Link
          to={`/recibos/${i.id}`}
          className="num font-medium text-slate-text underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {i.number}
        </Link>
      ),
    },
    {
      key: 'time',
      header: 'Hora',
      width: '72px',
      cell: (i) => <span className="num">{formatTime(i.issued_at)}</span>,
    },
    {
      key: 'patient',
      header: 'Paciente',
      cell: (i) => <span className="line-clamp-1">{i.patient_name}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '170px',
      cell: (i) => <StatusStamp status={i} />,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      width: '130px',
      cell: (i) => <Money cents={i.total_cents} />,
    },
  ];

  const showAttention = showToday || showCash || (canFiscal && fiscal.isSuccess);
  // No operations today: the shift and the way into Cobrar take the page; zero figures collapse.
  const emptyDay = showToday && !!t && t.invoices_count === 0 && t.payments_count === 0;
  const canCreate = can('invoices.create');
  const recentShown = showRecent && (!emptyDay || (recent.data?.items.length ?? 0) > 0);

  return (
    <>
      <PageHeader
        title="Resumen"
        className="pb-4"
        description={
          <span data-testid="resumen-saludo">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`} Así va la operación de hoy.
          </span>
        }
        actions={
          canCreate &&
          !emptyDay && (
            <Link to="/cobrar" className={linkBtn(needsOpening ? 'secondary' : 'primary', 'lg')}>
              <ShoppingCart className="size-4" aria-hidden="true" />
              Cobrar
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {emptyDay && t && (
          <>
            <div
              className={cn(
                'grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta',
                showCash && canCreate && 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]',
              )}
            >
              {showCash && (
                <div className="flex bg-surface [&>section]:flex-1 [&>section]:py-6">
                  <ShiftCell session={session} loading={cash.isPending} canOpen={can('cash.open')} />
                </div>
              )}
              {canCreate && <CobrarEntry primary={!needsOpening} />}
            </div>
            <TodayStrip t={t} />
          </>
        )}

        {!emptyDay && (showCash || showToday) && (
          <KpiGrid
            aria-label="Indicadores del día"
            className={cn(
              'grid-cols-2 [&>*]:justify-center',
              showCash && showToday
                ? 'xl:grid-cols-[minmax(400px,1.7fr)_repeat(4,minmax(0,1fr))] [&>section]:col-span-2 xl:[&>section]:col-span-1'
                : 'md:grid-cols-4',
              showCash && !showToday && 'grid-cols-1 md:grid-cols-1',
            )}
          >
            {showCash && <ShiftCell session={session} loading={cash.isPending} canOpen={can('cash.open')} />}
            {showToday && (
              <>
                <KpiTile
                  label="Facturado"
                  cents={t?.billed_cents}
                  loading={today.isPending}
                  hint={t ? `${t.invoices_count} ${t.invoices_count === 1 ? 'operación' : 'operaciones'}` : undefined}
                />
                <KpiTile
                  label="Cobrado"
                  cents={t?.collected_cents}
                  loading={today.isPending}
                  tone="ok"
                  hint={t ? `${t.payments_count} ${t.payments_count === 1 ? 'cobro' : 'cobros'}` : undefined}
                />
                <KpiTile
                  label="Saldo pendiente"
                  cents={t?.pending_cents}
                  loading={today.isPending}
                  tone={t && t.pending_cents > 0 ? 'warn' : 'neutral'}
                  hint={attention ? `${attention.pending_count} por cobrar` : undefined}
                />
                <KpiTile
                  label="Operaciones sin cobro"
                  value={t?.without_charge_count}
                  loading={today.isPending}
                  hint={t ? (t.voided_count > 0 ? `${t.voided_count} anuladas hoy` : 'Sin anulaciones hoy') : undefined}
                />
              </>
            )}
          </KpiGrid>
        )}

        {(recentShown || showAttention) && (
          <div
            className={cn(
              'grid items-start gap-4',
              recentShown && showAttention && 'xl:grid-cols-[minmax(0,2.1fr)_minmax(340px,1fr)]',
              !recentShown && emptyDay && 'lg:max-w-[50%]',
            )}
          >
            {recentShown && (
              <Card
                title="Operaciones recientes"
                flush
                className="min-w-0 overflow-hidden"
                actions={
                  <Link to="/recibos" className={subtleLink}>
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

            {showAttention && (
              <div className="flex min-w-0 flex-col gap-4">
                <Card title="Atención ahora" flush className="overflow-hidden">
                  {!attentionKnown && (today.isPending || cash.isPending) ? (
                    <div className="p-4">
                      <Skeleton lines={2} />
                    </div>
                  ) : alerts.length > 0 ? (
                    <ul className="flex flex-col">
                      {alerts.map((a) => (
                        <AlertRow key={a.key} a={a} />
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] text-ink-2">
                      <StatusGlyph shape="filled" className="text-ok" />
                      No hay pendientes que requieran acción
                    </p>
                  )}
                </Card>
                {showToday && !emptyDay && (
                  <Card title="Cobros por método">
                    {t ? (
                      <MethodBars
                        label="Cobros del día por método"
                        rows={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => {
                          const r = t.by_method.find((x) => x.method === m);
                          return {
                            method: m,
                            amount_cents: r?.amount_cents ?? 0,
                            count: r?.count ?? 0,
                          };
                        })}
                      />
                    ) : (
                      <Skeleton lines={4} />
                    )}
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

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
