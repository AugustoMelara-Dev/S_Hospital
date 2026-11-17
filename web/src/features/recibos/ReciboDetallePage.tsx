import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileCheck, FileQuestion, Printer, Undo2, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, downloadFile, errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatCents, formatHundredths } from '@/lib/money';
import { qk } from '@/api/queryClient';
import {
  PAYMENT_METHOD_LABEL,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type Invoice,
  type Receipt,
  type ReceiptSummary,
} from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, ConfirmDialog, EmptyState, PageHeader, Skeleton, StatusGlyph, StatusStamp, toast } from '@/ui';
import { Amount, Dash } from './components/Amount';
import { invalidateAfterOperation, openReceiptPdf } from './api';
import { PaymentDialog } from './components/PaymentDialog';
import { ReceiptButtons } from './components/ReceiptButtons';
import { TotalsList, TotalsRow } from './components/TotalsList';

type Attempt = { key: string; fingerprint: string };
/** Same key while the body is unchanged, so a retry replays instead of duplicating. */
function keyFor(store: Record<string, Attempt | undefined>, name: string, fingerprint: string): string {
  const prev = store[name];
  if (prev && prev.fingerprint === fingerprint) return prev.key;
  const key = newIdempotencyKey();
  store[name] = { key, fingerprint };
  return key;
}

type ReasonAction = 'void' | 'reverse' | 'reprint';

const REASON_DIALOG: Record<
  ReasonAction,
  { title: string; description: string; label: string; confirm: string; tone: 'primary' | 'danger' }
> = {
  void: {
    title: 'Anular factura',
    description: 'Esta acción no se puede deshacer.',
    label: 'Motivo de anulación',
    confirm: 'Anular factura',
    tone: 'danger',
  },
  reverse: {
    title: 'Revertir factura',
    description: 'Se anulan los pagos, el recibo y la factura. Esta acción no se puede deshacer.',
    label: 'Motivo de reversión',
    confirm: 'Revertir',
    tone: 'danger',
  },
  reprint: {
    title: 'Reimprimir recibo',
    description: 'No genera cobros ni números nuevos.',
    label: 'Motivo de reimpresión',
    confirm: 'Reimprimir',
    tone: 'primary',
  },
};

/** One cell of the document ledger: label over value, ruled right and bottom by the junta. */
function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 border-r border-b border-junta px-4 py-2.5', className)}>
      <dt className="text-[12px] leading-4 font-semibold text-ink-2">{label}</dt>
      <dd className="min-w-0 text-[14px] leading-5 break-words text-ink">{children}</dd>
    </div>
  );
}

/** Surface panel with a header row ruled by the junta; tables run edge to edge. */
function Panel({ title, aside, className, children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface', className)}>
      <header className="flex h-10 items-center justify-between gap-3 border-b border-junta px-4">
        <h3 className="text-[15px] leading-5 font-bold text-ink">{title}</h3>
        {aside && <span className="text-[12.5px] text-ink-2">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

const cellRule = 'border-b border-l border-junta first:border-l-0';
const th = cn(cellRule, 'h-8 px-3 text-[12px] leading-4 font-semibold whitespace-nowrap text-ink-2');
const td = cn(cellRule, 'h-11 px-3 py-2 align-middle');
const tableClass = 'w-full border-collapse text-[14px] leading-5 [&>tbody>tr:last-child>td]:border-b-0';

export function useInvoiceDetail(id: number) {
  return useQuery({
    queryKey: qk.invoice(id),
    queryFn: ({ signal }) => api.get<Invoice>(`/invoices/${id}`, undefined, { signal }),
    enabled: Number.isInteger(id) && id > 0,
  });
}

/** Full receipt (issue date, amount in words, print events) for the "Comprobante" card. */
function useReceiptDetail(receiptId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['receipts', 'detail', receiptId],
    queryFn: ({ signal }) => api.get<Receipt>(`/receipts/${receiptId}`, undefined, { signal }),
    enabled: enabled && receiptId !== null,
  });
}

/** Invoice detail: lines, totals, payments, receipt, document info and gated actions. */
export function ReciboDetalle({ id }: { id: number }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { data: inv, isPending, isError, error, refetch } = useInvoiceDetail(id);

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const attempts = useRef<Record<string, Attempt | undefined>>({});
  const receiptDetail = useReceiptDetail(inv?.receipt?.id ?? null, can('receipts.view'));

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (isError || !inv) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="No se pudo cargar la factura"
        description={errorMessage(error)}
        action={
          <div className="flex gap-2">
            <Button onClick={() => void refetch()}>Reintentar</Button>
            <Link to="/recibos" className="pressable inline-flex h-9 items-center px-3.5 text-sm font-medium text-brand">
              Volver a Recibos
            </Link>
          </div>
        }
      />
    );
  }

  const invoice = inv;
  const actions = invoice.actions;
  const receipt: ReceiptSummary | null = invoice.receipt;
  const receiptFull = receiptDetail.data && receipt && receiptDetail.data.id === receipt.id ? receiptDetail.data : null;
  const receiptIssued = receipt?.status === 'issued';

  const show = {
    // After the first print, GET …/pdf is a watermarked consultation copy that needs reprint rights.
    print: Boolean(receiptIssued) && can('receipts.view') && (actions.can_reprint || receiptFull?.printed === false),
    reprint: actions.can_reprint && Boolean(receiptIssued) && can('receipts.reprint'),
    pay: actions.can_pay && invoice.balance_cents > 0 && can('payments.create'),
    issue: actions.can_issue_receipt && can(['payments.create', 'invoices.operate_any']),
    void: actions.can_void && can('invoices.void'),
    reverse: actions.can_reverse && can('invoices.reverse'),
  };

  async function refresh() {
    await invalidateAfterOperation(qc, invoice.id);
  }

  async function pay(body: CreatePaymentRequest) {
    setPaying(true);
    setPayError(null);
    try {
      const key = keyFor(attempts.current, 'pay', JSON.stringify(body));
      const res = await api.post<CreatePaymentResponse>(`/invoices/${invoice.id}/payments`, body, { idempotencyKey: key });
      delete attempts.current.pay;
      setPayOpen(false);
      qc.setQueryData(qk.invoice(invoice.id), () => res.invoice);
      const newReceipt = res.receipt;
      toast.success({
        title: res.invoice.balance_cents > 0 ? 'Abono registrado.' : 'Cobro registrado.',
        description: res.payment.change_cents ? `Cambio: ${formatCents(res.payment.change_cents)}` : undefined,
        action: newReceipt ? { label: 'Imprimir recibo', onClick: () => void openReceiptPdf(newReceipt.id) } : undefined,
      });
      void refresh();
    } catch (e) {
      const msg = errorMessage(e, 'No se pudo registrar el cobro.');
      setPayError(msg);
      toast.error({ title: 'No se registró el cobro.', description: msg });
    } finally {
      setPaying(false);
    }
  }

  async function issueReceipt() {
    setIssuing(true);
    try {
      const key = keyFor(attempts.current, 'issue', String(invoice.id));
      const updated = await api.post<Invoice>(`/invoices/${invoice.id}/receipt`, undefined, { idempotencyKey: key });
      qc.setQueryData(qk.invoice(invoice.id), updated);
      const r = updated.receipt;
      toast.success({
        title: 'Recibo emitido.',
        description: r?.number_full ? `Recibo ${r.number_full}` : undefined,
        action: r?.id ? { label: 'Imprimir recibo', onClick: () => void openReceiptPdf(r.id) } : undefined,
      });
      await refresh();
    } catch (e) {
      toast.error({ title: 'No se emitió el recibo.', description: errorMessage(e) });
    } finally {
      setIssuing(false);
    }
  }

  async function confirmReason(action: ReasonAction, reason: string) {
    setReasonError(null);
    const key = keyFor(attempts.current, action, reason);
    try {
      if (action === 'reprint') {
        if (!receipt) return;
        await downloadFile(`/receipts/${receipt.id}/reprint`, {
          method: 'POST',
          body: { reason },
          idempotencyKey: key,
          filename: `${receipt.number_full}-reimpresion.pdf`,
        });
        toast.success('Reimpresión registrada.');
      } else {
        await api.post(`/invoices/${invoice.id}/${action}`, { reason }, { idempotencyKey: key });
        toast.success(action === 'void' ? 'Factura anulada.' : 'Factura revertida.');
      }
      delete attempts.current[action];
      setReasonAction(null);
      await refresh();
    } catch (e) {
      const msg = errorMessage(e);
      setReasonError(msg);
      toast.error({ title: 'No se completó la operación.', description: msg });
    }
  }

  const dialog = reasonAction ? REASON_DIALOG[reasonAction] : null;
  const postedPayments = invoice.payments.filter((p) => p.status === 'posted');

  return (
    <>
      <PageHeader title="Factura" />

      <section aria-label="Documento" className="overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-4 pb-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Link
              to="/recibos"
              className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] [&_svg]:size-4"
            >
              <ArrowLeft aria-hidden="true" />
              Recibos
            </Link>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="num text-[44px] leading-[48px] font-bold tracking-[-0.01em] text-ink">{invoice.number}</h2>
              <StatusStamp status={invoice} variant="stamp" />
            </div>
            <p className="text-[17px] leading-6 font-semibold text-ink">{invoice.patient_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-6">
            {show.pay && (
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Wallet />}
                onClick={() => {
                  setPayError(null);
                  setPayOpen(true);
                }}
              >
                {invoice.paid_cents > 0 ? 'Registrar abono' : 'Cobrar saldo'}
              </Button>
            )}
            {show.print && receipt && <ReceiptButtons receipt={receipt} size="lg" showSave={false} primary={!show.pay} />}
            {show.reprint && (
              <Button
                size="lg"
                leftIcon={<Printer />}
                onClick={() => {
                  setReasonError(null);
                  setReasonAction('reprint');
                }}
              >
                Reimprimir
              </Button>
            )}
            {show.issue && (
              <Button size="lg" leftIcon={<FileCheck />} loading={issuing} onClick={() => void issueReceipt()}>
                Emitir recibo
              </Button>
            )}
            {show.void && (
              <Button
                size="lg"
                leftIcon={<Ban />}
                className="text-danger"
                onClick={() => {
                  setReasonError(null);
                  setReasonAction('void');
                }}
              >
                Anular
              </Button>
            )}
            {show.reverse && (
              <Button
                size="lg"
                leftIcon={<Undo2 />}
                className="text-danger"
                onClick={() => {
                  setReasonError(null);
                  setReasonAction('reverse');
                }}
              >
                Revertir
              </Button>
            )}
          </div>
        </div>

        {invoice.status === 'void' && (
          <div role="note" className="flex items-start gap-2.5 border-t border-junta bg-danger-soft px-5 py-3 text-[13.5px] text-danger">
            <StatusGlyph shape="struck" className="mt-[5px]" />
            <div>
              <p className="font-semibold">
                {invoice.reversed ? 'Factura revertida' : 'Factura anulada'}
                {invoice.voided_at ? ` el ${formatDateTime(invoice.voided_at)}` : ''}.
              </p>
              {invoice.void_reason && <p className="mt-0.5 text-ink-2">Motivo: {invoice.void_reason}</p>}
            </div>
          </div>
        )}

        <div className="overflow-hidden border-t border-junta">
          <dl className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            <Info label="Emitida">{formatDateTime(invoice.issued_at)}</Info>
            <Info label="Emitida por">{invoice.issued_by.name || <Dash />}</Info>
            {receipt ? (
              <>
                <Info label="Recibo No.">
                  <span className="num font-semibold">{receipt.number_full}</span>
                </Info>
                <Info label="Estado del recibo">
                  <span className="flex items-center gap-2">
                    <StatusGlyph shape={receipt.status === 'issued' ? 'filled' : 'struck'} className={receipt.status === 'issued' ? 'text-ok' : 'text-danger'} />
                    <span>{receipt.status === 'issued' ? 'Emitido' : 'Anulado'}</span>
                  </span>
                </Info>
                <Info label="Fecha del recibo">{receiptFull ? formatDateTime(receiptFull.issued_at) : <Dash />}</Info>
                <Info label="Reimpresiones">
                  <span className="num">{receipt.reprint_count}</span>
                </Info>
              </>
            ) : (
              <Info label="Recibo" className="col-span-2 sm:col-span-1 xl:col-span-4">
                <span className="text-ink-2">
                  {invoice.status === 'paid' ? 'Falta emitir el recibo institucional.' : 'Se emite al quedar pagada la factura.'}
                </span>
              </Info>
            )}
            <Info label="CAI" className="col-span-2">
              <span className="num text-[13px] break-all">{invoice.fiscal.cai}</span>
            </Info>
            <Info label="Rango autorizado" className="col-span-2">
              <span className="num text-[13px]">
                {invoice.fiscal.range_from} – {invoice.fiscal.range_to}
              </span>
            </Info>
            <Info label="Fecha límite de emisión">{invoice.fiscal.valid_until ? formatDate(invoice.fiscal.valid_until) : <Dash />}</Info>
            <Info label="Receta de diálisis">{invoice.dialysis_prescription ? 'Sí' : 'No'}</Info>
          </dl>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Conceptos" aside={`${invoice.items.length} ${invoice.items.length === 1 ? 'concepto' : 'conceptos'}`}>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <caption className="sr-only">Conceptos de la factura</caption>
                <thead>
                  <tr className="bg-ground">
                    <th scope="col" className={cn(th, 'text-left')}>Concepto</th>
                    <th scope="col" className={cn(th, 'w-[80px] text-right')}>Cant.</th>
                    <th scope="col" className={cn(th, 'w-[120px] text-right')}>Precio</th>
                    <th scope="col" className={cn(th, 'w-[120px] text-right')}>Ajuste</th>
                    <th scope="col" className={cn(th, 'w-[132px] text-right')}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it) => (
                    <tr key={it.id} className={cn(it.special_rule_applied && 'bg-slate-soft/45')}>
                      <td className={td}>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-medium text-ink">{it.service_name}</span>
                            {it.special_rule_applied && (
                              <Badge tone="brand" shape="diamond">
                                Sin cobro por receta
                              </Badge>
                            )}
                          </span>
                          {it.category_name && <span className="text-[12px] leading-4 text-ink-2">{it.category_name}</span>}
                        </div>
                      </td>
                      <td className={cn(td, 'num text-right')}>{formatHundredths(it.quantity_hundredths)}</td>
                      <td className={cn(td, 'text-right text-ink-2')}>
                        <Amount cents={it.unit_price_registered_cents} />
                      </td>
                      <td className={cn(td, 'text-right text-ink-2')}>
                        {it.rule_adjustment_cents > 0 ? <Amount cents={it.rule_adjustment_cents} negative /> : <Dash label="Sin ajuste" />}
                      </td>
                      <td className={cn(td, 'text-right font-semibold')}>
                        <Amount cents={it.line_subtotal_cents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Pagos"
            aside={postedPayments.length > 0 ? `${postedPayments.length} ${postedPayments.length === 1 ? 'pago' : 'pagos'}` : undefined}
          >
            {invoice.payments.length === 0 ? (
              <p className="px-4 py-3 text-[13.5px] text-ink-2">
                {invoice.total_cents === 0 ? 'Emitida sin cobro: no requiere pagos.' : 'Sin pagos registrados.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <caption className="sr-only">Pagos de la factura</caption>
                  <thead>
                    <tr className="bg-ground">
                      <th scope="col" className={cn(th, 'w-[168px] text-left')}>Fecha</th>
                      <th scope="col" className={cn(th, 'text-left')}>Método</th>
                      <th scope="col" className={cn(th, 'text-left')}>Referencia</th>
                      <th scope="col" className={cn(th, 'w-[132px] text-right')}>Monto</th>
                      <th scope="col" className={cn(th, 'w-[180px] text-left')}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => {
                      const voided = p.status === 'void';
                      return (
                        <tr key={p.id} className={cn(voided && 'text-ink-3')}>
                          <td className={cn(td, 'tabular')}>{formatDateTime(p.paid_at)}</td>
                          <td className={td}>
                            {PAYMENT_METHOD_LABEL[p.method]}
                            {p.method === 'cash' && p.change_cents ? (
                              <span className="ml-1.5 text-[12px] text-ink-2">
                                (cambio <Amount cents={p.change_cents} />)
                              </span>
                            ) : null}
                          </td>
                          <td className={cn(td, 'num')}>{p.reference || <Dash label="Sin referencia" />}</td>
                          <td className={cn(td, 'text-right font-semibold')}>
                            <Amount cents={p.amount_cents} className={cn(voided && 'line-through')} />
                          </td>
                          <td className={td}>
                            <span className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-2 font-medium text-ink">
                                <StatusGlyph shape={voided ? 'struck' : 'filled'} className={voided ? 'text-danger' : 'text-ok'} />
                                {voided ? 'Anulado' : 'Registrado'}
                              </span>
                              {voided && p.void_reason && <span className="text-[12px] text-ink-2">{p.void_reason}</span>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Totales" className="lg:sticky lg:top-[calc(var(--topbar-h)+20px)]">
          <div className="px-4 pt-1 pb-3">
            <TotalsList
              totals={invoice}
              extra={
                <>
                  <TotalsRow label="Pagado">
                    <Amount cents={invoice.paid_cents} />
                  </TotalsRow>
                  <TotalsRow label="Saldo">
                    <Amount cents={invoice.balance_cents} className={invoice.balance_cents > 0 ? 'font-bold text-warn' : undefined} />
                  </TotalsRow>
                </>
              }
            />
          </div>
          {receiptFull?.amount_words && (
            <p className="border-t border-junta bg-surface-2 px-4 py-2.5 text-[12.5px] leading-snug font-medium text-ink-2">
              {receiptFull.amount_words}
            </p>
          )}
        </Panel>
      </div>

      {show.pay && (
        <PaymentDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          title={invoice.paid_cents > 0 ? 'Registrar abono' : 'Cobrar saldo'}
          patientName={invoice.patient_name}
          dueCents={invoice.balance_cents}
          allowAmountEdit
          submitting={paying}
          error={payError}
          onConfirm={(b) => void pay(b)}
        />
      )}

      {dialog && reasonAction && (
        <ConfirmDialog
          open
          onClose={() => setReasonAction(null)}
          title={dialog.title}
          description={dialog.description}
          tone={dialog.tone}
          confirmLabel={dialog.confirm}
          reason={{ label: dialog.label }}
          error={reasonError}
          onConfirm={(reason) => confirmReason(reasonAction, reason)}
        >
          <p className="text-[13px] text-ink-2">
            Factura <span className="num font-medium text-ink">{invoice.number}</span> · {invoice.patient_name}
            {reasonAction === 'reprint' && receipt ? (
              <>
                {' '}
                · Recibo <span className="num">{receipt.number_full}</span>
              </>
            ) : null}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

export default function ReciboDetallePage() {
  const { id } = useParams();
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="Documento no encontrado"
        action={
          <Link to="/recibos" className="text-sm font-medium text-brand">
            Volver a Recibos
          </Link>
        }
      />
    );
  }
  return <ReciboDetalle key={n} id={n} />;
}
