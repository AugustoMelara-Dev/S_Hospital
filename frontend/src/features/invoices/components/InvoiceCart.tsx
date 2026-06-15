import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

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
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-secondary" aria-hidden="true" />
        <Label className="text-base font-semibold">Factura en curso</Label>
        {items.length > 0 && (
          <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-2 font-mono text-[10px] font-bold tabular-nums text-primary-foreground">
            {items.length}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/35 px-4 py-12 text-center text-muted-foreground">
            <ShoppingCart className="mb-3 h-10 w-10 opacity-50" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">No hay servicios agregados</p>
            <p className="mt-1 max-w-56 text-xs">Busque por nombre, categoría o código para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-2 pr-1">
            {items.map((item, index) => {
              const isFree = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <div
                  key={`${item.service.id}-${index}`}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors hover:border-secondary/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.service.name}</p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {moneyLabel(item.service.price)} {isFree && <span className="font-sans font-semibold text-success">(Gratis - receta diálisis)</span>}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(index)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Quitar ${item.service.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        onUpdateQuantity(index, formatQuantity(Math.max(100, parseQuantityUnits(item.quantity) - 100)));
                      }}
                      aria-label={`Disminuir cantidad de ${item.service.name}`}
                    >
                      <Minus className="h-3 w-3" aria-hidden="true" />
                    </Button>
                    <Input
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(index, e.target.value)}
                      className="h-8 w-20 text-center font-mono tabular-nums"
                      inputMode="decimal"
                      name={`quantity-${item.service.id}`}
                      aria-label={`Cantidad de ${item.service.name}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        onUpdateQuantity(index, formatQuantity(parseQuantityUnits(item.quantity) + 100));
                      }}
                      aria-label={`Aumentar cantidad de ${item.service.name}`}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>

                  {item.service.special_rule_code === ERYTHROPOIETIN_RULE && (
                    <label htmlFor={`dialysis-${index}`} className="flex items-center gap-2 rounded-md border border-secondary/20 bg-secondary/8 px-2 py-2 text-xs">
                      <Checkbox
                        id={`dialysis-${index}`}
                        checked={item.dialysisPrescription}
                        disabled={!canMarkDialysisPrescription}
                        onCheckedChange={(checked) => onUpdateDialysisPrescription(index, checked === true)}
                      />
                      <span className={`text-muted-foreground ${!canMarkDialysisPrescription ? 'opacity-60' : ''}`}>
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
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-mono tabular-nums">{moneyLabel(preview.subtotal)}</span>
          </div>
          {taxRate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ISV ({taxRate}%):</span>
              <span className="font-mono tabular-nums">{moneyLabel(preview.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3 text-xl font-bold">
            <span>Total estimado:</span>
            <span className="font-mono tabular-nums text-secondary">{moneyLabel(preview.total)}</span>
          </div>
        </div>

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
              <span className="mr-2 inline-block h-4 w-4 animate-pulse rounded-sm bg-current/70" aria-hidden="true" />
              Emitiendo…
            </>
          ) : disabled || isEmpty ? (
            disabledActionLabel
          ) : (
            <>{actionLabel}</>
          )}
        </Button>
        {disabledReasons.length > 0 && (
          <div id="invoice-submit-blockers" className="mt-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {disabledReasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        )}
      </div>
    </div>
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
  return formatLempirasFromCents(parseCents(value));
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
