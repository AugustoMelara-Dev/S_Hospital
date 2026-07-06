import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { FieldGroup, FormSection } from '@/components/ui/form-section';
import { cn } from '@/lib/utils';
import { ServiceSheetFooter } from './ServiceSheetFooter';

const serviceSchema = z.object({
  category_id: z.number().min(1, 'Seleccione una categoria'),
  area_id: z.number().min(1, 'Seleccione un area'),
  name: z.string().trim().min(1, 'El nombre es requerido'),
  price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Precio debe ser un número válido')
    .refine((value) => (priceCents(value) ?? 0) > 0, 'Precio debe ser mayor que cero'),
  price_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  tax_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  availability_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  scan_code: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  qr_code: z.string().nullable().optional(),
  taxable: z.boolean(),
  active: z.boolean(),
  visible_in_billing: z.boolean(),
  is_billable: z.boolean(),
  special_rule_code: z.string().nullable().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

type ServiceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: {
    id: number;
    category_id: number;
    area_id?: number | null;
    name: string;
    price: string;
    scan_code?: string | null;
    barcode?: string | null;
    qr_code?: string | null;
    taxable: boolean;
    active: boolean;
    visible_in_billing?: boolean | null;
    is_billable?: boolean | null;
    special_rule_code?: string | null;
  } | null;
  categories: Array<{ id: number; name: string }>;
  areas: Array<{ id: number; name: string }>;
  scannerEnabled?: boolean;
  onSuccess: () => void;
};

const defaultValues: ServiceFormData = {
  category_id: 0,
  area_id: 0,
  name: '',
  price: '0.00',
  price_change_reason: null,
  tax_change_reason: null,
  availability_change_reason: null,
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
};

const SPECIAL_RULE_NONE = 'none';
const SPECIAL_RULE_ERYTHROPOIETIN = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const ERYTHROPOIETIN_FIXED_PRICE = '25.00';
const MIN_CHANGE_REASON_LENGTH = 5;

export function ServiceSheet({
  open,
  onOpenChange,
  service,
  categories,
  areas,
  scannerEnabled = false,
  onSuccess,
}: ServiceSheetProps) {
  const isEditing = !!service;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues,
  });

  const categoryId = watch('category_id');
  const areaId = watch('area_id');
  const price = watch('price');
  const taxable = watch('taxable');
  const specialRuleCode = watch('special_rule_code');
  const isErythropoietinRule = specialRuleCode === SPECIAL_RULE_ERYTHROPOIETIN;
  const locksErythropoietinRule = Boolean(
    isEditing && service?.special_rule_code === SPECIAL_RULE_ERYTHROPOIETIN,
  );
  const requiresPriceChangeReason = Boolean(isEditing && service && priceValuesDiffer(service.price, price));
  const active = watch('active');
  const visibleInBilling = watch('visible_in_billing');
  const isBillable = watch('is_billable');
  const requiresTaxChangeReason = Boolean(isEditing && service && service.taxable !== taxable);
  const requiresAvailabilityChangeReason = Boolean(
    isEditing
    && service
    && (
      service.active !== active
      || (service.visible_in_billing ?? true) !== visibleInBilling
      || (service.is_billable ?? true) !== isBillable
    ),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (service) {
      reset({
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
      });

      return;
    }

    reset({
      ...defaultValues,
      category_id: categories[0]?.id || 0,
      area_id: areas[0]?.id || 0,
    });
  }, [open, service, categories, areas, reset]);

  async function onSubmit(data: ServiceFormData) {
    setSubmitError(null);
    const optionalCode = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    const priceChangeReason = optionalCode(data.price_change_reason);
    const taxChangeReason = optionalCode(data.tax_change_reason);
    const availabilityChangeReason = optionalCode(data.availability_change_reason);

    if (requiresPriceChangeReason && priceChangeReason === null) {
      setError('price_change_reason', { type: 'manual', message: 'Indique el motivo del cambio de precio.' });
      setFocus('price_change_reason');

      return;
    }

    if (requiresPriceChangeReason && priceChangeReason !== null && priceChangeReason.length < MIN_CHANGE_REASON_LENGTH) {
      setError('price_change_reason', {
        type: 'manual',
        message: 'El motivo del cambio de precio debe tener al menos 5 caracteres.',
      });
      setFocus('price_change_reason');

      return;
    }

    if (requiresTaxChangeReason && taxChangeReason === null) {
      setError('tax_change_reason', { type: 'manual', message: 'Indique el motivo del cambio de impuesto.' });
      setFocus('tax_change_reason');

      return;
    }

    if (requiresTaxChangeReason && taxChangeReason !== null && taxChangeReason.length < MIN_CHANGE_REASON_LENGTH) {
      setError('tax_change_reason', {
        type: 'manual',
        message: 'El motivo del cambio de impuesto debe tener al menos 5 caracteres.',
      });
      setFocus('tax_change_reason');

      return;
    }

    if (requiresAvailabilityChangeReason && availabilityChangeReason === null) {
      setError('availability_change_reason', {
        type: 'manual',
        message: 'Indique el motivo del cambio de disponibilidad para caja.',
      });
      setFocus('availability_change_reason');

      return;
    }

    if (
      requiresAvailabilityChangeReason
      && availabilityChangeReason !== null
      && availabilityChangeReason.length < MIN_CHANGE_REASON_LENGTH
    ) {
      setError('availability_change_reason', {
        type: 'manual',
        message: 'El motivo del cambio de disponibilidad debe tener al menos 5 caracteres.',
      });
      setFocus('availability_change_reason');

      return;
    }

    const payload = {
      ...data,
      price_change_reason: priceChangeReason,
      tax_change_reason: taxChangeReason,
      availability_change_reason: availabilityChangeReason,
      scan_code: optionalCode(data.scan_code),
      barcode: optionalCode(data.barcode),
      qr_code: optionalCode(data.qr_code),
      special_rule_code: optionalCode(data.special_rule_code),
    };

    try {
      await apiClient.saveService(payload, service?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        applyBackendErrors(error.validationErrors, setError);
        focusFirstServiceError(error.validationErrors, setFocus);
      }

      setSubmitError(userSafeErrorMessage(error, 'Error al guardar el servicio.'));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar servicio' : 'Nuevo servicio'}
      description={isEditing ? 'Modifique los datos del servicio.' : 'Agregue un nuevo servicio al catálogo.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FormSection
          title="Datos básicos"
          description="Categoría, área y nombre visible para el cajero."
        >
          <FieldGroup columns={2}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category_id">Categoría *</Label>
              <Select
                value={String(categoryId)}
                onValueChange={(val) => setValue('category_id', Number(val))}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="category_id"
                  aria-invalid={Boolean(errors.category_id)}
                  aria-describedby={errors.category_id ? 'service-category-error' : undefined}
                  className={cn(errors.category_id && 'border-destructive')}
                >
                  <SelectValue placeholder="Seleccione una categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p id="service-category-error" role="alert" className="text-sm text-destructive">
                  {errors.category_id.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="area_id">Área *</Label>
              <Select
                value={String(areaId)}
                onValueChange={(val) => setValue('area_id', Number(val))}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="area_id"
                  aria-invalid={Boolean(errors.area_id)}
                  aria-describedby={errors.area_id ? 'service-area-error' : undefined}
                  className={cn(errors.area_id && 'border-destructive')}
                >
                  <SelectValue placeholder="Seleccione un area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.area_id && (
                <p id="service-area-error" role="alert" className="text-sm text-destructive">
                  {errors.area_id.message}
                </p>
              )}
            </div>
          </FieldGroup>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              disabled={isSubmitting}
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'service-name-error' : undefined}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p id="service-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Precio"
          description="Precio vigente y motivo del cambio. El cambio de precio siempre queda auditado."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Precio (L.) *</Label>
            <Input
              id="price"
              type="text"
              inputMode="decimal"
              disabled={isSubmitting || locksErythropoietinRule}
              {...register('price')}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? 'service-price-error' : undefined}
              className={cn(errors.price && 'border-destructive')}
            />
            {errors.price && (
              <p id="service-price-error" role="alert" className="text-sm text-destructive">
                {errors.price.message}
              </p>
            )}
          </div>

          {requiresPriceChangeReason && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="price_change_reason">Motivo del cambio de precio *</Label>
              <Input
                id="price_change_reason"
                disabled={isSubmitting}
                {...register('price_change_reason')}
                aria-invalid={Boolean(errors.price_change_reason)}
                aria-describedby={
                  errors.price_change_reason ? 'service-price-reason-error' : undefined
                }
                className={cn(errors.price_change_reason && 'border-destructive')}
              />
              {errors.price_change_reason && (
                <p
                  id="service-price-reason-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.price_change_reason.message}
                </p>
              )}
            </div>
          )}
        </FormSection>

        {scannerEnabled && (
          <FormSection
            title="Códigos de escaneo"
            description="Identificadores opcionales que se utilizan al escanear productos en caja."
          >
            <FieldGroup columns={3}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="scan_code">Código de escáner</Label>
                <Input
                  id="scan_code"
                  placeholder="LAB-GLU-001"
                  disabled={isSubmitting}
                  {...register('scan_code')}
                  aria-invalid={Boolean(errors.scan_code)}
                  aria-describedby={errors.scan_code ? 'service-scan-code-error' : undefined}
                  className={cn(errors.scan_code && 'border-destructive')}
                />
                {errors.scan_code && (
                  <p id="service-scan-code-error" role="alert" className="text-sm text-destructive">
                    {errors.scan_code.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="barcode">Código de barra</Label>
                <Input
                  id="barcode"
                  disabled={isSubmitting}
                  placeholder="Código de barra opcional"
                  {...register('barcode')}
                  aria-invalid={Boolean(errors.barcode)}
                  aria-describedby={errors.barcode ? 'service-barcode-error' : undefined}
                  className={cn(errors.barcode && 'border-destructive')}
                />
                {errors.barcode && (
                  <p id="service-barcode-error" role="alert" className="text-sm text-destructive">
                    {errors.barcode.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="qr_code">Código QR</Label>
                <Input
                  id="qr_code"
                  disabled={isSubmitting}
                  placeholder="Código QR opcional"
                  {...register('qr_code')}
                  aria-invalid={Boolean(errors.qr_code)}
                  aria-describedby={errors.qr_code ? 'service-qr-code-error' : undefined}
                  className={cn(errors.qr_code && 'border-destructive')}
                />
                {errors.qr_code && (
                  <p id="service-qr-code-error" role="alert" className="text-sm text-destructive">
                    {errors.qr_code.message}
                  </p>
                )}
              </div>
            </FieldGroup>
          </FormSection>
        )}

        <FormSection
          title="Reglas"
          description="Regla especial e ISV aplicable al servicio."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="special_rule_code">Regla especial</Label>
            <Select
              value={specialRuleCode ?? SPECIAL_RULE_NONE}
              disabled={isSubmitting || locksErythropoietinRule}
              onValueChange={(val) => {
                setValue('special_rule_code', val === SPECIAL_RULE_NONE ? null : val);
                if (val === SPECIAL_RULE_ERYTHROPOIETIN) {
                  setValue('price', ERYTHROPOIETIN_FIXED_PRICE, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue('taxable', false, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
            >
              <SelectTrigger id="special_rule_code">
                <SelectValue placeholder="Sin regla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SPECIAL_RULE_NONE}>Sin regla</SelectItem>
                <SelectItem value={SPECIAL_RULE_ERYTHROPOIETIN}>
                  Eritropoyetina con receta de diálisis
                </SelectItem>
              </SelectContent>
            </Select>
            {isErythropoietinRule ? (
              <p className="text-xs leading-5 text-muted-foreground">
                La eritropoyetina mantiene precio fijo de L.25.00, sin ISV. El descuento por receta de dialisis se aplica al facturar.
              </p>
            ) : null}
          </div>

          <FieldGroup columns={2}>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="taxable"
                render={({ field }) => (
                  <Checkbox
                    id="taxable"
                    checked={field.value}
                    disabled={isSubmitting || locksErythropoietinRule}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="taxable" className="cursor-pointer text-sm font-medium">
                Aplica ISV
              </Label>
            </div>

            {requiresTaxChangeReason && (
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="tax_change_reason">Motivo del cambio de impuesto *</Label>
                <Input
                  id="tax_change_reason"
                  disabled={isSubmitting}
                  {...register('tax_change_reason')}
                  aria-invalid={Boolean(errors.tax_change_reason)}
                  aria-describedby={
                    errors.tax_change_reason ? 'service-tax-reason-error' : undefined
                  }
                  className={cn(errors.tax_change_reason && 'border-destructive')}
                />
                {errors.tax_change_reason && (
                  <p
                    id="service-tax-reason-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.tax_change_reason.message}
                  </p>
                )}
              </div>
            )}
          </FieldGroup>
        </FormSection>

        <FormSection
          title="Estado"
          description="Disponibilidad del servicio para caja y facturacion."
        >
          <FieldGroup columns={2}>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Checkbox
                    id="active"
                    checked={field.value}
                    disabled={isSubmitting}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="active" className="cursor-pointer text-sm font-medium">
                Servicio activo
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="visible_in_billing"
                render={({ field }) => (
                  <Checkbox
                    id="visible_in_billing"
                    checked={field.value}
                    disabled={isSubmitting}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="visible_in_billing" className="cursor-pointer text-sm font-medium">
                Visible en caja
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="is_billable"
                render={({ field }) => (
                  <Checkbox
                    id="is_billable"
                    checked={field.value}
                    disabled={isSubmitting}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="is_billable" className="cursor-pointer text-sm font-medium">
                Facturable
              </Label>
            </div>

            {requiresAvailabilityChangeReason && (
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="availability_change_reason">
                  Motivo del cambio de disponibilidad *
                </Label>
                <Input
                  id="availability_change_reason"
                  disabled={isSubmitting}
                  {...register('availability_change_reason')}
                  aria-invalid={Boolean(errors.availability_change_reason)}
                  aria-describedby={
                    errors.availability_change_reason ? 'service-availability-reason-error' : undefined
                  }
                  className={cn(errors.availability_change_reason && 'border-destructive')}
                />
                {errors.availability_change_reason && (
                  <p
                    id="service-availability-reason-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.availability_change_reason.message}
                  </p>
                )}
              </div>
            )}
          </FieldGroup>
        </FormSection>

        {submitError && (
          <Alert variant="destructive" title="Error al guardar">
            {submitError}
          </Alert>
        )}

        <ServiceSheetFooter
          cancelLabel="Cancelar"
          isEditing={isEditing}
          isSubmitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
        />
      </form>
    </Sheet>
  );
}

function applyBackendErrors(
  validationErrors: Record<string, string[]>,
  setError: ReturnType<typeof useForm<ServiceFormData>>['setError'],
) {
  (
    [
      'category_id',
      'area_id',
      'name',
      'price',
      'price_change_reason',
      'tax_change_reason',
      'availability_change_reason',
      'scan_code',
      'barcode',
      'qr_code',
    ] as const
  ).forEach((field) => {
    const message = validationErrors[field]?.[0];
    if (message) {
      setError(field, { type: 'server', message });
    }
  });
}

function focusFirstServiceError(
  validationErrors: Record<string, string[]>,
  setFocus: ReturnType<typeof useForm<ServiceFormData>>['setFocus'],
) {
  const firstFocusable = (
    [
      'name',
      'price',
      'price_change_reason',
      'tax_change_reason',
      'availability_change_reason',
      'scan_code',
      'barcode',
      'qr_code',
    ] as const
  ).find((field) => validationErrors[field]?.[0]);
  if (firstFocusable) {
    window.setTimeout(() => setFocus(firstFocusable), 0);
  }
}

function priceValuesDiffer(current: string, next: string): boolean {
  const currentCents = priceCents(current);
  const nextCents = priceCents(next);

  return currentCents !== null && nextCents !== null && currentCents !== nextCents;
}

function priceCents(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
