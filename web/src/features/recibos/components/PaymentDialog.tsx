import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Ellipsis } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { PAYMENT_METHOD_LABEL, type CreatePaymentRequest, type PaymentMethod } from '@/api/types';
import { Button, Dialog, Field, Input, MoneyInput } from '@/ui';

const METHODS: PaymentMethod[] = ['cash', 'transfer', 'card', 'other'];

const METHOD_ICON: Record<PaymentMethod, ReactNode> = {
  cash: <Banknote aria-hidden="true" />,
  transfer: <ArrowLeftRight aria-hidden="true" />,
  card: <CreditCard aria-hidden="true" />,
  other: <Ellipsis aria-hidden="true" />,
};

export const SHORT_RECEIVED = 'El monto recibido es menor que el total a cobrar.';
export const REFERENCE_REQUIRED = 'Ingrese la referencia de la operación.';

export type PaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Default "Confirmar cobro". */
  title?: ReactNode;
  patientName: string;
  /** Amount due in cents (total of a new invoice or current balance). */
  dueCents: number;
  /** Let the user type a smaller amount (abono). The backend decides if partials are allowed. */
  allowAmountEdit?: boolean;
  /** Extra content above the payment fields (concepts, totals). */
  summary?: ReactNode;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (body: CreatePaymentRequest) => void;
};

/**
 * "Confirmar cobro": payment method (radio group with arrow keys), cash received with
 * "Monto exacto" and live change, reference for card/transfer. Enter submits.
 * An empty "Efectivo recibido" means the exact amount.
 */
export function PaymentDialog({
  open,
  onClose,
  title = 'Confirmar cobro',
  patientName,
  dueCents,
  allowAmountEdit = false,
  summary,
  submitting = false,
  error,
  onConfirm,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState<number | null>(dueCents);
  const [received, setReceived] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const receivedRef = useRef<HTMLInputElement>(null);
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMethod('cash');
      setAmount(dueCents);
      setReceived(null);
      setReference('');
      setTouched(false);
    }
  }

  const charge = allowAmountEdit ? (amount ?? 0) : dueCents;
  const isCash = method === 'cash';
  const needsReference = method === 'card' || method === 'transfer';
  const change = isCash && received !== null && received >= charge ? received - charge : 0;

  const amountError = !allowAmountEdit
    ? null
    : amount === null || amount <= 0
      ? 'Ingrese un monto mayor que cero.'
      : amount > dueCents
        ? 'El monto no puede superar el saldo.'
        : null;
  const receivedError = isCash && received !== null && received < charge ? SHORT_RECEIVED : null;
  const referenceError = needsReference && reference.trim() === '' ? REFERENCE_REQUIRED : null;

  function selectMethod(next: PaymentMethod, focus = false) {
    setMethod(next);
    if (focus) radios.current[METHODS.indexOf(next)]?.focus();
  }

  function onRadioKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = METHODS[(index + delta + METHODS.length) % METHODS.length];
    if (next) selectMethod(next, true);
  }

  function submit() {
    setTouched(true);
    if (submitting || amountError || receivedError || referenceError) return;
    const body: CreatePaymentRequest = { method, amount_cents: charge };
    if (isCash && received !== null) body.received_cents = received;
    const ref = reference.trim();
    if (ref && !isCash) body.reference = ref;
    onConfirm(body);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        <>
          Paciente: <span className="font-medium text-ink">{patientName}</span>
        </>
      }
      size="md"
      dismissible={!submitting}
      initialFocusRef={receivedRef}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" kbd="Enter" loading={submitting} loadingText="Registrando cobro…">
            {`Confirmar cobro · ${formatCents(charge)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* The ochre field: the amount due is the largest figure in the dialog. */}
        <div className="-mx-5 -mt-4 flex items-baseline justify-between gap-4 border-b border-ochre-line bg-ochre px-5 pt-3 pb-3.5 text-ochre-ink">
          <span className="text-[13px] font-bold tracking-[0.06em] uppercase">{allowAmountEdit ? 'Saldo' : 'Total a cobrar'}</span>
          <span className="num text-[40px] leading-[44px] font-bold tracking-[-0.02em]">{formatCents(dueCents)}</span>
        </div>

        {summary}

        {allowAmountEdit && (
          <Field
            label="Monto a cobrar"
            required
            error={touched ? amountError : null}
            hint="Un monto menor que el saldo registra un abono."
          >
            <div className="[&_input]:h-11 [&_input]:text-[18px] [&_input]:font-semibold">
              <MoneyInput value={amount} onValueChange={setAmount} />
            </div>
          </Field>
        )}

        <fieldset className="flex flex-col">
          <legend className="mb-1.5 text-[12px] leading-4 font-semibold text-ink-2">Método de pago</legend>
          <div
            role="radiogroup"
            aria-label="Método de pago"
            className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta [gap:1px] sm:grid-cols-4"
          >
            {METHODS.map((m, i) => {
              const checked = method === m;
              return (
                <button
                  key={m}
                  ref={(el) => {
                    radios.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => selectMethod(m)}
                  onKeyDown={(e) => onRadioKey(e, i)}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 text-[13.5px] font-semibold [&_svg]:size-4',
                    'transition-colors duration-[var(--dur-fast)] focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]',
                    checked ? 'bg-slate text-slate-ink' : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {METHOD_ICON[m]}
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {isCash ? (
          <div className="grid overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta [gap:1px] sm:grid-cols-2">
            <div className="bg-surface p-3">
              <Field
                label="Efectivo recibido"
                error={receivedError}
                hint={received === null ? 'Vacío equivale al monto exacto.' : undefined}
                labelAside={
                  <button
                    type="button"
                    className="text-[12.5px] font-semibold text-slate underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                    onClick={() => {
                      setReceived(charge);
                      receivedRef.current?.focus();
                    }}
                  >
                    Monto exacto
                  </button>
                }
              >
                <div className="[&_input]:h-12 [&_input]:text-[24px] [&_input]:font-semibold">
                  <MoneyInput ref={receivedRef} value={received} onValueChange={setReceived} />
                </div>
              </Field>
            </div>
            <div className="flex flex-col justify-between gap-1.5 bg-surface p-3 text-right" aria-live="polite">
              <span className="text-[12px] leading-4 font-semibold text-ink-2">Cambio</span>
              <span
                data-testid="payment-change"
                className={cn('num text-[36px] leading-[48px] font-bold tracking-[-0.02em]', change > 0 ? 'text-ink' : 'text-ink-3')}
              >
                {formatCents(change)}
              </span>
            </div>
          </div>
        ) : (
          <Field label="Referencia" required={needsReference} error={touched ? referenceError : null}>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder={needsReference ? 'Número de autorización o transferencia' : 'Opcional'}
            />
          </Field>
        )}

        {error && (
          <p role="alert" className="rounded-[var(--radius-md)] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
