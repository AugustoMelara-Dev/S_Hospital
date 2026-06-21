import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

export type CartItem = {
  service: import('../../../lib/api').Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type InvoiceCartProps = {
  items: CartItem[];
  preview: { subtotal: string; tax: string; total: string };
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
  const actionAriaLabel = disabled || isEmpty ? `${actionLabel}: ${displayActionLabel}` : undefined;

  return (
    <section className="flex h-full min-w-0 flex-col" aria-labelledby="invoice-cart-title" aria-busy={submitting ? 'true' : undefined}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-secondary/25 bg-secondary/10 text-secondary">
          <ShoppingCart className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Label id="invoice-cart-title" className="text-base font-semibold text-foreground">Factura en curso</Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Revise servicios, cantidades y total estimado antes de emitir.
          </p>
        </div>
        {items.length > 0 && (
          <Badge variant="info" className="ml-auto shrink-0 font-mono tabular-nums" aria-label={`${items.length} servicios agregados`}>
            {items.length}
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/35 px-4 py-12 text-center text-muted-foreground" role="status" aria-live="polite">
            <ShoppingCart className="mb-3 size-10 opacity-50" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">No hay servicios agregados</p>
            <p className="mt-1 max-w-56 text-xs">Busque por nombre, categoría o código para comenzar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pr-1" role="list" aria-label="Servicios agregados a la factura">
            {items.map((item, index) => {
              const isErythropoietin = item.service.special_rule_code === ERYTHROPOIETIN_RULE;
              const isFree = item.dialysisPrescription && isErythropoietin;
              const dialysisHelpId = `dialysis-${index}-help`;

              return (
                <div
                  key={`${item.service.id}-${index}`}
                  role="listitem"
                  className="flex flex-col gap-3 rounded-md border border-border bg-card/95 p-3 transition-colors hover:border-secondary/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-tight">{item.service.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="rounded-sm px-1.5 py-0.5 text-[10px]">
                          {item.service.category?.name ?? 'Sin categoría'}
                        </Badge>
                        {item.service.area?.name ? (
                          <Badge variant="secondary" className="rounded-sm px-1.5 py-0.5 text-[10px]">
                            {item.service.area.name}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {moneyLabel(item.service.price)} {isFree && <span className="font-sans font-semibold text-success">(Gratis - receta diálisis)</span>}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar ${item.service.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-9 p-0"
                        onClick={() => {
                          onUpdateQuantity(index, formatQuantity(Math.max(100, parseQuantityUnits(item.quantity) - 100)));
                        }}
                        aria-label={`Disminuir cantidad de ${item.service.name}`}
                      >
                        <Minus className="size-3" aria-hidden="true" />
                      </Button>
                      <Input
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(index, e.target.value)}
                        className="h-9 w-24 text-center font-mono tabular-nums"
                        inputMode="decimal"
                        name={`quantity-${item.service.id}`}
                        aria-label={`Cantidad de ${item.service.name}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-9 p-0"
                        onClick={() => {
                          onUpdateQuantity(index, formatQuantity(parseQuantityUnits(item.quantity) + 100));
                        }}
                        aria-label={`Aumentar cantidad de ${item.service.name}`}
                      >
                        <Plus className="size-3" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Importe base</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{moneyLabel(item.service.price)}</span>
                    </div>
                  </div>

                  {isErythropoietin && (
                    <label htmlFor={`dialysis-${index}`} className="flex items-start gap-2 rounded-md border border-secondary/20 bg-secondary/8 px-2 py-2 text-xs">
                      <Checkbox
                        id={`dialysis-${index}`}
                        checked={item.dialysisPrescription}
                        disabled={!canMarkDialysisPrescription}
                        aria-describedby={dialysisHelpId}
                        onCheckedChange={(checked) => onUpdateDialysisPrescription(index, checked === true)}
                      />
                      <span id={dialysisHelpId} className={`text-muted-foreground ${!canMarkDialysisPrescription ? 'opacity-60' : ''}`}>
                        {canMarkDialysisPrescription ? 'Receta de diálisis (gratis)' : 'Receta de diálisis (requiere autorización)'}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-border bg-card/95 pt-4">
        <dl className="mb-4 space-y-2">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Subtotal:</dt>
            <dd className="font-mono tabular-nums">{moneyLabel(preview.subtotal)}</dd>
          </div>
          {taxRate && (
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">ISV ({taxRate}%):</dt>
              <dd className="font-mono tabular-nums">{moneyLabel(preview.tax)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-border pt-3 text-xl font-bold">
            <dt>Total estimado:</dt>
            <dd className="font-mono tabular-nums text-secondary">{moneyLabel(preview.total)}</dd>
          </div>
        </dl>

        <Button
          type="button"
          size="lg"
          className="w-full font-semibold"
          disabled={disabled || isEmpty}
          aria-describedby={disabledReasonId}
          aria-label={actionAriaLabel}
          onClick={onConfirm}
        >
          {submitting ? (
            <>
              <span className="mr-2 inline-block size-4 animate-pulse rounded-sm bg-current/70" aria-hidden="true" />
              Emitiendo...
            </>
          ) : disabled || isEmpty ? (
            disabledActionLabel
          ) : (
            <>{actionLabel}</>
          )}
        </Button>
        {disabledReasons.length > 0 && (
          <Alert id="invoice-submit-blockers" variant="warning" className="mt-2" title="Pendiente para emitir">
            {disabledReasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </Alert>
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
