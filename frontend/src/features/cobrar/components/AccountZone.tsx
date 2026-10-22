import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  AdminCallout,
  AdminTable,
  FreeMedicationBadge,
  MoneyText,
  type AdminColumn,
} from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import { formatQuantityUnits, parseCents, parseQuantityUnits, type QuantityUnits } from '@/lib/moneyCents';
import type { InvoicePreview, InvoicePreviewItem } from '@/lib/api';
import type { CobrarLine } from '../state/types';
import { ICON_BUTTON_COMPACT, STEPPER, STEPPER_BUTTON, STEPPER_INPUT } from './cobrarUi';

type AccountZoneProps = {
  lines: CobrarLine[];
  canMarkDialysisPrescription: boolean;
  hasEligibleMedication: boolean;
  conditionActive: boolean;
  preview?: InvoicePreview | null;
  previewMatchesRevision?: boolean;
  disabled?: boolean;
  onToggleCondition: (checked: boolean) => void;
  onQuantityChange: (index: number, quantity: string) => void;
  onRemoveLine: (index: number) => void;
};

/**
 * Líneas de la cuenta contable continua (Ledger).
 *
 * Columnas contables completas:
 * - Concepto (nombre completo sin recorte, distintivo institucional de gratuidad cuando aplique)
 * - Cantidad (stepper táctil accesible con botones - y + con aria-label)
 * - Precio unitario de catálogo
 * - Ajuste de regla institucional
 * - Importe de línea con cifras tabulares estándar ("L. 15.00")
 * - Quitar concepto
 */
export function AccountZone({
  lines,
  canMarkDialysisPrescription,
  hasEligibleMedication,
  conditionActive,
  preview = null,
  previewMatchesRevision = false,
  disabled = false,
  onToggleCondition,
  onQuantityChange,
  onRemoveLine,
}: AccountZoneProps) {
  function valuedItem(line: CobrarLine): InvoicePreviewItem | null {
    if (!previewMatchesRevision || !preview) return null;

    return preview.items.find((item) => item.service_id === line.service.id) ?? null;
  }

  function step(index: number, current: string, delta: 100 | -100) {
    const units = parseQuantityUnits(current);

    if (units === null) {
      return;
    }

    const next = Math.max(1, units + delta);

    onQuantityChange(index, next % 100 === 0 ? String(next / 100) : formatQuantityUnits(next as QuantityUnits));
  }

  const columns: AdminColumn<CobrarLine>[] = [
    {
      key: 'description',
      header: 'Concepto',
      className: 'min-w-[10rem] px-3',
      mobilePrimary: true,
      cell: (line) => {
        const item = valuedItem(line);

        return (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium [overflow-wrap:anywhere]">{line.service.name}</span>
            {item?.special_rule_applied ? <FreeMedicationBadge label="Sin cobro por receta" /> : null}
          </span>
        </span>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'center',
      className: 'w-[7rem] px-2',
      cell: (line, index) => {
        const quantityInvalid = parseQuantityUnits(line.quantity) === null;
        const quantityErrorId = `cobrar-quantity-${index}-error`;

        return (
          <span className="inline-flex flex-col items-center gap-1">
            <span className={cn(STEPPER, quantityInvalid && 'border-[var(--ui-danger)]')}>
              <button
                type="button"
                className={STEPPER_BUTTON}
                aria-label={`Disminuir cantidad de ${line.service.name}`}
                disabled={disabled || quantityInvalid}
                onClick={() => step(index, line.quantity, -100)}
              >
                <MinusIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
              <input
                value={line.quantity}
                onChange={(event) => onQuantityChange(index, event.target.value)}
                disabled={disabled}
                inputMode="decimal"
                aria-label={`Cantidad de ${line.service.name}`}
                aria-invalid={quantityInvalid || undefined}
                aria-describedby={quantityInvalid ? quantityErrorId : undefined}
                className={cn(STEPPER_INPUT, 'scroll-mb-[7rem]')}
              />
              <button
                type="button"
                className={STEPPER_BUTTON}
                aria-label={`Aumentar cantidad de ${line.service.name}`}
                disabled={disabled || quantityInvalid}
                onClick={() => step(index, line.quantity, 100)}
              >
                <PlusIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
            </span>
            {quantityInvalid ? (
              <span
                id={quantityErrorId}
                role="alert"
                className="max-w-[8rem] text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]"
              >
                Cantidad inválida: escriba un número mayor que cero, con hasta dos decimales.
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'unitPrice',
      header: 'Precio unitario',
      align: 'right',
      className: 'w-[6.5rem] px-2 whitespace-nowrap',
      cell: (line) => (
        <span className="tabular-nums">
          <MoneyText cents={valuedItem(line)?.unit_price_registered_cents ?? parseCents(line.service.price)} />
        </span>
      ),
    },
    {
      key: 'adjustment',
      header: 'Ajuste',
      align: 'center',
      className: 'w-[6.5rem] px-2 whitespace-nowrap',
      cell: (line) => {
        const item = valuedItem(line);

        if (!item) return <span className="text-[color:var(--ui-ink-soft)]">Pendiente</span>;
        if (!item.special_rule_applied) return <span className="text-[color:var(--ui-ink-soft)]">—</span>;

        return (
          <span className="inline-flex flex-col items-end text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-action)]">
            <span>Sin cobro</span>
            {typeof item.rule_adjustment_cents === 'number' && item.rule_adjustment_cents > 0 ? (
              <span className="tabular-nums">− <MoneyText cents={item.rule_adjustment_cents} /></span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Importe',
      align: 'right',
      className: 'w-[6.5rem] px-2 whitespace-nowrap',
      mobilePrimary: true,
      cell: (line) => {
        const item = valuedItem(line);

        return item ? (
          <MoneyText cents={item.line_total_cents} emphasis="strong" />
        ) : (
          <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Calculando…</span>
        );
      },
    },
    {
      key: 'remove',
      header: <span className="sr-only">Quitar</span>,
      align: 'right',
      className: 'w-12 px-2',
      cell: (line, index) => (
        <button
          type="button"
          className={cn(ICON_BUTTON_COMPACT, 'border-transparent bg-transparent hover:border-[var(--ui-danger-subtle)] hover:bg-[var(--ui-danger-subtle)] hover:text-[color:var(--ui-danger)]')}
          aria-label={`Quitar ${line.service.name}`}
          disabled={disabled}
          onClick={() => onRemoveLine(index)}
        >
          <Trash2Icon aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {hasEligibleMedication && canMarkDialysisPrescription ? (
        <div className="flex items-start gap-3 border-b border-[var(--ui-line)] px-5 py-3">
          <input
            id="cobrar-condition"
            type="checkbox"
            checked={conditionActive}
            disabled={disabled}
            onChange={(event) => onToggleCondition(event.target.checked)}
            aria-describedby="cobrar-condition-help"
            className="mt-0.5 size-5 shrink-0 accent-[var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
          />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <label
              htmlFor="cobrar-condition"
              className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
            >
              Paciente con receta de diálisis
            </label>
            <p id="cobrar-condition-help" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              Aplica solo al medicamento elegible; el resto conserva su precio.
            </p>
          </div>
        </div>
      ) : null}

      {conditionActive && !hasEligibleMedication ? (
        <div className="px-4 pt-3">
          <AdminCallout tone="warn" title="Condición sin medicamento elegible">
            La condición está activa pero no hay un medicamento elegible en la cuenta. Ningún producto se
            vuelve gratuito por esta regla.
          </AdminCallout>
        </div>
      ) : null}

      <div className={cn('min-h-0', lines.length === 0 && 'px-5 py-8')}>
        {lines.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center border-y border-dashed border-[var(--ui-line-strong)] px-4 text-center">
            <p className="font-semibold text-[color:var(--ui-ink)]">La cuenta está vacía</p>
            <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
              Busque un servicio o use un acceso rápido para iniciar la cuenta.
            </p>
          </div>
        ) : (
          <AdminTable
            columns={columns}
            rows={lines}
            getRowKey={(line) => String(line.service.id)}
            caption="Líneas de la cuenta"
            className="max-h-[30rem] rounded-none border-x-0 border-t-0"
            minTableWidth="48rem"
            mobileCards={false}
          />
        )}
      </div>
    </div>
  );
}
