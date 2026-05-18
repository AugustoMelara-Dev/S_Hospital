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
  onRemoveItem: (index: number) => void;
  onConfirm: () => void;
  disabled?: boolean;
  submitting?: boolean;
};

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function InvoiceCart({ items, preview, onUpdateQuantity, onRemoveItem, onConfirm, disabled, submitting }: InvoiceCartProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
        <Label className="text-base">Carrito ({items.length})</Label>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No hay servicios agregados</p>
          </div>
        ) : (
          <div className="space-y-2 pr-1">
            {items.map((item, index) => {
              const isFree = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <div
                  key={`${item.service.id}-${index}`}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
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
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Quitar item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const newQty = Math.max(100, parseInt(item.quantity) - 100);
                        onUpdateQuantity(index, String(newQty / 100));
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(index, e.target.value)}
                      className="h-8 w-20 text-center"
                      aria-label="Cantidad"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const newQty = parseInt(item.quantity) + 1;
                        onUpdateQuantity(index, String(newQty));
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {item.service.special_rule_code === ERYTHROPOIETIN_RULE && (
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        id={`dialysis-${index}`}
                        checked={item.dialysisPrescription}
                        onCheckedChange={(checked) => {
                          const newItems = [...items];
                          newItems[index] = { ...item, dialysisPrescription: checked === true };
                          onUpdateQuantity(index, item.quantity);
                        }}
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

      <div className="border-t border-border pt-4 mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>L. {preview.subtotal}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">ISV (15%):</span>
          <span>L. {preview.tax}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
          <span>Total:</span>
          <span>L. {preview.total}</span>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full mt-2"
          disabled={disabled || items.length === 0}
          onClick={onConfirm}
        >
          {submitting ? 'Emitiendo...' : 'Emitir Factura'}
        </Button>
      </div>
    </div>
  );
}