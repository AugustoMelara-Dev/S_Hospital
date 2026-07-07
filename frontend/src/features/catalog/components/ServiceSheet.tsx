import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { ServiceSheetBasicSection } from './ServiceSheetBasicSection';
import { ServiceSheetPriceSection } from './ServiceSheetPriceSection';
import { ServiceSheetScannerSection } from './ServiceSheetScannerSection';
import {
  ERYTHROPOIETIN_FIXED_PRICE,
  MIN_CHANGE_REASON_LENGTH,
  SPECIAL_RULE_ERYTHROPOIETIN,
  SPECIAL_RULE_NONE,
  defaultServiceFormValues,
  priceCents,
  serviceSchema,
  type ServiceFormData,
} from './serviceSheetTypes';

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
    defaultValues: defaultServiceFormValues,
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
      ...defaultServiceFormValues,
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
      reset(defaultServiceFormValues);
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
        <ServiceSheetBasicSection
          areaId={areaId}
          areas={areas}
          categoryId={categoryId}
          categories={categories}
          errors={errors}
          isSubmitting={isSubmitting}
          register={register}
          setValue={setValue}
        />

        <ServiceSheetPriceSection
          errors={errors}
          isSubmitting={isSubmitting}
          locksErythropoietinRule={locksErythropoietinRule}
          register={register}
          requiresPriceChangeReason={requiresPriceChangeReason}
        />

        {scannerEnabled && (
          <ServiceSheetScannerSection
            errors={errors}
            isSubmitting={isSubmitting}
            register={register}
          />
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
