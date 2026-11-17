import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import type { InvoicePreviewLine } from '@/api/types';
import { Badge, IconButton, QuantityInput } from '@/ui';
import type { CartLine } from '../types';

type Props = {
  lines: CartLine[];
  /** Preview lines aligned by index with `lines` (only when the preview matches the cart). */
  previewLines: InvoicePreviewLine[] | undefined;
  calculating: boolean;
  onQuantity: (index: number, hundredths: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
};

/** Grid of juntas: every cell ruled by the one 1px line; outer edges belong to the panel. */
const cell = 'border-b border-l border-junta first:border-l-0';
const th = cn(cell, 'h-8 px-3 text-[12px] leading-4 font-semibold whitespace-nowrap text-ink-2');
const td = cn(cell, 'h-12 px-3 py-1.5 align-middle');

function Missing({ busy }: { busy: boolean }) {
  return (
    <span className="text-ink-3">
      <span aria-hidden="true">{busy ? '…' : '—'}</span>
      <span className="sr-only">{busy ? 'Calculando' : 'No disponible'}</span>
    </span>
  );
}

/**
 * Below 640px each row folds into two lines (concepto; then stepper + importe + quitar)
 * so the money is never clipped. Precio and ISV stay in the totals and the receipt.
 */
const narrowRow =
  'max-[639px]:grid max-[639px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[639px]:items-center max-[639px]:border-b max-[639px]:border-junta ' +
  'max-[639px]:last:border-b-0 max-[639px]:[&>td]:h-auto max-[639px]:[&>td]:border-0';
const narrowHide = 'max-[639px]:hidden';

/** "Cuenta": Concepto, Cant., Precio, ISV, Importe, Quitar. */
export function AccountLines({ lines, previewLines, calculating, onQuantity, onRemove, disabled }: Props) {
  return (
    <div className="relative overflow-x-auto">
      <table
        className="w-full border-collapse text-[14px] max-[639px]:block leading-5 [&>tbody>tr:last-child>td]:border-b-0"
        aria-busy={calculating || undefined}
      >
        <caption className="sr-only">Conceptos de la cuenta</caption>
        <thead className={narrowHide}>
          <tr className="bg-ground">
            <th scope="col" className={cn(th, 'text-left')}>
              Concepto
            </th>
            <th scope="col" className={cn(th, 'w-[120px] text-center')}>
              Cant.
            </th>
            <th scope="col" className={cn(th, 'w-[104px] text-right')}>
              Precio
            </th>
            <th scope="col" className={cn(th, 'w-[88px] text-right')}>
              ISV
            </th>
            <th scope="col" className={cn(th, 'w-[120px] text-right')}>
              Importe
            </th>
            <th scope="col" className={cn(th, 'w-12 px-0')}>
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody className="max-[639px]:block">
          {lines.length === 0 ? (
            <tr className="max-[639px]:block">
              <td colSpan={6} className="h-12 px-3 max-[639px]:block max-[639px]:py-3 text-[13.5px] text-ink-2">
                <span className="font-semibold text-ink">La cuenta está vacía.</span> Busque un concepto por nombre o código y presione
                Enter para agregarlo.
              </td>
            </tr>
          ) : (
            lines.map((line, i) => {
              const p = previewLines?.[i];
              const free = p?.special_rule_applied ?? false;
              const exempt = p ? p.rate_bp === 0 : false;
              return (
                <tr key={line.service.id} className={cn(narrowRow, free && 'bg-slate-soft/45')}>
                  <td className={cn(td, 'max-[639px]:col-span-3 max-[639px]:pt-2.5 max-[639px]:pb-1')}>
                    <div className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-ink">{line.service.name}</span>
                        {exempt && !free && <Badge>Exento</Badge>}
                        {free && (
                          <Badge tone="brand" shape="diamond">
                            Sin cobro por receta
                          </Badge>
                        )}
                      </span>
                      {line.service.category?.name && (
                        <span className="truncate text-[12px] leading-4 text-ink-2">{line.service.category.name}</span>
                      )}
                    </div>
                  </td>
                  <td className={cn(td, 'px-2 text-center max-[639px]:pb-2.5 max-[639px]:pl-3 max-[639px]:text-left')}>
                    <QuantityInput
                      aria-label={`Cantidad de ${line.service.name}`}
                      itemLabel={line.service.name}
                      value={line.quantity_hundredths}
                      onValueChange={(q) => onQuantity(i, q)}
                      disabled={disabled}
                    />
                  </td>
                  <td className={cn(td, 'num text-right text-ink-2', narrowHide)}>
                    {formatCents(p ? p.unit_price_registered_cents : line.service.price_cents)}
                  </td>
                  <td className={cn(td, 'num text-right text-ink-2', narrowHide)}>
                    {p ? exempt ? <Missing busy={false} /> : formatCents(p.tax_cents) : <Missing busy={calculating} />}
                  </td>
                  <td className={cn(td, 'num text-right font-semibold text-ink max-[639px]:pb-2.5')}>
                    {p ? (
                      <span className="flex flex-col items-end leading-tight">
                        {formatCents(p.line_subtotal_cents)}
                        {p.rule_adjustment_cents > 0 && (
                          <span className="text-[12px] font-medium text-slate-text">ajuste −{formatCents(p.rule_adjustment_cents)}</span>
                        )}
                      </span>
                    ) : (
                      <Missing busy={calculating} />
                    )}
                  </td>
                  <td className={cn(td, 'px-1.5 text-center max-[639px]:pb-2.5')}>
                    <IconButton
                      label={`Quitar ${line.service.name}`}
                      icon={<Trash2 />}
                      size="sm"
                      onClick={() => onRemove(i)}
                      disabled={disabled}
                      className="hover:enabled:text-danger"
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
