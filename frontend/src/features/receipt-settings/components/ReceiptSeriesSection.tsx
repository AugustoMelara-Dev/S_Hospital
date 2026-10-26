import { Loader2Icon, SaveIcon } from 'lucide-react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { AdminCallout, AdminEmpty, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import type { InstitutionalReceiptSeries } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SeriesFormData } from '../receiptSettings.schema';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, TEXTAREA_CLASS } from '../receiptAdminUi';
import { Field, NumberInput } from './ReceiptSettingsControls';

export function ReceiptSeriesSection({ form, canEdit, canEditAdvanced, activeSeries, isSaving, onSubmit }: {
  form: UseFormReturn<SeriesFormData>;
  canEdit: boolean;
  canEditAdvanced: boolean;
  activeSeries: InstitutionalReceiptSeries | null;
  isSaving: boolean;
  onSubmit: (data: SeriesFormData) => void;
}) {
  return (
    <AdminPanel as="section" aria-labelledby="receipt-series-title">
      <AdminPanelHeader
        headingLevel={2}
        id="receipt-series-title"
        title="Serie institucional"
        description="Numeración que usarán los próximos recibos."
      />
      <div className="p-4">
        {!canEditAdvanced ? (
          <SeriesReadOnlyState series={activeSeries} />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <AdminCallout tone="warn" title="Correlativo sensible">
              Cambie el correlativo solo con autorización documentada. No lo use para corregir recibos ya emitidos.
            </AdminCallout>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Serie" id="series" error={form.formState.errors.series?.message}>
                <Controller name="series" control={form.control} render={({ field }) => <input id="series" className={INPUT_CLASS} disabled={!canEdit} {...field} />} />
              </Field>
              <Field label="Prefijo" id="prefix" error={form.formState.errors.prefix?.message}>
                <Controller name="prefix" control={form.control} render={({ field }) => <input id="prefix" className={INPUT_CLASS} disabled={!canEdit} {...field} />} />
              </Field>
              <Field label="Formato" id="number_format">
                <Controller name="number_format" control={form.control} render={({ field }) => <input id="number_format" className={INPUT_CLASS} disabled={!canEdit} {...field} />} />
              </Field>
              <Field label="Número inicial" id="min_number">
                <Controller name="min_number" control={form.control} render={({ field }) => <NumberInput id="min_number" disabled={!canEdit} className="w-full" {...field} />} />
              </Field>
              <Field label="Número final" id="max_number" error={form.formState.errors.max_number?.message}>
                <Controller name="max_number" control={form.control} render={({ field }) => <NumberInput id="max_number" disabled={!canEdit} className="w-full" {...field} />} />
              </Field>
              <Field
                label="Correlativo actual"
                id="current_number"
                error={form.formState.errors.current_number?.message}
                hint="El próximo recibo usará este valor + 1."
              >
                <Controller name="current_number" control={form.control} render={({ field }) => <NumberInput id="current_number" disabled={!canEdit} className="w-full" {...field} />} />
              </Field>
              <Field label="Rango autorizado" id="range_authorization">
                <Controller name="range_authorization" control={form.control} render={({ field }) => <input id="range_authorization" className={INPUT_CLASS} disabled={!canEdit} {...field} />} />
              </Field>
              <div className="flex items-center gap-2 pt-7">
                <input
                  id="active"
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={form.watch('active')}
                  disabled={!canEdit}
                  onChange={(event) => form.setValue('active', event.target.checked, { shouldDirty: true })}
                />
                <label htmlFor="active" className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Serie activa</label>
              </div>
            </div>
            <Field label="Texto legal del recibo" id="legal_text">
              <Controller name="legal_text" control={form.control} render={({ field }) => <textarea id="legal_text" className={TEXTAREA_CLASS} disabled={!canEdit} {...field} />} />
            </Field>
            <div className="flex justify-end">
              <button type="submit" data-ui-press className={PRIMARY_BUTTON} disabled={!canEdit || isSaving}>
                {isSaving ? <Loader2Icon aria-hidden="true" className="size-4 animate-spin" /> : <SaveIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />}Guardar serie
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminPanel>
  );
}

function SeriesReadOnlyState({ series }: { series: InstitutionalReceiptSeries | null }) {
  if (!series) {
    return (
      <div data-testid="series-readonly-empty">
        <AdminEmpty
          title="Sin serie institucional configurada"
          description="El sistema aun no tiene una serie activa. Solicite a soporte tecnico autorizado que la configure."
        />
      </div>
    );
  }

  const formatRange = `${series.min_number.toLocaleString('es-HN')} a ${series.max_number.toLocaleString('es-HN')}`;
  const correlativo = series.current_number.toLocaleString('es-HN');
  const next = (series.current_number + 1).toLocaleString('es-HN');

  return (
    <div data-testid="series-readonly-state" className="grid gap-3 sm:grid-cols-2">
      <ReadOnlyField label="Serie" value={series.series} />
      <ReadOnlyField label="Prefijo" value={series.prefix} />
      <ReadOnlyField label="Formato" value={series.number_format} />
      <ReadOnlyField label="Rango autorizado" value={formatRange} />
      <ReadOnlyField label="Correlativo actual" value={correlativo} hint={`Próximo recibo: ${next}`} />
      <ReadOnlyField label="Estado" value={series.active ? 'Activa' : 'Inactiva'} />
      {series.range_authorization ? (
        <ReadOnlyField label="Autorización" value={series.range_authorization} />
      ) : null}
      {series.legal_text ? (
        <ReadOnlyField label="Texto legal" value={series.legal_text} multiline />
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value, hint, multiline }: { label: string; value: string; hint?: string; multiline?: boolean }) {
  return (
    <div className="border-b border-[var(--ui-line)] py-3 last:border-b-0">
      <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">{label}</p>
      <p className={cn('mt-1 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]', multiline && 'whitespace-pre-line')}>{value}</p>
      {hint ? <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{hint}</p> : null}
    </div>
  );
}
