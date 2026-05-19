import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export type CartItem = {
  service: import('../../../lib/api').Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type InvoiceCartProps = {
  items: CartItem[];
  preview: { subtotal: string; tax: string; total: string };
  onUpdateQuantity: (index: number, quantity: string) => void;
  onUpdateDialysisPrescription: (index: number, checked: boolean) => void;
  onRemoveItem: (index: number) => void;
  onConfirm: () => void;
  disabled?: boolean;
  disabledReasons?: string[];
  actionLabel?: string;
  emptyActionLabel?: string;
  submitting?: boolean;
};

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function InvoiceCart({
  items,
  preview,
  onUpdateQuantity,
  onUpdateDialysisPrescription,
  onRemoveItem,
  onConfirm,
  disabled,
  disabledReasons = [],
  actionLabel = 'Emitir Factura',
  emptyActionLabel = 'Agregar servicios',
  submitting,
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
        <Label className="text-base font-semibold">Carrito</Label>
        {items.length > 0 && (
          <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {items.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No hay servicios agregados</p>
            <p className="text-xs mt-1">Haga clic en un servicio para agregarlo</p>
          </div>
        ) : (
          <div className="space-y-2 pr-1">
            {items.map((item, index) => {
              const isFree = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <div
                  key={`${item.service.id}-${index}`}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        L. {item.service.price} {isFree && <span className="text-emerald-600 font-medium">(Gratis - Receta dialisis)</span>}
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
                      className="h-8 w-20 text-center"
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
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        id={`dialysis-${index}`}
                        checked={item.dialysisPrescription}
                        onCheckedChange={(checked) => onUpdateDialysisPrescription(index, checked === true)}
                      />
                      <span className="text-muted-foreground">Receta de dialisis (gratis)</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 mt-4 bg-card sticky bottom-0">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>L. {preview.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ISV (15%):</span>
            <span>L. {preview.tax}</span>
          </div>
          <div className="flex justify-between font-bold text-xl border-t border-border pt-2">
            <span>Total:</span>
            <span className="text-primary">L. {preview.total}</span>
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
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Emitiendo...
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
