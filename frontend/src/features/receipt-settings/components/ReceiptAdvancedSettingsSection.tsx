import { ChevronDownIcon } from 'lucide-react';
import { Controller, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import type { AdvancedProfileFormData } from '../receiptSettings.schema';
import { FOCUS_RING, INPUT_CLASS, TEXTAREA_CLASS } from '../receiptAdminUi';
import { Field, NumberInput, SelectControl } from './ReceiptSettingsControls';

export function ReceiptAdvancedSettingsSection({ form, errors, open, onToggle }: {
  form: UseFormReturn<AdvancedProfileFormData>;
  errors: FieldErrors<AdvancedProfileFormData>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-[var(--ui-line)] pt-3">
      <button
        type="button"
        data-ui-press
        aria-expanded={open}
        aria-controls="receipt-advanced-fields"
        onClick={onToggle}
        className={cn('flex w-full items-center justify-between gap-2 text-left', FOCUS_RING)}
      >
        <span className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Ajustes técnicos avanzados</span>
        <ChevronDownIcon
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn('size-4 shrink-0 text-[color:var(--ui-ink-soft)] transition-transform duration-[120ms] ease-[var(--ui-ease-out)]', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div id="receipt-advanced-fields" className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {([
            ['width_mm', 'Ancho mm'],
            ['height_mm', 'Alto mm'],
            ['margin_top_mm', 'Margen sup. (mm)'],
            ['margin_right_mm', 'Margen der. (mm)'],
            ['margin_bottom_mm', 'Margen inf. (mm)'],
            ['margin_left_mm', 'Margen izq. (mm)'],
          ] as const).map(([name, label]) => (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field, fieldState }) => (
                <Field id={`advanced_${name}`} label={label} error={fieldState.error?.message}>
                  <NumberInput
                    id={`advanced_${name}`}
                    min={0}
                    step={0.1}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value ?? 0)}
                    className="w-full"
                  />
                </Field>
              )}
            />
          ))}
          <Controller
            control={form.control}
            name="orientation"
            render={({ field }) => (
              <Field id="advanced_orientation" label="Orientación">
                <SelectControl
                  id="advanced_orientation"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'landscape', label: 'Horizontal' },
                    { value: 'portrait', label: 'Vertical' },
                  ]}
                />
              </Field>
            )}
          />
          <Field id="advanced_font_family" label="Fuente" error={errors.font_family?.message}>
            <input id="advanced_font_family" className={INPUT_CLASS} {...form.register('font_family')} />
          </Field>
          <Controller
            control={form.control}
            name="font_scale"
            render={({ field, fieldState }) => (
              <Field id="advanced_font_scale" label="Escala" error={fieldState.error?.message}>
                <NumberInput
                  id="advanced_font_scale"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 1)}
                />
              </Field>
            )}
          />
          <div className="md:col-span-2 xl:col-span-3">
            <Field id="advanced_support_reason" label="Motivo de soporte" error={errors.support_reason?.message}>
              <textarea id="advanced_support_reason" rows={3} className={TEXTAREA_CLASS} {...form.register('support_reason')} />
            </Field>
          </div>
        </div>
      ) : null}
    </div>

  );
}
