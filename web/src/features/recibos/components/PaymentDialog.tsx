import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Ellipsis } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { PAYMENT_METHOD_LABEL, type CreatePaymentRequest, type PaymentMethod } from '@/api/types';
import { Button, Dialog, Field, Input, Money, MoneyInput } from '@/ui';

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
          <Button type="submit" variant="primary" loading={submitting} loadingText="Registrando cobro…">
            {`Confirmar cobro · ${formatCents(charge)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {summary}

        {allowAmountEdit ? (
          <Field
            label="Monto a cobrar"
            required
            error={touched ? amountError : null}
            hint={
              <>
                Saldo: <span className="num">{formatCents(dueCents)}</span>. Un monto menor registra un abono.
              </>
            }
          >
            <MoneyInput value={amount} onValueChange={setAmount} />
          </Field>
        ) : (
          <div className="flex items-baseline justify-between rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2.5">
            <span className="text-[13px] text-ink-2">Total a cobrar</span>
            <Money cents={dueCents} className="text-[20px] font-semibold text-ink" />
          </div>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Método de pago</legend>
          <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    'pressable flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border text-[13.5px] font-medium [&_svg]:size-4',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
                    checked
                      ? 'border-brand bg-brand-soft text-brand shadow-[inset_0_0_0_1px_var(--brand)]'
                      : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
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
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <Field
              label="Efectivo recibido"
              error={receivedError}
              hint={received === null ? 'Vacío equivale al monto exacto.' : undefined}
              labelAside={
                <button
                  type="button"
                  className="text-[12.5px] font-medium text-brand underline-offset-2 hover:underline"
                  onClick={() => {
                    setReceived(charge);
                    receivedRef.current?.focus();
                  }}
                >
                  Monto exacto
                </button>
              }
            >
              <MoneyInput ref={receivedRef} value={received} onValueChange={setReceived} />
            </Field>
            <div className="flex min-w-[150px] flex-col gap-1.5 sm:items-end" aria-live="polite">
              <span className="text-[13px] font-medium text-ink">Cambio</span>
              <span data-testid="payment-change" className="num flex h-9 items-center text-[20px] font-semibold text-ink">
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
          <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
