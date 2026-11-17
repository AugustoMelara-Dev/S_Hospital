import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileCheck, FileQuestion, Printer, Undo2, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, downloadFile, errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatCents, formatHundredths } from '@/lib/money';
import { qk } from '@/api/queryClient';
import { PAYMENT_METHOD_LABEL, type CreatePaymentRequest, type CreatePaymentResponse, type Receipt } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Money, PageHeader, Skeleton, StatusStamp, toast } from '@/ui';
import { invalidateAfterOperation, openReceiptPdf } from './api';
import { PaymentDialog } from './components/PaymentDialog';
import { ReceiptButtons } from './components/ReceiptButtons';
import { TotalsList, TotalsRow } from './components/TotalsList';
import { deriveActions, type InvoiceDetail } from './types';

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

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right break-words text-ink">{children}</dd>
    </div>
  );
}

export function useInvoiceDetail(id: number) {
  return useQuery({
    queryKey: qk.invoice(id),
    queryFn: ({ signal }) => api.get<InvoiceDetail>(`/invoices/${id}`, undefined, { signal }),
    enabled: Number.isInteger(id) && id > 0,
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
  const actions = deriveActions(invoice);
  const receipt: Receipt | null = invoice.receipt;
  const receiptIssued = receipt?.status === 'issued';

  const show = {
    print: Boolean(receiptIssued) && can('receipts.view'),
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
      qc.setQueryData(qk.invoice(invoice.id), (old: InvoiceDetail | undefined) => (old ? { ...old, ...res.invoice } : old));
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
      const r = await api.post<Receipt>(`/invoices/${invoice.id}/receipt`, undefined, { idempotencyKey: key });
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
      <Link
        to="/recibos"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink [&_svg]:size-4"
      >
        <ArrowLeft aria-hidden="true" />
        Recibos
      </Link>
      <PageHeader
        eyebrow="Factura"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{invoice.number}</span>
            <StatusStamp status={invoice} variant="stamp" />
          </span>
        }
        description={
          <>
            <span className="font-medium text-ink">{invoice.patient_name}</span> · {formatDateTime(invoice.issued_at)}
            {invoice.issued_by_name ? ` · ${invoice.issued_by_name}` : ''}
          </>
        }
        actions={
          <>
            {show.pay && (
              <Button variant="primary" leftIcon={<Wallet />} onClick={() => {
                  setPayError(null);
                  setPayOpen(true);
                }}>
                {invoice.paid_cents > 0 ? 'Registrar abono' : 'Cobrar saldo'}
              </Button>
            )}
            {show.print && receipt && <ReceiptButtons receipt={receipt} showSave={false} primary={!show.pay} />}
            {show.reprint && (
              <Button leftIcon={<Printer />} onClick={() => {
                  setReasonError(null);
                  setReasonAction('reprint');
                }}>
                Reimprimir
              </Button>
            )}
            {show.issue && (
              <Button leftIcon={<FileCheck />} loading={issuing} onClick={() => void issueReceipt()}>
                Emitir recibo
              </Button>
            )}
            {show.void && (
              <Button
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
          </>
        }
      />

      {invoice.status === 'void' && (
        <div role="note" className="mb-4 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
          <p className="font-medium">
            {invoice.reversed ? 'Factura revertida' : 'Factura anulada'}
            {invoice.voided_at ? ` el ${formatDateTime(invoice.voided_at)}` : ''}.
          </p>
          {invoice.void_reason && <p className="mt-0.5 text-ink-2">Motivo: {invoice.void_reason}</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Conceptos" flush>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Conceptos de la factura</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-[12px] text-ink-2">
                    <th scope="col" className="h-9 px-3 text-left font-medium">Concepto</th>
                    <th scope="col" className="h-9 px-3 text-right font-medium">Cant.</th>
                    <th scope="col" className="h-9 px-3 text-right font-medium">Precio</th>
                    <th scope="col" className="h-9 px-3 text-right font-medium">Ajuste</th>
                    <th scope="col" className="h-9 px-3 text-right font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-ink">{it.service_name}</span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                            {it.category_name}
                            {it.special_rule_applied && <Badge tone="brand">Sin cobro por receta</Badge>}
                          </span>
                        </div>
                      </td>
                      <td className="num px-3 py-2.5 text-right">{formatHundredths(it.quantity_hundredths)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Money cents={it.unit_price_registered_cents} />
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">
                        {it.rule_adjustment_cents > 0 ? <Money cents={-it.rule_adjustment_cents} /> : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        <Money cents={it.line_subtotal_cents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Pagos"
            flush
            actions={
              postedPayments.length > 0 ? (
                <span className="text-[12.5px] text-ink-3">
                  {postedPayments.length} {postedPayments.length === 1 ? 'pago' : 'pagos'}
                </span>
              ) : undefined
            }
          >
            {invoice.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                {invoice.total_cents === 0 ? 'Emitida sin cobro: no requiere pagos.' : 'Sin pagos registrados.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <caption className="sr-only">Pagos de la factura</caption>
                  <thead>
                    <tr className="border-b border-line bg-surface-2/60 text-[12px] text-ink-2">
                      <th scope="col" className="h-9 px-3 text-left font-medium">Fecha</th>
                      <th scope="col" className="h-9 px-3 text-left font-medium">Método</th>
                      <th scope="col" className="h-9 px-3 text-left font-medium">Referencia</th>
                      <th scope="col" className="h-9 px-3 text-right font-medium">Monto</th>
                      <th scope="col" className="h-9 px-3 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => {
                      const voided = p.status === 'void';
                      return (
                        <tr key={p.id} className={cn('border-b border-line last:border-0', voided && 'text-ink-3')}>
                          <td className="tabular px-3 py-2.5">{formatDateTime(p.paid_at)}</td>
                          <td className="px-3 py-2.5">
                            {PAYMENT_METHOD_LABEL[p.method]}
                            {p.method === 'cash' && p.change_cents ? (
                              <span className="ml-1.5 text-[12px] text-ink-3">
                                (cambio <Money cents={p.change_cents} />)
                              </span>
                            ) : null}
                          </td>
                          <td className="num px-3 py-2.5">{p.reference || '—'}</td>
                          <td className="px-3 py-2.5 text-right">
                            <Money cents={p.amount_cents} className={cn(voided && 'line-through')} />
                          </td>
                          <td className="px-3 py-2.5">
                            {voided ? (
                              <span className="flex flex-col gap-0.5">
                                <Badge tone="danger">Anulado</Badge>
                                {p.void_reason && <span className="text-[12px]">{p.void_reason}</span>}
                              </span>
                            ) : (
                              <Badge tone="ok">Registrado</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Totales">
            <TotalsList
              totals={invoice}
              extra={
                <div className="mt-1.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
                  <TotalsRow label="Pagado">
                    <Money cents={invoice.paid_cents} />
                  </TotalsRow>
                  <TotalsRow label="Saldo">
                    <Money cents={invoice.balance_cents} className={invoice.balance_cents > 0 ? 'font-semibold text-warn' : undefined} />
                  </TotalsRow>
                </div>
              }
            />
          </Card>

          <Card title="Comprobante">
            {receipt ? (
              <dl className="flex flex-col gap-2">
                <Info label="Recibo No.">
                  <span className="num font-medium">{receipt.number_full}</span>
                </Info>
                <Info label="Estado">
                  {receipt.status === 'issued' ? <Badge tone="ok">Emitido</Badge> : <Badge tone="danger">Anulado</Badge>}
                </Info>
                <Info label="Emitido">{formatDateTime(receipt.issued_at)}</Info>
                <Info label="Reimpresiones">
                  <span className="num">{receipt.reprint_count}</span>
                </Info>
                {receipt.amount_words && (
                  <div className="mt-1 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-[12px] leading-snug text-ink-2">
                    {receipt.amount_words}
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-[13px] text-ink-3">
                {invoice.status === 'paid' ? 'Falta emitir el recibo institucional.' : 'Se emite al quedar pagada la factura.'}
              </p>
            )}
          </Card>

          <Card title="Documento">
            <dl className="flex flex-col gap-2">
              <Info label="CAI">
                <span className="num text-[12px]">{invoice.fiscal_cai}</span>
              </Info>
              <Info label="Rango autorizado">
                <span className="num text-[12px]">
                  {invoice.fiscal_range_from} – {invoice.fiscal_range_to}
                </span>
              </Info>
              <Info label="Fecha límite de emisión">{formatDate(invoice.fiscal_valid_until)}</Info>
              {invoice.cash_register_name && <Info label="Caja">{invoice.cash_register_name}</Info>}
              {invoice.dialysis_prescription && (
                <Info label="Receta de diálisis">
                  <Badge tone="brand">Sí</Badge>
                </Info>
              )}
            </dl>
          </Card>
        </div>
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
