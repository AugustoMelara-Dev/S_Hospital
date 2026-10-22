import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BanknoteIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClockIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  WalletIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { billing, reports, type CashSession, type Invoice, userSafeErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import {
  AdminCallout,
  AdminChip,
  AdminEmpty,
  AdminStat,
  AdminStatBand,
  AdminTable,
  AdminPageHeader,
  MoneyText,
  StatusStamp,
  type AdminColumn,
} from '@/design-system/admin/components';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { cn } from '@/lib/utils';
import {
  apiMoneyCents,
  buildResumenAttention,
  buildResumenMetrics,
  invoiceTotalCents,
  operationDisplay,
  reportScopeLabel,
  type ResumenAttentionItem,
} from './resumenModel';

const RECENT_OPERATIONS_LIMIT = 8;

/**
 * Resumen operativo del período y ámbito autorizados. Las cohortes contables
 * permanecen separadas y los datos ausentes nunca se presentan como cero.
 */
export function ResumenView() {
  const navigate = useNavigate();
  const { has, user, cashSession, cashSessionLoading } = useAdminSession();
  const canViewInvoices = has('invoices.view');
  const isManagerial = has('reports.managerial.view');

  const todayQuery = useQuery({
    queryKey: queryKeys.reports.today(),
    queryFn: () => reports.getTodayReport(),
  });
  const today = todayQuery.data;

  const recentQuery = useQuery({
    queryKey: queryKeys.invoices.list({ per_page: RECENT_OPERATIONS_LIMIT }),
    queryFn: () => billing.getInvoices({ per_page: RECENT_OPERATIONS_LIMIT }),
    enabled: canViewInvoices,
  });

  const metrics = today ? buildResumenMetrics(today) : null;
  const attention = today ? buildResumenAttention(today, cashSession) : [];
  const recentInvoices = recentQuery.data?.data ?? [];
  const recentTotal = recentQuery.data?.meta.total ?? recentInvoices.length;
  const todayError = todayQuery.isError
    ? userSafeErrorMessage(todayQuery.error, 'No se pudo cargar el corte del día.')
    : null;
  const recentError = recentQuery.isError
    ? userSafeErrorMessage(recentQuery.error, 'No se pudieron cargar las operaciones recientes.')
    : null;

  return (
    <section aria-labelledby="resumen-title" className="flex flex-col gap-7">
      {/* Encabezado Principal */}
      <AdminPageHeader
        headingId="resumen-title"
        title="Resumen"
        description="Turno, cobros y operaciones del día en un solo lugar."
        meta={
          <>
            <AdminChip tone={isManagerial ? 'accent' : 'neutral'}>
              {reportScopeLabel(isManagerial)}
            </AdminChip>
            <AdminChip>{today ? `Hoy · ${today.date}` : 'Hoy'}</AdminChip>
          </>
        }
        actions={
          <ResumenPrimaryAction
            canCreateInvoices={has('invoices.create')}
            canViewCash={has('cash.view')}
            session={cashSession}
            loading={cashSessionLoading}
          />
        }
      />

      <ShiftSummary
        session={cashSession}
        loading={cashSessionLoading}
        userName={user.name}
        canViewCash={has('cash.view')}
      />

      {todayQuery.isLoading ? (
        <div role="region" aria-label="Métricas del corte" aria-busy="true">
          <div className="rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)] p-6 text-center text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Cargando métricas del corte…
          </div>
        </div>
      ) : todayError ? (
        <AdminCallout tone="error" title="No se pudo cargar el corte del día">
          <div className="flex flex-col gap-2">
            <span>{todayError}</span>
            <button
              type="button"
              data-ui-press
              onClick={() => void todayQuery.refetch()}
              className="inline-flex min-h-10 w-fit items-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              Reintentar
            </button>
          </div>
        </AdminCallout>
      ) : metrics ? (
        <section aria-label="Métricas del corte" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="resumen-corte-title" className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">
              Actividad de hoy
            </h2>
            <span className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-faint)]">
              {today?.date ? `Corte ${today.date}` : 'Fecha no disponible'}
            </span>
          </div>
          <AdminStatBand role="group" aria-label="Cohortes del corte" columns={4}>
            {metrics.map((metric) => (
              <AdminStat
                key={metric.key}
                label={metric.label}
                tone={metric.tone}
                value={
                  metric.kind === 'money' ? (
                    <MoneyText cents={metric.valueCents} emphasis="strong" />
                  ) : metric.valueCount === null ? (
                    'No disponible'
                  ) : (
                    `${metric.valueCount} ${metric.valueCount === 1 ? 'operación' : 'operaciones'}`
                  )
                }
                hint={
                  <div className="flex flex-col gap-1.5 normal-case tracking-normal">
                    <span>{metric.context}</span>
                    <MetricDefinition detail={metric.detail} />
                  </div>
                }
              />
            ))}
          </AdminStatBand>
        </section>
      ) : null}

      <div className="flex w-full flex-col items-start gap-7">
        {attention.length > 0 ? <AttentionNowPanel items={attention} /> : null}

        <section aria-label="Operaciones recientes" className="w-full min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ui-line)] pb-3">
            <div>
              <h2 className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">
                Operaciones recientes
              </h2>
              <p className="mt-0.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                {canViewInvoices
                  ? 'Las últimas registradas, con su estado y total.'
                  : 'Su rol no permite consultar este listado.'}
              </p>
            </div>
            {canViewInvoices && recentTotal > recentInvoices.length ? (
              <Link
                to="/recibos"
                data-ui-press
                aria-label={`Ver todas las operaciones (${recentTotal})`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--ui-radius-control)] px-2 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action)] hover:bg-[var(--ui-action-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
              >
                Ver todas ({recentTotal})
                <ArrowRightIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </Link>
            ) : null}
          </header>
          {!canViewInvoices ? (
            <div className="py-4">
              <AdminCallout tone="info" title="Sin permiso para el listado">
                Su rol no incluye consultar el listado de operaciones. Solicite el permiso para verlo.
              </AdminCallout>
            </div>
          ) : recentQuery.isLoading ? (
            <p role="status" className="py-10 text-center text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
              Cargando operaciones recientes…
            </p>
          ) : recentError ? (
            <div className="py-4">
              <AdminCallout tone="error" title="No se pudieron cargar las operaciones recientes">
                <div className="flex flex-col gap-2">
                  <span>{recentError}</span>
                  <button
                    type="button"
                    data-ui-press
                    onClick={() => void recentQuery.refetch()}
                    className="inline-flex min-h-10 w-fit items-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    Reintentar
                  </button>
                </div>
              </AdminCallout>
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="py-5">
              <AdminEmpty
                title="Aún no hay operaciones en el período"
                description="Cree una en Cobrar: la operación aparecerá aquí con su estado y total."
                action={
                  has('invoices.create') ? (
                    <Link
                      to="/cobrar"
                      data-ui-press
                      className="inline-flex h-[var(--ui-control-h)] items-center rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-4 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-action-hover)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                    >
                      Ir a Cobrar
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AdminTable<Invoice>
                caption="Operaciones recientes"
                className="mt-3 hidden rounded-[var(--ui-radius-panel)] md:block"
                rows={recentInvoices}
                getRowKey={(row) => String(row.id)}
                columns={recentColumns}
                mobileCards={false}
                onRowClick={(row) => navigate(`/recibos?operacion=${row.id}`)}
                rowAriaLabel={(row) => `Abrir operación ${row.invoice_number} de ${row.patient_name}`}
                empty="Sin operaciones en el período."
              />
              <ul className="mt-2 divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)] md:hidden" aria-label="Operaciones recientes">
                {recentInvoices.map((row) => {
                  const display = operationDisplay(row);
                  const href = `/recibos?operacion=${row.id}`;

                  return (
                    <li key={row.id}>
                      <Link
                        to={href}
                        aria-label={`Abrir operación ${row.invoice_number} de ${row.patient_name}`}
                        className="flex flex-col gap-1.5 px-4 py-3 transition-[background-color] duration-[120ms] ease-out hover:bg-[var(--ui-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ui-focus)]"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold tabular-nums text-[color:var(--ui-ink)]">
                            {row.invoice_number}
                          </span>
                          <MoneyText cents={invoiceTotalCents(row)} emphasis="strong" />
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                          <span className="min-w-0 truncate font-medium">{row.patient_name}</span>
                          <span className="shrink-0 tabular-nums">{formatDateTimeEs(row.issued_at)}</span>
                        </div>
                        <div className="pt-0.5">
                          <StatusStamp status={display.adminStatus} label={display.label} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

/**
 * Resumen compacto del turno. Informa contexto operativo sin competir con el
 * corte ni convertirse en una cabecera promocional.
 */
function ShiftSummary({
  session,
  loading,
  userName,
  canViewCash,
}: {
  session: CashSession | null;
  loading: boolean;
  userName: string;
  canViewCash: boolean;
}) {
  const isOpen = session?.status === 'open';
  const expectedCents = session
    ? apiMoneyCents(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount)
    : null;
  const pendingCents = isOpen && session ? apiMoneyCents(session.pending_amount) : null;
  const openedAt = session?.opened_at ?? null;

  return (
    <div
      role="region"
      aria-label="Caja y turno actual"
      className="border-y border-[var(--ui-line)] bg-[var(--ui-surface)] py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Identidad del cajero y estado de sesión */}
        <div className="flex items-center gap-3 px-1">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border text-[color:var(--ui-ink)]',
              isOpen
                ? 'border-[var(--ui-action-subtle-strong)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]'
                : 'border-[var(--ui-line)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]',
            )}
          >
            <UserRoundIcon className="size-4" strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--ui-text-sm)] font-bold text-[color:var(--ui-ink)]">
                {session?.user?.name ?? session?.user?.username ?? userName}
              </span>
              {loading ? (
                <AdminChip>Consultando caja…</AdminChip>
              ) : isOpen ? (
                <AdminChip tone="accent">
                  <span className="size-1.5 rounded-full bg-[var(--ui-action)]" />
                  Caja abierta · Sesión #{session?.id}
                </AdminChip>
              ) : (
                <AdminChip tone="neutral">Sin caja abierta</AdminChip>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              {isOpen && openedAt ? (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <ClockIcon className="size-3" strokeWidth={1.5} />
                  Abierta desde {formatDateTimeEs(openedAt)}
                </span>
              ) : (
                <span>No hay turno activo para emitir cobros</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen monetario del turno activo */}
        <div className="flex flex-wrap items-center gap-4 border-t border-[var(--ui-line)] px-1 pt-3 lg:border-t-0 lg:pt-0">
          {isOpen && session ? (
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col">
                <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                  Apertura
                </span>
                <MoneyText
                  cents={apiMoneyCents(session.opening_amount)}
                  className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]"
                />
              </div>

              <div className="h-7 w-px bg-[var(--ui-line)]" />

              <div className="flex flex-col">
                <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                  Efectivo esperado
                </span>
                <MoneyText
                  cents={expectedCents}
                  emphasis="strong"
                  className="text-[length:var(--ui-text-base)] font-bold text-[color:var(--ui-ink)]"
                />
              </div>

              {pendingCents !== null && pendingCents > 0 ? (
                <>
                  <div className="h-7 w-px bg-[var(--ui-line)]" />
                  <div className="flex flex-col">
                    <span className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-warn)]">
                      Saldo pendiente
                    </span>
                    <MoneyText
                      cents={pendingCents}
                      className="text-[length:var(--ui-text-sm)] font-bold text-[color:var(--ui-warn)]"
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Enlace rápido a Caja */}
          {canViewCash && isOpen ? (
            <Link
              to="/caja"
              data-ui-press
              className="inline-flex items-center gap-1 rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <WalletIcon className="size-3.5" strokeWidth={1.5} />
              Ver caja
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricDefinition({ detail }: { detail: string }) {
  return (
    <details className="group">
      <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1 rounded-[var(--ui-radius)] text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)] transition-colors duration-[150ms] ease-[var(--ui-ease-out)] hover:text-[color:var(--ui-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] marker:content-none">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-[rotate] duration-[150ms] ease-[var(--ui-ease-out)] group-open:rotate-90 motion-reduce:transition-none"
        />
        Definición
      </summary>
      <p className="mt-1.5 text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]">
        {detail}
      </p>
    </details>
  );
}

/**
 * Panel de Atención Inmediata:
 * Muestra las tareas críticas que requieren acción en el turno actual
 * (operaciones pendientes de cobro, recibos por emitir, etc.).
 */
function AttentionNowPanel({ items }: { items: ResumenAttentionItem[] }) {
  return (
    <section aria-label="Atención ahora" className="w-full border-l-2 border-[var(--ui-warn)] pl-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--ui-line)] pb-2.5">
        <h2 className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">
          Atención ahora
        </h2>
        <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          {items.length} {items.length === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          No hay pendientes que requieran acción.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--ui-line)]">
          {items.map((item) => (
            <li key={item.key} data-resumen-attention={item.key} className="flex flex-col gap-2.5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {item.tone === 'danger' ? (
                    <CircleAlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-danger)]"
                      strokeWidth={2}
                    />
                  ) : (
                    <TriangleAlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-[color:var(--ui-warn)]"
                      strokeWidth={2}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[length:var(--ui-text-sm)] font-bold text-[color:var(--ui-ink)]">
                      {item.label}
                      {item.count !== null ? (
                        <span className="ml-2 rounded-full bg-[var(--ui-surface-alt)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium tabular-nums text-[color:var(--ui-ink-soft)]">
                          {item.count} {item.count === 1 ? 'operación' : 'operaciones'}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                      {item.hint}
                    </p>
                  </div>
                </div>
                {item.amountCents !== null ? (
                  <MoneyText cents={item.amountCents} emphasis="strong" className="shrink-0 text-[length:var(--ui-text-base)]" />
                ) : null}
              </div>
              <div className="pl-8">
                <Link
                  to={item.to}
                  data-ui-press
                  className="inline-flex items-center gap-1.5 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action)] hover:underline"
                >
                  {item.ctaLabel}
                  <ArrowRightIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const recentColumns: AdminColumn<Invoice>[] = [
  {
    key: 'invoice_number',
    header: 'Documento',
    mobilePrimary: true,
    cell: (row) => <span className="font-semibold tabular-nums text-[color:var(--ui-ink)]">{row.invoice_number}</span>,
  },
  {
    key: 'issued_at',
    header: 'Fecha / Hora',
    className: 'whitespace-nowrap',
    cell: (row) => <span className="text-[color:var(--ui-ink-soft)]">{formatDateTimeEs(row.issued_at)}</span>,
  },
  {
    key: 'patient_name',
    header: 'Paciente',
    cell: (row) => <span className="block max-w-64 truncate font-medium text-[color:var(--ui-ink)]">{row.patient_name}</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    className: 'whitespace-nowrap',
    cell: (row) => {
      const display = operationDisplay(row);
      return <StatusStamp status={display.adminStatus} label={display.label} />;
    },
  },
  {
    key: 'total',
    header: 'Total Facturado',
    align: 'right',
    className: 'whitespace-nowrap font-medium',
    mobilePrimary: true,
    cell: (row) => <MoneyText cents={invoiceTotalCents(row)} emphasis="strong" />,
  },
];

function ResumenPrimaryAction({
  canCreateInvoices,
  canViewCash,
  session,
  loading,
}: {
  canCreateInvoices: boolean;
  canViewCash: boolean;
  session: CashSession | null;
  loading: boolean;
}) {
  if (loading) {
    return <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Consultando caja…</span>;
  }

  if (session?.status === 'open' && canCreateInvoices) {
    return (
      <Link
        to="/cobrar"
        data-ui-press
        className="inline-flex h-[var(--ui-control-h-operational)] items-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-4 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-action-hover)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <BanknoteIcon className="size-4" strokeWidth={2} />
        Cobrar
      </Link>
    );
  }

  if (session?.status !== 'open' && canViewCash) {
    return (
      <Link
        to="/caja"
        data-ui-press
        className="inline-flex h-[var(--ui-control-h-operational)] items-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-4 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-action-hover)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <WalletIcon className="size-4" strokeWidth={2} />
        Abrir caja
      </Link>
    );
  }

  return null;
}
