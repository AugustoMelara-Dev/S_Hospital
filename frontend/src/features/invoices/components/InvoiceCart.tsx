import { MinusOutlined as Minus, PlusOutlined as Plus, DeleteOutlined as Trash2 } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input, Tag } from 'antd';
import { useRef } from 'react';
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
          <Tag color="processing" className="ml-auto shrink-0 font-mono tabular-nums" aria-label={`${items.length} ${items.length === 1 ? 'línea' : 'líneas'} en la cuenta`}>
            {items.length} {items.length === 1 ? 'línea' : 'líneas'}
          </Tag>
        )}
      </div>

      {erythropoietinIndex >= 0 && canMarkDialysisPrescription ? (
        <div className="mb-3 border-l-2 border-secondary bg-secondary/8 px-3 py-2">
          <Checkbox
            id="patient-dialysis-prescription"
            checked={dialysisPrescription}
            aria-describedby="patient-dialysis-prescription-help"
            onChange={(event) => onUpdateDialysisPrescription(erythropoietinIndex, event.target.checked)}
          >
            <span className="grid gap-0.5 text-left">
              <strong className="text-sm text-foreground">Paciente con receta de diálisis</strong>
              <span id="patient-dialysis-prescription-help" className="text-xs text-muted-foreground">
                Aplica la regla institucional a toda la eritropoyetina de la cuenta: L 25.00 → L 0.00.
              </span>
            </span>
          </Checkbox>
        </div>
      ) : null}

      <div data-billing-cart-lines className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {isEmpty ? (
          <div className="border border-dashed border-operational-border bg-muted/30 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <p className="text-sm font-semibold text-foreground">No hay servicios agregados</p>
            <p className="mt-1 max-w-56 text-xs">Busque por nombre, area o categoria para comenzar.</p>
          </div>
        ) : (
          <div role="table" aria-label="Cuenta actual" className="w-full border border-operational-border">
              <div role="row" className="sr-only grid-cols-12 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground sm:grid">
                <span role="columnheader" className="col-span-7 p-2 font-semibold">Servicio</span>
                <span role="columnheader" className="col-span-2 p-2 font-semibold">Cantidad</span>
                <span role="columnheader" className="col-span-2 p-2 text-right font-semibold">Importe</span>
                <span role="columnheader" className="col-span-1 p-2"><span className="sr-only">Acciones</span></span>
              </div>
            <div role="rowgroup" className="divide-y divide-operational-border">
            {items.map((item, index) => {
              const isErythropoietin = item.service.special_rule_code === ERYTHROPOIETIN_RULE;
              const isFree = dialysisPrescription && isErythropoietin;
              const estimatedLineTotal = isFree ? 0 : lineTotalCents(item.service.price, item.quantity);

              return (
                <div
                  role="row"
                  key={`${item.service.id}-${index}`}
                  className="grid grid-cols-1 bg-card p-3 sm:grid-cols-12 sm:items-start sm:p-0"
                >
                  <div role="rowheader" className="min-w-0 pb-2 sm:col-span-7 sm:p-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-tight">{item.service.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Tag className="m-0 px-1.5 py-0.5 text-xs">
                          {item.service.category?.name ?? 'Sin categoría'}
                        </Tag>
                        {item.service.area?.name && item.service.area.name.trim().toLocaleLowerCase('es') !== (item.service.category?.name ?? '').trim().toLocaleLowerCase('es') ? (
                          <Tag className="m-0 px-1.5 py-0.5 text-xs">
                            {item.service.area.name}
                          </Tag>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Precio registrado: <span className="font-mono tabular-nums">{moneyLabel(item.service.price)}</span>{' '}
                        {isFree && <span className="font-semibold text-success">(Gratis - receta diálisis)</span>}
                      </p>
                    </div>
                  </div>

                  <div role="cell" className="py-2 sm:col-span-2 sm:p-2">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground sm:sr-only">Cantidad</span>
                    <div className="flex items-center gap-1">
                    <Button
                      type="default"
                      className="size-11 p-0 sm:size-9"
                      onClick={() => onUpdateQuantity(index, formatQuantity(Math.max(100, parseQuantityUnits(item.quantity) - 100)))}
                      aria-label={`Disminuir cantidad de ${item.service.name}`}
                      icon={<Minus className="size-3" aria-hidden="true" />}
                    />
                    <Input
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(index, e.target.value)}
                      className="h-11 min-w-0 flex-1 px-1 text-center font-mono text-sm tabular-nums sm:h-9 sm:w-14 sm:flex-none"
                      inputMode="decimal"
                      name={`quantity-${item.service.id}`}
                      aria-label={`Cantidad de ${item.service.name}`}
                    />
                    <Button
                      type="default"
                      className="size-11 p-0 sm:size-9"
                      onClick={() => onUpdateQuantity(index, formatQuantity(parseQuantityUnits(item.quantity) + 100))}
                      aria-label={`Aumentar cantidad de ${item.service.name}`}
                      icon={<Plus className="size-3" aria-hidden="true" />}
                    />
                    </div>
                  </div>
                  <div role="cell" className="py-2 text-right sm:col-span-2 sm:p-2">
                    <span className="mr-2 text-xs font-semibold text-muted-foreground sm:sr-only">Importe</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{formatLempirasUIFromCents(estimatedLineTotal)}</span>
                  </div>
                  <div role="cell" className="pt-1 text-right sm:col-span-1 sm:p-2">
                    <Button
                      type="text"
                      onClick={() => onRemoveItem(index)}
                      className="size-11 p-0 text-muted-foreground hover:text-destructive sm:size-9"
                      aria-label={`Quitar ${item.service.name}`}
                      icon={<Trash2 className="size-4" aria-hidden="true" />}
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
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
          type="primary"
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
              <span className="mr-2 inline-block size-4 bg-current/70 animate-spin" aria-hidden="true" />
              Emitiendo...
            </>
          ) : disabled || isEmpty ? (
            disabledActionLabel
          ) : (
            <>{enabledActionLabel}</>
          )}
        </Button>
        {disabledReasons.length > 0 && (
          <Alert id="invoice-submit-blockers" type="warning" showIcon className="mt-2" title="Pendiente para emitir" description={
            disabledReasons.map((reason) => (
              <p key={reason} className="m-0 text-xs">{reason}</p>
            ))
          } />
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
