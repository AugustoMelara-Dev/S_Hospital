import { ReceiptText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { InvoicePreviewLine } from '@/api/types';
import { Badge, EmptyState, IconButton, Money, QuantityInput } from '@/ui';
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

/** "Cuenta": Concepto, Cantidad, Precio unitario, Ajuste, Importe, Quitar. */
export function AccountLines({ lines, previewLines, calculating, onQuantity, onRemove, disabled }: Props) {
  if (lines.length === 0) {
    return (
      <EmptyState
        compact
        icon={<ReceiptText />}
        title="La cuenta está vacía"
        description="Busque un concepto por nombre o código y presione Enter para agregarlo."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]" aria-busy={calculating || undefined}>
        <caption className="sr-only">Conceptos de la cuenta</caption>
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-2">
            <th scope="col" className="h-9 px-3 text-left font-medium">
              Concepto
            </th>
            <th scope="col" className="h-9 px-2 text-center font-medium">
              Cantidad
            </th>
            <th scope="col" className="h-9 px-3 text-right font-medium">
              Precio unitario
            </th>
            <th scope="col" className="hidden h-9 px-3 text-right font-medium md:table-cell">
              Ajuste
            </th>
            <th scope="col" className="h-9 px-3 text-right font-medium">
              Importe
            </th>
            <th scope="col" className="w-px px-2">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const p = previewLines?.[i];
            const free = p?.special_rule_applied ?? false;
            return (
              <tr key={line.service.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 align-middle">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-ink">{line.service.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                      {line.service.category?.name}
                      {free && <Badge tone="brand">Sin cobro por receta</Badge>}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-middle">
                  <QuantityInput
                    aria-label={`Cantidad de ${line.service.name}`}
                    itemLabel={line.service.name}
                    value={line.quantity_hundredths}
                    onValueChange={(q) => onQuantity(i, q)}
                    disabled={disabled}
                  />
                </td>
                <td className="num px-3 py-2 text-right align-middle">
                  <Money cents={p ? p.unit_price_registered_cents : line.service.price_cents} />
                </td>
                <td className="num hidden px-3 py-2 text-right align-middle text-ink-2 md:table-cell">
                  {p ? p.rule_adjustment_cents > 0 ? <Money cents={-p.rule_adjustment_cents} /> : '—' : '—'}
                </td>
                <td className={cn('num px-3 py-2 text-right align-middle font-medium', !p && 'text-ink-3')}>
                  {p ? <Money cents={p.line_subtotal_cents} /> : calculating ? '…' : '—'}
                </td>
                <td className="px-2 py-2 align-middle">
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
          })}
        </tbody>
      </table>
    </div>
  );
}
