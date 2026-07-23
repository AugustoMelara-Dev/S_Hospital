import { useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { ServiceAuditedChangesSummary, auditedServiceChanges, priceValuesDiffer } from './ServiceAuditedChangesSummary';
import { ERYTHROPOIETIN_FIXED_PRICE, MIN_CHANGE_REASON_LENGTH, SPECIAL_RULE_ERYTHROPOIETIN, SPECIAL_RULE_NONE, defaultServiceFormValues, serviceSchema, type ServiceFormData } from './serviceDrawerTypes';

type ServiceDraft = { id: number; category_id: number; area_id?: number | null; name: string; price: string; scan_code?: string | null; barcode?: string | null; qr_code?: string | null; taxable: boolean; active: boolean; visible_in_billing?: boolean | null; is_billable?: boolean | null; special_rule_code?: string | null };
type ServiceDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void; service?: ServiceDraft | null; categories: Array<{ id: number; name: string }>; areas: Array<{ id: number; name: string }>; onSuccess: () => void };
type TextFieldName = keyof Pick<ServiceFormData, 'name' | 'price' | 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason' | 'scan_code' | 'barcode' | 'qr_code'>;
const optionalCode = (value: string | null | undefined) => value?.trim() || null;

export function catalogValuesForSpecialRule(value: string) {
  return value === SPECIAL_RULE_ERYTHROPOIETIN
    ? { price: ERYTHROPOIETIN_FIXED_PRICE, taxable: false }
    : null;
}

export function ServiceDrawer({ open, onOpenChange, service, categories, areas, onSuccess }: ServiceDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  const { control, register, handleSubmit, reset, setError, setFocus, setValue, watch, formState: { errors, isSubmitting } } = useForm<ServiceFormData>({ resolver: zodResolver(serviceSchema), defaultValues: defaultServiceFormValues });
  const values = watch();
  const locksEpo = Boolean(service?.special_rule_code === SPECIAL_RULE_ERYTHROPOIETIN);
  const priceChanged = Boolean(service && priceValuesDiffer(service.price, values.price));
  const taxChanged = Boolean(service && service.taxable !== values.taxable);
  const availabilityChanged = Boolean(service && (service.active !== values.active || (service.visible_in_billing ?? true) !== values.visible_in_billing || (service.is_billable ?? true) !== values.is_billable));
  const auditedChanges = service ? auditedServiceChanges(service, values) : [];

  useLayoutEffect(() => {
    if (!open) return;
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
      special_rule_code: service.special_rule_code,
    } : { ...defaultServiceFormValues, category_id: categories[0]?.id ?? 0, area_id: areas[0]?.id ?? 0 });
  }, [open, service, categories, areas, reset]);

  useLayoutEffect(() => {
    if (!wasOpenRef.current && open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (wasOpenRef.current && !open) {
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open]);

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
    const payload = { ...data, price_change_reason: optionalCode(data.price_change_reason), tax_change_reason: optionalCode(data.tax_change_reason), availability_change_reason: optionalCode(data.availability_change_reason), scan_code: optionalCode(data.scan_code), barcode: optionalCode(data.barcode), qr_code: optionalCode(data.qr_code), special_rule_code: optionalCode(data.special_rule_code) };
    try {
      await apiClient.saveService(payload, service?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultServiceFormValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        Object.entries(error.validationErrors).forEach(([field, messages]) => setError(field as keyof ServiceFormData, { type: 'server', message: messages[0] }));
      }
      setSubmitError(userSafeErrorMessage(error, 'Error al guardar el servicio.'));
    }
  }

  const textField = (name: TextFieldName, label: string, required = false) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={name}>{label}{required ? <span aria-hidden="true"> *</span> : null}</FieldLabel>
      <Input id={name} disabled={isSubmitting || (name === 'price' && locksEpo)} {...register(name)} aria-invalid={Boolean(errors[name])} />
      <FieldError errors={errors[name] ? [errors[name]] : undefined} />
    </Field>
  );
  const checkboxField = (name: 'taxable' | 'active' | 'visible_in_billing' | 'is_billable', label: string, disabled = false) => (
    <Controller control={control} name={name} render={({ field }) => (
      <Field orientation="horizontal">
        <Checkbox id={name} checked={field.value} disabled={disabled || isSubmitting} onCheckedChange={(checked) => field.onChange(checked === true)} />
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
      </Field>
    )} />
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{service ? 'Editar servicio' : 'Nuevo servicio'}</SheetTitle>
          <SheetDescription>{service ? 'Modifique los datos del servicio.' : 'Agregue un nuevo servicio al catálogo.'}</SheetDescription>
        </SheetHeader>
        <form id="service-form" className="flex flex-1 flex-col gap-7 px-4" onSubmit={handleSubmit(submit)}>
          <FieldSet>
            <FieldLegend>Información</FieldLegend>
            <FieldGroup>
              {textField('name', 'Nombre', true)}
              <Controller control={control} name="category_id" render={({ field }) => (
                <Field data-invalid={Boolean(errors.category_id)}>
                  <FieldLabel htmlFor="category_id">Categoría *</FieldLabel>
                  <Select value={String(field.value)} disabled={isSubmitting} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id="category_id" className="w-full" aria-invalid={Boolean(errors.category_id)}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{categories.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                  <FieldError errors={errors.category_id ? [errors.category_id] : undefined} />
                </Field>
              )} />
              <Controller control={control} name="area_id" render={({ field }) => (
                <Field data-invalid={Boolean(errors.area_id)}>
                  <FieldLabel htmlFor="area_id">Área *</FieldLabel>
                  <Select value={String(field.value)} disabled={isSubmitting} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id="area_id" className="w-full" aria-invalid={Boolean(errors.area_id)}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{areas.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                  <FieldError errors={errors.area_id ? [errors.area_id] : undefined} />
                </Field>
              )} />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Tarifa y reglas</FieldLegend>
            <FieldGroup>
              {textField('price', 'Precio (L.)', true)}
              {priceChanged ? textField('price_change_reason', 'Motivo del cambio de precio', true) : null}
              <Controller control={control} name="special_rule_code" render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="special_rule_code">Regla especial</FieldLabel>
                  <Select value={field.value ?? SPECIAL_RULE_NONE} disabled={locksEpo || isSubmitting} onValueChange={(value) => {
                    field.onChange(value === SPECIAL_RULE_NONE ? null : value);
                    const normalized = catalogValuesForSpecialRule(value);
                    if (normalized) {
                      setValue('price', normalized.price, { shouldValidate: true });
                      setValue('taxable', normalized.taxable);
                    }
                  }}>
                    <SelectTrigger id="special_rule_code" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value={SPECIAL_RULE_NONE}>Sin regla</SelectItem><SelectItem value={SPECIAL_RULE_ERYTHROPOIETIN}>Eritropoyetina con receta de diálisis</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
              )} />
              {locksEpo ? <Alert><AlertTitle>Regla institucional bloqueada</AlertTitle><AlertDescription>Eritropoyetina mantiene precio fijo de L 25.00 y no aplica ISV.</AlertDescription></Alert> : null}
              {checkboxField('taxable', 'Aplica ISV', locksEpo)}
              {taxChanged ? textField('tax_change_reason', 'Motivo del cambio de impuesto', true) : null}
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Disponibilidad</FieldLegend>
            <FieldGroup>
              {checkboxField('active', 'Servicio activo')}
              {checkboxField('visible_in_billing', 'Visible en caja')}
              {checkboxField('is_billable', 'Facturable')}
              {availabilityChanged ? textField('availability_change_reason', 'Motivo del cambio de disponibilidad', true) : null}
            </FieldGroup>
          </FieldSet>
          {auditedChanges.length ? <ServiceAuditedChangesSummary changes={auditedChanges} /> : null}
          {submitError ? <Alert variant="destructive"><AlertTitle>Error al guardar</AlertTitle><AlertDescription>{submitError}</AlertDescription></Alert> : null}
        </form>
        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="service-form" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : service ? 'Actualizar' : 'Crear'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
