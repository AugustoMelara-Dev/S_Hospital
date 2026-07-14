import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Checkbox, Drawer, Form, Input, Select, Space, Typography } from 'antd';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { ServiceAuditedChangesSummary, auditedServiceChanges, priceValuesDiffer } from './ServiceAuditedChangesSummary';
import { ERYTHROPOIETIN_FIXED_PRICE, MIN_CHANGE_REASON_LENGTH, SPECIAL_RULE_ERYTHROPOIETIN, SPECIAL_RULE_NONE, defaultServiceFormValues, serviceSchema, type ServiceFormData } from './serviceDrawerTypes';

type ServiceDraft = { id: number; category_id: number; area_id?: number | null; name: string; price: string; scan_code?: string | null; barcode?: string | null; qr_code?: string | null; taxable: boolean; active: boolean; visible_in_billing?: boolean | null; is_billable?: boolean | null; special_rule_code?: string | null };
type ServiceDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void; service?: ServiceDraft | null; categories: Array<{ id: number; name: string }>; areas: Array<{ id: number; name: string }>; scannerEnabled?: boolean; onSuccess: () => void };
const optionalCode = (value: string | null | undefined) => value?.trim() || null;

export function catalogValuesForSpecialRule(value: string) {
  return value === SPECIAL_RULE_ERYTHROPOIETIN
    ? { price: ERYTHROPOIETIN_FIXED_PRICE, taxable: false }
    : null;
}

export function ServiceDrawer({ open, onOpenChange, service, categories, areas, scannerEnabled = false, onSuccess }: ServiceDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, reset, setError, setFocus, setValue, watch, formState: { errors, isSubmitting } } = useForm<ServiceFormData>({ resolver: zodResolver(serviceSchema), defaultValues: defaultServiceFormValues });
  const values = watch();
  const locksEpo = Boolean(service?.special_rule_code === SPECIAL_RULE_ERYTHROPOIETIN);
  const priceChanged = Boolean(service && priceValuesDiffer(service.price, values.price));
  const taxChanged = Boolean(service && service.taxable !== values.taxable);
  const availabilityChanged = Boolean(service && (service.active !== values.active || (service.visible_in_billing ?? true) !== values.visible_in_billing || (service.is_billable ?? true) !== values.is_billable));
  const auditedChanges = service ? auditedServiceChanges(service, values) : [];
  useLayoutEffect(() => {
    if (!open) return;
    reset(service ? { category_id: service.category_id, area_id: service.area_id ?? 0, name: service.name, price: service.price, price_change_reason: null, tax_change_reason: null, availability_change_reason: null, scan_code: service.scan_code, barcode: service.barcode, qr_code: service.qr_code, taxable: service.taxable, active: service.active, visible_in_billing: service.visible_in_billing ?? true, is_billable: service.is_billable ?? true, special_rule_code: service.special_rule_code } : { ...defaultServiceFormValues, category_id: categories[0]?.id ?? 0, area_id: areas[0]?.id ?? 0 });
  }, [open, service, categories, areas, reset]);
  function requireReason(required: boolean, field: 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason', value: string | null | undefined, missing: string) {
    if (!required) return true;
    const reason = optionalCode(value);
    if (!reason) {
      setError(field, { type: 'manual', message: missing });
      setFocus(field);
      return false;
    }
    if (reason.length < MIN_CHANGE_REASON_LENGTH) {
      const subject = field === 'price_change_reason'
        ? 'precio'
        : field === 'tax_change_reason'
          ? 'impuesto'
          : 'disponibilidad';
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
    try { await apiClient.saveService(payload, service?.id); onSuccess(); onOpenChange(false); reset(defaultServiceFormValues); }
    catch (error) { if (error instanceof ApiError && error.validationErrors) Object.entries(error.validationErrors).forEach(([field, messages]) => setError(field as keyof ServiceFormData, { type: 'server', message: messages[0] })); setSubmitError(userSafeErrorMessage(error, 'Error al guardar el servicio.')); }
  }
  const textField = (
    name: keyof Pick<ServiceFormData, 'name' | 'price' | 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason' | 'scan_code' | 'barcode' | 'qr_code'>,
    label: string,
    required = false,
  ) => {
    const reg = register(name);
    return (
      <Form.Item
        label={label}
        htmlFor={name}
        required={required}
        validateStatus={errors[name] ? 'error' : undefined}
        help={errors[name]?.message}
      >
        <Input
          id={name}
          disabled={isSubmitting || (name === 'price' && locksEpo)}
          {...reg}
          ref={(element) => {
            reg.ref(element?.input ?? null);
          }}
          aria-invalid={Boolean(errors[name])}
        />
      </Form.Item>
    );
  };
  return (
    <Drawer open={open} onClose={() => onOpenChange(false)} title={service ? 'Editar servicio' : 'Nuevo servicio'} size="large" destroyOnHidden footer={<Space><Button onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="primary" htmlType="submit" form="service-form" loading={isSubmitting} disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : service ? 'Actualizar' : 'Crear'}</Button></Space>}>
      <Typography.Paragraph>{service ? 'Modifique los datos del servicio.' : 'Agregue un nuevo servicio al catálogo.'}</Typography.Paragraph>
      <Form id="service-form" layout="vertical" onFinish={handleSubmit(submit)}>
        <Typography.Title level={5}>Información</Typography.Title>
        {textField('name', 'Nombre', true)}
        <Controller control={control} name="category_id" render={({ field }) => <Form.Item label="Categoría" htmlFor="category_id" required validateStatus={errors.category_id ? 'error' : undefined} help={errors.category_id?.message}><Select id="category_id" value={field.value} disabled={isSubmitting} onChange={field.onChange} options={categories.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>} />
        <Controller control={control} name="area_id" render={({ field }) => <Form.Item label="Área" htmlFor="area_id" required validateStatus={errors.area_id ? 'error' : undefined} help={errors.area_id?.message}><Select id="area_id" value={field.value} disabled={isSubmitting} onChange={field.onChange} options={areas.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>} />
        <Typography.Title level={5}>Tarifa y reglas</Typography.Title>
        {textField('price', 'Precio (L.)', true)}
        {priceChanged ? textField('price_change_reason', 'Motivo del cambio de precio', true) : null}
        <Controller control={control} name="special_rule_code" render={({ field }) => <Form.Item label="Regla especial" htmlFor="special_rule_code"><Select id="special_rule_code" value={field.value ?? SPECIAL_RULE_NONE} disabled={locksEpo || isSubmitting} onChange={(value) => { field.onChange(value === SPECIAL_RULE_NONE ? null : value); const normalized = catalogValuesForSpecialRule(value); if (normalized) { setValue('price', normalized.price, { shouldValidate: true }); setValue('taxable', normalized.taxable); } }} options={[{ value: SPECIAL_RULE_NONE, label: 'Sin regla' }, { value: SPECIAL_RULE_ERYTHROPOIETIN, label: 'Eritropoyetina con receta de diálisis' }]} /></Form.Item>} />
        {locksEpo ? <Alert type="info" title="Regla institucional bloqueada" description="Eritropoyetina mantiene precio fijo de L 25.00 y no aplica ISV." showIcon /> : null}
        <Controller control={control} name="taxable" render={({ field }) => <Checkbox id="taxable" checked={field.value} disabled={locksEpo || isSubmitting} onChange={(event) => field.onChange(event.target.checked)}>Aplica ISV</Checkbox>} />
        {taxChanged ? textField('tax_change_reason', 'Motivo del cambio de impuesto', true) : null}
        {scannerEnabled ? <><Typography.Title level={5}>Escáner</Typography.Title>{textField('scan_code', 'Código de escáner')}{textField('barcode', 'Código de barra')}{textField('qr_code', 'Código QR')}</> : null}
        <Typography.Title level={5}>Disponibilidad</Typography.Title>
        <Space orientation="vertical"><Controller control={control} name="active" render={({ field }) => <Checkbox id="active" checked={field.value} disabled={isSubmitting} onChange={(event) => field.onChange(event.target.checked)}>Servicio activo</Checkbox>} /><Controller control={control} name="visible_in_billing" render={({ field }) => <Checkbox id="visible_in_billing" checked={field.value} disabled={isSubmitting} onChange={(event) => field.onChange(event.target.checked)}>Visible en caja</Checkbox>} /><Controller control={control} name="is_billable" render={({ field }) => <Checkbox id="is_billable" checked={field.value} disabled={isSubmitting} onChange={(event) => field.onChange(event.target.checked)}>Facturable</Checkbox>} /></Space>
        {availabilityChanged ? textField('availability_change_reason', 'Motivo del cambio de disponibilidad', true) : null}
        {auditedChanges.length ? <ServiceAuditedChangesSummary changes={auditedChanges} /> : null}
        {submitError ? <Alert type="error" title="Error al guardar" description={submitError} showIcon /> : null}
      </Form>
    </Drawer>
  );
}
