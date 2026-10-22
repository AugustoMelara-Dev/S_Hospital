import { useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminCallout, AdminDialog, AdminField, MoneyText } from '@/design-system/admin/components';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import { ServiceAuditedChangesSummary, auditedServiceChanges, priceValuesDiffer } from './ServiceAuditedChangesSummary';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, SELECT_CLASS } from './catalogUi';
import { MIN_CHANGE_REASON_LENGTH, SPECIAL_RULE_ERYTHROPOIETIN, defaultServiceFormValues, serviceSchema, type ServiceFormData } from './serviceDrawerTypes';

type ServiceDraft = { id: number; category_id: number; area_id?: number | null; name: string; price: string; scan_code?: string | null; barcode?: string | null; qr_code?: string | null; taxable: boolean; active: boolean; visible_in_billing?: boolean | null; is_billable?: boolean | null; special_rule_code?: string | null };
type ServiceDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void; service?: ServiceDraft | null; categories: Array<{ id: number; name: string }>; areas: Array<{ id: number; name: string }>; onSuccess: () => void };
type TextFieldName = keyof Pick<ServiceFormData, 'name' | 'price' | 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason' | 'scan_code' | 'barcode' | 'qr_code'>;
const optionalCode = (value: string | null | undefined) => value?.trim() || null;

export function ServiceDrawer({ open, onOpenChange, service, categories, areas, onSuccess }: ServiceDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, getValues, reset, setError, setFocus, setValue, watch, formState: { errors, isSubmitting } } = useForm<ServiceFormData>({ resolver: zodResolver(serviceSchema), defaultValues: defaultServiceFormValues });
  const wasOpenRef = useRef(false);
  const previousEntityKeyRef = useRef<number | 'new' | null>(null);
  const entityKey = service?.id ?? 'new';
  const values = watch();
  const hasEpoRule = Boolean(service?.special_rule_code === SPECIAL_RULE_ERYTHROPOIETIN);
  const priceChanged = Boolean(service && priceValuesDiffer(service.price, values.price));
  const taxChanged = Boolean(service && service.taxable !== values.taxable);
  const availabilityChanged = Boolean(service && (service.active !== values.active || (service.visible_in_billing ?? true) !== values.visible_in_billing || (service.is_billable ?? true) !== values.is_billable));
  const auditedChanges = service ? auditedServiceChanges(service, values) : [];
  // La tarifa vigente y el tratamiento fiscal salen del catálogo, nunca de
  // literales ligados a la regla de gratuidad.
  const epoTariffCents = parseCents(values.price);

  useLayoutEffect(() => {
    const shouldInitialize = open && (!wasOpenRef.current || previousEntityKeyRef.current !== entityKey);

    if (shouldInitialize) {
      setSubmitError(null);
      reset(service ? {
        category_id: service.category_id,
        area_id: service.area_id ?? 0,
        name: service.name,
        price: service.price,
        price_change_reason: null,
        tax_change_reason: null,
        availability_change_reason: null,
        scan_code: service.scan_code,
        barcode: service.barcode,
        qr_code: service.qr_code,
        taxable: service.taxable,
        active: service.active,
        visible_in_billing: service.visible_in_billing ?? true,
        is_billable: service.is_billable ?? true,
      } : {
        ...defaultServiceFormValues,
        category_id: categories[0]?.id ?? 0,
        area_id: areas[0]?.id ?? 0,
      });
    }

    wasOpenRef.current = open;
    previousEntityKeyRef.current = entityKey;
  }, [open, entityKey, service, categories, areas, reset]);

  useLayoutEffect(() => {
    if (!open) return;

    if (getValues('category_id') === 0 && categories[0]) {
      setValue('category_id', categories[0].id, { shouldDirty: false });
    }
    if (getValues('area_id') === 0 && areas[0]) {
      setValue('area_id', areas[0].id, { shouldDirty: false });
    }
  }, [open, categories, areas, getValues, setValue]);

  function requireReason(required: boolean, field: 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason', value: string | null | undefined, missing: string) {
    if (!required) return true;
    const reason = optionalCode(value);
    if (!reason) {
      setError(field, { type: 'manual', message: missing });
      setFocus(field);
      return false;
    }
    if (reason.length < MIN_CHANGE_REASON_LENGTH) {
      const subject = field === 'price_change_reason' ? 'precio' : field === 'tax_change_reason' ? 'impuesto' : 'disponibilidad';
      setError(field, { type: 'manual', message: `El motivo del cambio de ${subject} debe tener al menos 5 caracteres.` });
      setFocus(field);
      return false;
    }
    return true;
  }

  async function submit(data: ServiceFormData) {
    setSubmitError(null);
    if (!requireReason(priceChanged, 'price_change_reason', data.price_change_reason, 'Indique el motivo del cambio de precio.') || !requireReason(taxChanged, 'tax_change_reason', data.tax_change_reason, 'Indique el motivo del cambio de impuesto.') || !requireReason(availabilityChanged, 'availability_change_reason', data.availability_change_reason, 'Indique el motivo del cambio de disponibilidad para caja.')) return;
    const payload = { ...data, price_change_reason: optionalCode(data.price_change_reason), tax_change_reason: optionalCode(data.tax_change_reason), availability_change_reason: optionalCode(data.availability_change_reason), scan_code: optionalCode(data.scan_code), barcode: optionalCode(data.barcode), qr_code: optionalCode(data.qr_code) };
    try {
      await apiClient.saveService(payload, service?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultServiceFormValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        Object.entries(error.validationErrors).forEach(([field, messages]) => setError(field as keyof ServiceFormData, { type: 'server', message: messages[0] }));
      }
      const safeMessage = userSafeErrorMessage(error, 'No se pudo guardar el producto o servicio.');
      setSubmitError(safeMessage.includes('Si estaba cobrando')
        ? 'No se pudo confirmar si el producto o servicio se guardó. Cierre esta ventana y revise el catálogo antes de intentarlo otra vez.'
        : safeMessage);
    }
  }

  const textField = (name: TextFieldName, label: string, required = false) => (
    <AdminField htmlFor={name} label={label} required={required} error={errors[name]?.message}>
      <input id={name} className={INPUT_CLASS} disabled={isSubmitting} {...register(name)} aria-invalid={Boolean(errors[name])} />
    </AdminField>
  );
  const checkboxField = (name: 'taxable' | 'active' | 'visible_in_billing' | 'is_billable', label: string, disabled = false) => (
    <Controller control={control} name={name} render={({ field }) => (
      <div className="flex items-center gap-2">
        <input id={name} type="checkbox" className={CHECKBOX_CLASS} checked={field.value} disabled={disabled || isSubmitting} onChange={(event) => field.onChange(event.target.checked)} />
        <label htmlFor={name} className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">{label}</label>
      </div>
    )} />
  );
  const selectField = (name: 'category_id' | 'area_id', label: string, items: Array<{ id: number; name: string }>) => (
    <Controller control={control} name={name} render={({ field }) => (
      <AdminField htmlFor={name} label={label} required error={errors[name]?.message}>
        <select id={name} className={SELECT_CLASS} value={String(field.value)} disabled={isSubmitting} aria-invalid={Boolean(errors[name])} onChange={(event) => field.onChange(Number(event.target.value))}>
          <option value="0">Seleccione...</option>
          {items.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
        </select>
      </AdminField>
    )} />
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      title={service ? 'Editar producto o servicio' : 'Nuevo producto o servicio'}
      description={service ? 'Modifique los datos y la disponibilidad del concepto.' : 'Agregue un producto o servicio al catálogo.'}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" form="service-form" data-ui-press className={PRIMARY_BUTTON} disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : service ? 'Actualizar' : 'Crear'}</button>
        </>
      )}
    >
      <form id="service-form" className="flex flex-col gap-6" onSubmit={handleSubmit(submit)}>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Información</legend>
          {textField('name', 'Nombre', true)}
          {selectField('category_id', 'Categoría', categories)}
          {selectField('area_id', 'Área', areas)}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Tarifa y reglas</legend>
          {textField('price', 'Precio (L.)', true)}
          {priceChanged ? textField('price_change_reason', 'Motivo del cambio de precio', true) : null}
          {hasEpoRule ? (
            <AdminCallout tone="info" title="Regla institucional de eritropoyetina">
              Solo esta línea queda sin cobro cuando la factura indica receta de diálisis. La gratuidad no decide
              el ISV: el precio y el tratamiento fiscal se administran desde este catálogo.{' '}
              {epoTariffCents !== null && epoTariffCents > 0 ? (
                <>
                  Sin receta se cobra la tarifa vigente del catálogo:{' '}
                  <MoneyText cents={epoTariffCents} className="font-semibold" />.
                </>
              ) : (
                'Sin receta se cobra la tarifa vigente del catálogo, que todavía no está configurada.'
              )}
            </AdminCallout>
          ) : null}
          {checkboxField('taxable', 'Aplica ISV')}
          {taxChanged ? textField('tax_change_reason', 'Motivo del cambio de impuesto', true) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Disponibilidad</legend>
          {checkboxField('active', 'Concepto activo')}
          {checkboxField('visible_in_billing', 'Visible en caja')}
          {checkboxField('is_billable', 'Facturable')}
          {availabilityChanged ? textField('availability_change_reason', 'Motivo del cambio de disponibilidad', true) : null}
        </fieldset>
        {auditedChanges.length ? <ServiceAuditedChangesSummary changes={auditedChanges} /> : null}
        {submitError ? <AdminCallout tone="error" title="Error al guardar">{submitError}</AdminCallout> : null}
      </form>
    </AdminDialog>
  );
}
