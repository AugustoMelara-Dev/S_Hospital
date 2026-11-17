import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Wallet, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, downloadFile, errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatCents, formatHundredths } from '@/lib/money';
import {
  ERYTHROPOIETIN_RULE,
  type CreateInvoiceRequest,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type Invoice,
  type InvoicePreview,
  type InvoicePreviewRequest,
  type Payment,
  type ReceiptSummary,
  type Service,
} from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { NEW_OPERATION_EVENT } from '@/shell/AppShell';
import { useCurrentCashSession } from '@/shell/CashStatusPill';
import { Badge, Button, Card, Checkbox, Dialog, Field, Input, Kbd, Money, PageHeader, toast } from '@/ui';
import { invalidateAfterOperation } from '@/features/recibos/api';
import { PaymentDialog } from '@/features/recibos/components/PaymentDialog';
import { TotalsList } from '@/features/recibos/components/TotalsList';
import { AccountLines } from './components/AccountLines';
import { ChargedPanel, PendingPanel } from './components/OperationResult';
import { ServiceSearch } from './components/ServiceSearch';
import { useInvoicePreview } from './hooks';
import { frequentServices, recordServiceUse } from './quickAccess';
import type { CartLine, QuickService } from './types';

type Stage =
  | { kind: 'edit' }
  | { kind: 'pending'; invoice: Invoice; error: string }
  | { kind: 'done'; invoice: Invoice; payment: Payment | null; receipt: ReceiptSummary | null; receiptError: string | null };

/** Idempotency key kept while the request body is unchanged (retries replay, edits get a new key). */
type Attempt = { key: string; fingerprint: string };
function keyFor(ref: { current: Attempt | null }, fingerprint: string): string {
  if (!ref.current || ref.current.fingerprint !== fingerprint) ref.current = { key: newIdempotencyKey(), fingerprint };
  return ref.current.key;
}

const PATIENT_REQUIRED = 'Ingrese el nombre del paciente.';
const OPEN_CASH = 'Abra caja antes de emitir y cobrar una factura.';
const normalizeName = (s: string) => s.replace(/\s+/g, ' ').trim();

function toQuick(s: Service | QuickService): QuickService {
  return {
    id: s.id,
    name: s.name,
    price_cents: s.price_cents,
    special_rule_code: s.special_rule_code,
    category: s.category ? { id: s.category.id, name: s.category.name } : null,
  };
}

type Status = { tone: 'neutral' | 'info' | 'ok' | 'warn' | 'danger'; text: ReactNode };

export default function CobrarPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const { can } = usePermissions();
  const cashEnabled = can('cash.view');
  const cash = useCurrentCashSession(cashEnabled);

  const patientRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [patient, setPatient] = useState('');
  const [patientError, setPatientError] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [dialysis, setDialysis] = useState(false);
  const [quick, setQuick] = useState<QuickService[]>(() => frequentServices());

  const [stage, setStage] = useState<Stage>({ kind: 'edit' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const invoiceAttempt = useRef<Attempt | null>(null);
  const paymentAttempt = useRef<Attempt | null>(null);
  const submittingRef = useRef(false);

  const hasEpo = lines.some((l) => l.service.special_rule_code === ERYTHROPOIETIN_RULE);
  const showDialysis = hasEpo && can('patients.mark_dialysis_prescription');
  const dialysisPrescription = showDialysis && dialysis;

  const request = useMemo<InvoicePreviewRequest | null>(
    () =>
      lines.length
        ? {
            items: lines.map((l) => ({ service_id: l.service.id, quantity_hundredths: l.quantity_hundredths })),
            dialysis_prescription: dialysisPrescription,
          }
        : null,
    [lines, dialysisPrescription],
  );
  const preview = useInvoicePreview(stage.kind === 'edit' ? request : null);
  const shown: InvoicePreview | undefined = preview.data ?? (preview.calculating ? preview.last : undefined);

  const sessionOpen = !cashEnabled || cash.data?.status === 'open';
  const sessionKnown = !cashEnabled || !cash.isPending;
  const ready = lines.length > 0 && Boolean(preview.data) && sessionOpen;
  const total = preview.data?.total_cents;

  // ----- reset / focus -----
  const reset = useCallback(() => {
    if (submittingRef.current) return;
    setPatient('');
    setPatientError(null);
    setLines([]);
    setDialysis(false);
    setStage({ kind: 'edit' });
    setDialogOpen(false);
    setDialogError(null);
    invoiceAttempt.current = null;
    paymentAttempt.current = null;
    setQuick(frequentServices());
    requestAnimationFrame(() => patientRef.current?.focus());
  }, []);

  const navState = location.state as { focus?: string; at?: number } | null;
  const navAt = navState?.focus === 'patient' ? (navState.at ?? 0) : undefined;
  useEffect(() => {
    if (navAt !== undefined) reset();
  }, [navAt, reset]);

  useEffect(() => {
    const onNew = () => reset();
    window.addEventListener(NEW_OPERATION_EVENT, onNew);
    return () => window.removeEventListener(NEW_OPERATION_EVENT, onNew);
  }, [reset]);

  // ----- cart -----
  function addService(service: Service | QuickService) {
    const q = toQuick(service);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.service.id === q.id);
      if (i === -1) return [...prev, { service: q, quantity_hundredths: 100 }];
      return prev.map((l, j) => (j === i ? { ...l, quantity_hundredths: Math.min(99_999_900, l.quantity_hundredths + 100) } : l));
    });
    recordServiceUse(q);
  }

  function setQuantity(index: number, hundredths: number) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity_hundredths: hundredths } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    searchRef.current?.focus();
  }

  // ----- charge -----
  function openCharge() {
    if (stage.kind !== 'edit' || dialogOpen) return;
    if (!normalizeName(patient)) {
      setPatientError(PATIENT_REQUIRED);
      patientRef.current?.focus();
      return;
    }
    if (lines.length === 0) {
      searchRef.current?.focus();
      return;
    }
    if (!sessionOpen) {
      toast.warning(OPEN_CASH);
      return;
    }
    if (!preview.data) return;
    setDialogError(null);
    setDialogOpen(true);
  }

  const openChargeRef = useRef(openCharge);
  useEffect(() => {
    openChargeRef.current = openCharge;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F4') {
        e.preventDefault();
        openChargeRef.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function confirm(payment: CreatePaymentRequest | null) {
    let invoice: Invoice | null = stage.kind === 'pending' ? stage.invoice : null;
    if (submittingRef.current || (!invoice && !request)) return;
    submittingRef.current = true;
    setSubmitting(true);
    setDialogError(null);

    try {
      if (!invoice && request) {
        const body: CreateInvoiceRequest = { ...request, patient_name: normalizeName(patient) };
        const key = keyFor(invoiceAttempt, JSON.stringify(body));
        invoice = await api.post<Invoice>('/invoices', body, { idempotencyKey: key });
        void invalidateAfterOperation(qc, invoice.id);
      }
    } catch (e) {
      const msg = errorMessage(e, 'No se pudo emitir la factura.');
      setDialogError(msg);
      toast.error({ title: 'No se emitió la factura.', description: msg });
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    if (!invoice || !payment || invoice.balance_cents <= 0) {
      submittingRef.current = false;
      if (!invoice) {
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setDialogOpen(false);
      setStage({ kind: 'done', invoice, payment: null, receipt: invoice.receipt, receiptError: invoice.receipt_error ?? null });
      return;
    }

    const body: CreatePaymentRequest = { ...payment, amount_cents: invoice.balance_cents };
    try {
      const key = keyFor(paymentAttempt, JSON.stringify([invoice.id, body]));
      const res = await api.post<CreatePaymentResponse>(`/invoices/${invoice.id}/payments`, body, { idempotencyKey: key });
      setDialogOpen(false);
      setStage({
        kind: 'done',
        invoice: res.invoice,
        payment: res.payment,
        receipt: res.receipt ?? res.invoice.receipt,
        receiptError: res.receipt_error,
      });
      void invalidateAfterOperation(qc, invoice.id);
    } catch (e) {
      const msg = errorMessage(e, 'No se pudo registrar el cobro.');
      setDialogOpen(false);
      setStage({ kind: 'pending', invoice, error: msg });
      toast.error({ title: 'Emitido pendiente de cobro', description: msg });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function draftPdf() {
    if (!request) return;
    setDraftBusy(true);
    try {
      await downloadFile('/invoices/draft-receipt.pdf', {
        method: 'POST',
        body: { ...request, patient_name: normalizeName(patient) },
        filename: 'borrador.pdf',
      });
    } catch (e) {
      toast.error({ title: 'No se pudo generar la vista previa.', description: errorMessage(e) });
    } finally {
      setDraftBusy(false);
    }
  }

  // ----- status -----
  let status: Status;
  if (lines.length === 0) status = { tone: 'neutral', text: 'Borrador' };
  else if (preview.calculating) status = { tone: 'info', text: 'Calculando…' };
  else if (preview.error) status = { tone: 'danger', text: preview.error };
  else if (sessionKnown && !sessionOpen)
    status = {
      tone: 'warn',
      text: (
        <>
          {OPEN_CASH}{' '}
          <Link to="/caja" className="font-medium underline underline-offset-2">
            Ir a Caja
          </Link>
        </>
      ),
    };
  else status = { tone: 'ok', text: 'Listo para cobrar' };

  const chargeLabel = total === undefined ? 'Cobrar' : total === 0 ? 'Emitir sin cobro' : `Cobrar · ${formatCents(total)}`;
  const chargeDisabled = !ready || submitting;

  const summary = (
    <div className="flex flex-col gap-3">
      <ul className="flex max-h-[180px] flex-col gap-1 overflow-y-auto text-[13px]">
        {lines.map((l, i) => (
          <li key={l.service.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">
              <span className="num text-ink-3">{formatHundredths(l.quantity_hundredths)} ×</span> {l.service.name}
            </span>
            <Money cents={preview.data?.items[i]?.line_subtotal_cents} className="shrink-0 text-ink-2" />
          </li>
        ))}
      </ul>
      <TotalsList totals={preview.data} className="border-t border-line pt-3" />
    </div>
  );

  const header = (
    <PageHeader
      title="Cobrar"
      description="Nueva operación: paciente, conceptos y cobro."
      actions={
        <span className="hidden items-center gap-3 text-[12.5px] text-ink-3 sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>F2</Kbd> Nueva operación
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>F4</Kbd> Cobrar
          </span>
        </span>
      }
    />
  );

  if (stage.kind === 'done') {
    return (
      <>
        {header}
        <ChargedPanel
          invoice={stage.invoice}
          payment={stage.payment}
          receipt={stage.receipt}
          receiptError={stage.receiptError}
          onNew={reset}
        />
      </>
    );
  }

  if (stage.kind === 'pending') {
    return (
      <>
        {header}
        <PendingPanel
          invoice={stage.invoice}
          error={stage.error}
          onRetry={() => {
            setDialogError(null);
            setDialogOpen(true);
          }}
          onNew={reset}
        />
        <PaymentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Cobrar pendiente"
          patientName={stage.invoice.patient_name}
          dueCents={stage.invoice.balance_cents}
          submitting={submitting}
          error={dialogError}
          onConfirm={(p) => void confirm(p)}
        />
      </>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      {header}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <Field label="Nombre del paciente" required error={patientError}>
              <Input
                ref={patientRef}
                // Primary entry point of the cashier flow.
                autoFocus
                value={patient}
                maxLength={180}
                autoComplete="off"
                spellCheck={false}
                placeholder="Nombre y apellidos"
                className="h-11 text-[15px]"
                onChange={(e) => {
                  setPatient(e.target.value);
                  if (patientError && normalizeName(e.target.value)) setPatientError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!normalizeName(patient)) setPatientError(PATIENT_REQUIRED);
                    else searchRef.current?.focus();
                  }
                }}
              />
            </Field>
          </Card>

          <Card title="Agregar conceptos">
            <div className="flex flex-col gap-3">
              <ServiceSearch inputRef={searchRef} onAdd={addService} disabled={submitting} />
              {quick.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
                    <Zap className="size-3.5" aria-hidden="true" />
                    Accesos rápidos
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          addService(s);
                          searchRef.current?.focus();
                        }}
                        className="pressable inline-flex h-8 max-w-[260px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] text-ink hover:border-brand/40 hover:bg-brand-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="num shrink-0 text-[12px] text-ink-3">{formatCents(s.price_cents)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Cuenta"
            flush
            actions={
              lines.length > 0 ? (
                <span className="text-[12.5px] text-ink-3">
                  {lines.length} {lines.length === 1 ? 'concepto' : 'conceptos'}
                </span>
              ) : undefined
            }
          >
            <AccountLines
              lines={lines}
              previewLines={preview.data?.items}
              calculating={preview.calculating}
              onQuantity={setQuantity}
              onRemove={removeLine}
              disabled={submitting}
            />
            {showDialysis && (
              <div className="border-t border-line bg-brand-soft/30 px-4 py-3">
                <Checkbox
                  label="Paciente con receta de diálisis"
                  description="Aplica solo al medicamento elegible; el resto conserva su precio."
                  checked={dialysis}
                  onChange={(e) => setDialysis(e.target.checked)}
                />
              </div>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--topbar-h)+16px)]" aria-label="Total de la operación">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-ink">Total</h2>
                {lines.length > 0 && preview.data && preview.data.total_cents === 0 && preview.data.rule_adjustment_cents > 0 && (
                  <Badge tone="brand">Sin cobro por receta</Badge>
                )}
              </div>
              <div aria-live="polite" aria-busy={preview.calculating || undefined}>
                <TotalsList
                  totals={shown}
                  className={cn('transition-opacity duration-[var(--dur-fast)]', preview.calculating && 'opacity-55')}
                />
              </div>
              <StatusLine status={status} />
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={chargeDisabled}
                  onClick={openCharge}
                  leftIcon={<Wallet />}
                  rightIcon={<Kbd className="ml-1 border-white/25 bg-white/10 text-brand-ink shadow-none">F4</Kbd>}
                >
                  {preview.calculating ? 'Calculando…' : chargeLabel}
                </Button>
                <Button fullWidth leftIcon={<Eye />} disabled={!request} loading={draftBusy} onClick={() => void draftPdf()}>
                  Vista previa
                </Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Narrow screens: sticky bottom total bar. */}
      <div className="fixed right-0 bottom-0 left-[var(--sidebar-w)] z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[12px] text-ink-3">Total</span>
          <Money cents={preview.data?.total_cents} className="text-[18px] font-semibold" />
        </div>
        <Button variant="primary" disabled={chargeDisabled} onClick={openCharge} aria-hidden="true" tabIndex={-1}>
          {preview.calculating ? 'Calculando…' : chargeLabel}
        </Button>
      </div>

      {total === 0 ? (
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Emitir sin cobro"
          description={
            <>
              Paciente: <span className="font-medium text-ink">{normalizeName(patient)}</span>
            </>
          }
          dismissible={!submitting}
          onSubmit={() => void confirm(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={submitting} autoFocus>
                Emitir sin cobro
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {summary}
            {dialogError && (
              <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                {dialogError}
              </p>
            )}
          </div>
        </Dialog>
      ) : (
        <PaymentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          patientName={normalizeName(patient)}
          dueCents={total ?? 0}
          summary={summary}
          submitting={submitting}
          error={dialogError}
          onConfirm={(p) => void confirm(p)}
        />
      )}
    </div>
  );
}

const STATUS_TONE: Record<Status['tone'], string> = {
  neutral: 'border-line bg-surface-2 text-ink-2',
  info: 'border-info/25 bg-info-soft text-info',
  ok: 'border-ok/25 bg-ok-soft text-ok',
  warn: 'border-warn/30 bg-warn-soft text-warn',
  danger: 'border-danger/30 bg-danger-soft text-danger',
};

function StatusLine({ status }: { status: Status }) {
  return (
    <p
      role="status"
      data-testid="cobrar-status"
      className={cn('rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] leading-snug', STATUS_TONE[status.tone])}
    >
      {status.text}
    </p>
  );
}
