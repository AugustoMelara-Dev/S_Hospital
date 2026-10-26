import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAPER_CHOICES, THERMAL_COMPATIBILITY_CHOICES, type InstitutionalPaper } from '@/modules/receipts/paperPolicy';

export function ReceiptPaperChoices({ paper, disabled, canEditAdvanced, onSelectPaper }: {
  paper: InstitutionalPaper;
  disabled: boolean;
  canEditAdvanced: boolean;
  onSelectPaper: (paper: InstitutionalPaper) => void;
}) {
  return (
    <>
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Formatos institucionales</legend>
        <div role="radiogroup" aria-label="Formatos institucionales: tipo de papel del recibo" className="grid gap-3 sm:grid-cols-3">
          {PAPER_CHOICES.map((choice) => {
            const selected = choice.value === paper;
            const requiresSupport = choice.value === 'custom' && !canEditAdvanced;
            const inputId = `receipt-paper-${choice.value}`;
            return (
              <label
                key={choice.value}
                htmlFor={inputId}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--ui-radius)] border p-3 text-left transition-colors duration-[120ms] ease-[var(--ui-ease-out)]',
                  selected
                    ? 'border-[var(--ui-navy)] bg-[var(--ui-surface-alt)]'
                    : 'border-[var(--ui-control-border)] bg-[var(--ui-surface)]',
                  (disabled || requiresSupport) && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  id={inputId}
                  name="receipt-paper"
                  value={choice.value}
                  checked={selected}
                  disabled={disabled || requiresSupport}
                  aria-label={choice.label}
                  onChange={() => onSelectPaper(choice.value)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ui-navy)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
                    {choice.label}
                    {selected ? <CheckIcon aria-hidden="true" className="size-3.5 text-[color:var(--ui-navy)]" strokeWidth={2} /> : null}
                  </span>
                  <span className="mt-1 block text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]">
                    {requiresSupport ? 'Requiere autorización de soporte.' : choice.description}
                  </span>
                  {selected ? <span className="mt-1 block text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-navy)]">Seleccionado</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0 rounded-[var(--ui-radius)] border border-dashed border-[var(--ui-line-strong)] p-3">
        <legend className="px-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Formatos térmicos secundarios</legend>
        <p className="text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]">
          Disponibles solo para compatibilidad secundaria; no reemplazan el recibo institucional.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {THERMAL_COMPATIBILITY_CHOICES.map((choice) => (
            <li key={choice.value} className="min-h-11 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3">
              <span className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">{choice.label}</span>
              <span className="mt-1 block text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]">
                {choice.description}
              </span>
            </li>
          ))}
        </ul>
      </fieldset>
    </>
  );
}
