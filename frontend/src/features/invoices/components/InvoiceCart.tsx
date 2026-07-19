import { MinusIcon as Minus, PlusIcon as Plus, Trash2Icon as Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

export type CartItem = {
  service: import('../../../lib/api').Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type InvoiceCartProps = {
  items: CartItem[];
  preview: { subtotal: string; exempt?: string; tax: string; total: string };
  taxRate?: string;
  onUpdateQuantity: (index: number, quantity: string) => void;
  onUpdateDialysisPrescription: (index: number, checked: boolean) => void;
  onRemoveItem: (index: number) => void;
  onConfirm: () => void;
  disabled?: boolean;
  disabledReasons?: string[];
  actionLabel?: string;
  emptyActionLabel?: string;
  submitting?: boolean;
  canMarkDialysisPrescription?: boolean;
};

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function InvoiceCart({
  items,
  preview,
  taxRate,
  onUpdateQuantity,
  onUpdateDialysisPrescription,
  onRemoveItem,
  onConfirm,
  disabled,
  disabledReasons = [],
  actionLabel = 'Emitir Factura',
  emptyActionLabel = 'Agregar servicios',
  submitting,
  canMarkDialysisPrescription = false,
}: InvoiceCartProps) {
  const confirmLockRef = useRef(false);
  const isEmpty = items.length === 0;
  const primaryBlockReason = disabledReasons[0];
  const disabledActionLabel = isEmpty
    ? emptyActionLabel
    : primaryBlockReason
    ? actionLabelForBlockReason(primaryBlockReason, emptyActionLabel)
    : emptyActionLabel;
  const disabledReasonId = disabledReasons.length > 0 ? 'invoice-submit-blockers' : undefined;
  const displayActionLabel = submitting
    ? 'Emitiendo...'
    : disabled || isEmpty
      ? disabledActionLabel
      : actionLabel;
  const actionAriaLabel = disabled || isEmpty ? `${actionLabel}: ${displayActionLabel}` : actionLabel;
  const totalLabel = moneyLabel(preview.total);
  const enabledActionLabel = actionLabel.includes(totalLabel) ? actionLabel : `${actionLabel} · ${totalLabel}`;
  const erythropoietinIndex = items.findIndex(
    (item) => item.service.special_rule_code === ERYTHROPOIETIN_RULE,
  );
  const dialysisPrescription = canMarkDialysisPrescription && items.some(
    (item) => item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE,
  );
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col" aria-labelledby="invoice-cart-title" aria-busy={submitting ? 'true' : undefined}>
      <div className="mb-3 flex items-start gap-3 border-b border-operational-border pb-3">
        <div className="min-w-0">
          <h2 id="invoice-cart-title" className="text-xl font-semibold tracking-tight text-foreground block">Cuenta actual</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revise servicios y cantidades antes de emitir.</p>
        </div>
        {items.length > 0 && (
          <Badge variant="secondary" className="ml-auto shrink-0 font-mono tabular-nums" aria-label={`${items.length} ${items.length === 1 ? 'línea' : 'líneas'} en la cuenta`}>
            {items.length} {items.length === 1 ? 'línea' : 'líneas'}
          </Badge>
        )}
      </div>

      {erythropoietinIndex >= 0 && canMarkDialysisPrescription ? (
        <div className="mb-3 border-l-2 border-secondary bg-secondary/8 px-3 py-2">
          <div className="flex items-start gap-3"><Checkbox
            id="patient-dialysis-prescription"
            checked={dialysisPrescription}
            aria-labelledby="patient-dialysis-prescription-label"
            aria-describedby="patient-dialysis-prescription-help"
            onCheckedChange={(checked) => onUpdateDialysisPrescription(erythropoietinIndex, checked === true)}
          />
          <div id="patient-dialysis-prescription-label">
            <span className="grid gap-0.5 text-left">
              <strong className="text-sm text-foreground">Paciente con receta de diálisis</strong>
              <span id="patient-dialysis-prescription-help" className="text-xs text-muted-foreground">
                Aplica la regla institucional a toda la eritropoyetina de la cuenta: L 25.00 → L 0.00.
              </span>
            </span>
          </div></div>
        </div>
      ) : null}

      <div data-billing-cart-lines className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {isEmpty ? (
          <div className="border border-dashed border-operational-border bg-muted/30 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <p className="text-sm font-semibold text-foreground">No hay servicios agregados</p>
            <p className="mt-1 max-w-56 text-xs">Busque por nombre, area o categoria para comenzar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-operational-border"><Table aria-label="Cuenta actual"><TableHeader><TableRow><TableHead>Servicio</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Importe</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{items.map((item, index) => {
            const isFree = dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE;
            const estimatedLineTotal = isFree ? 0 : lineTotalCents(item.service.price, item.quantity);
            return <TableRow key={item.service.id}><TableCell><p className="break-words text-sm font-semibold leading-tight">{item.service.name}</p><div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="outline">{item.service.category?.name ?? 'Sin categoría'}</Badge>{item.service.area?.name && item.service.area.name.trim().toLocaleLowerCase('es') !== (item.service.category?.name ?? '').trim().toLocaleLowerCase('es') ? <Badge variant="outline">{item.service.area.name}</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">Precio registrado: <span className="font-mono tabular-nums">{moneyLabel(item.service.price)}</span>{isFree ? <span className="font-semibold text-success"> (Gratis - receta diálisis)</span> : null}</p></TableCell><TableCell><div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon" onClick={() => onUpdateQuantity(index, formatQuantity(Math.max(100, parseQuantityUnits(item.quantity) - 100)))} aria-label={`Disminuir cantidad de ${item.service.name}`}><Minus aria-hidden="true" /></Button><Input value={item.quantity} onChange={(event) => onUpdateQuantity(index, event.target.value)} className="min-w-16 text-center font-mono tabular-nums" inputMode="decimal" name={`quantity-${item.service.id}`} aria-label={`Cantidad de ${item.service.name}`} /><Button type="button" variant="outline" size="icon" onClick={() => onUpdateQuantity(index, formatQuantity(parseQuantityUnits(item.quantity) + 100))} aria-label={`Aumentar cantidad de ${item.service.name}`}><Plus aria-hidden="true" /></Button></div></TableCell><TableCell className="text-right font-mono font-semibold tabular-nums"><span className="mr-2 text-xs text-muted-foreground sm:sr-only">Importe</span>{formatLempirasUIFromCents(estimatedLineTotal)}</TableCell><TableCell><Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(index)} className="text-muted-foreground hover:text-destructive" aria-label={`Quitar ${item.service.name}`}><Trash2 aria-hidden="true" /></Button></TableCell></TableRow>;
          })}</TableBody></Table></div>
        )}
      </div>

      <div data-billing-cart-action className="z-10 mt-4 shrink-0 border-t border-operational-border bg-operational-surface pt-4">
        <dl className="mb-3 border border-operational-border bg-muted p-3">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-mono tabular-nums">{moneyLabel(preview.subtotal)}</dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Exento</dt>
            <dd className="font-mono tabular-nums">{moneyLabel(preview.exempt ?? '0.00')}</dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{taxRate ? `ISV (${taxRate}%)` : 'ISV'}</dt>
            <dd className="font-mono tabular-nums">{moneyLabel(preview.tax)}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3 border-t border-border pt-2">
            <dt className="font-bold">Total</dt>
            <dd className="whitespace-nowrap font-mono text-xl font-bold tabular-nums">{moneyLabel(preview.total)}</dd>
          </div>
        </dl>

        <Button
          type="button"
          className="w-full font-semibold h-11"
          disabled={disabled || isEmpty}
          aria-describedby={disabledReasonId}
          aria-label={actionAriaLabel}
          onClick={() => {
            if (confirmLockRef.current) return;
            confirmLockRef.current = true;
            onConfirm();
            window.setTimeout(() => {
              confirmLockRef.current = false;
            }, 300);
          }}
        >
          {submitting ? (
            <>
              <Spinner className="mr-2" aria-hidden="true" />
              Emitiendo...
            </>
          ) : disabled || isEmpty ? (
            disabledActionLabel
          ) : (
            <>{enabledActionLabel}</>
          )}
        </Button>
        {disabledReasons.length > 0 && (
          <Alert id="invoice-submit-blockers" className="mt-2"><AlertTitle>Pendiente para emitir</AlertTitle><AlertDescription>{disabledReasons.map((reason) => <p key={reason} className="m-0 text-xs">{reason}</p>)}</AlertDescription></Alert>
        )}
      </div>
    </section>
  );
}

function actionLabelForBlockReason(reason: string, emptyActionLabel: string): string {
  if (reason.toLowerCase().includes('caja')) {
    return 'Abra caja primero';
  }

  if (reason.toLowerCase().includes('paciente')) {
    return 'Ingrese paciente';
  }

  if (reason.toLowerCase().includes('servicio')) {
    return emptyActionLabel;
  }

  return 'Complete requisitos';
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}

function lineTotalCents(price: string | number | null | undefined, quantity: string): number {
  const priceCents = parseCents(price) ?? 0;
  const quantityUnits = parseQuantityUnits(quantity);

  return Math.max(0, Math.round((priceCents * quantityUnits) / 100));
}

function parseQuantityUnits(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 100;
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function formatQuantity(units: number): string {
  const safeUnits = Math.max(100, units);
  const whole = Math.trunc(safeUnits / 100);
  const decimals = safeUnits % 100;
  return decimals === 0 ? String(whole) : `${whole}.${String(decimals).padStart(2, '0')}`;
}
