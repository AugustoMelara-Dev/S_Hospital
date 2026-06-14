import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Sheet } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const serviceSchema = z.object({
  category_id: z.number().min(1, 'Seleccione una categoria'),
  area_id: z.number().min(1, 'Seleccione un area'),
  name: z.string().min(1, 'El nombre es requerido'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio debe ser un numero valido'),
  price_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  scan_code: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  qr_code: z.string().nullable().optional(),
  taxable: z.boolean(),
  active: z.boolean(),
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
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  special_rule_code: null,
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
    defaultValues,
  });

  const categoryId = watch('category_id');
  const areaId = watch('area_id');
  const price = watch('price');
  const specialRuleCode = watch('special_rule_code');
  const requiresPriceChangeReason = Boolean(isEditing && service && priceValuesDiffer(service.price, price));

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
        scan_code: service.scan_code,
        barcode: service.barcode,
        qr_code: service.qr_code,
        taxable: service.taxable,
        active: service.active,
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

    if (requiresPriceChangeReason && optionalCode(data.price_change_reason) === null) {
      setError('price_change_reason', { type: 'manual', message: 'Indique el motivo del cambio de precio.' });
      setFocus('price_change_reason');

      return;
    }

    const payload = {
      ...data,
      price_change_reason: optionalCode(data.price_change_reason),
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category_id">Categoría *</Label>
          <Select
            value={String(categoryId)}
            onValueChange={(val) => setValue('category_id', Number(val))}
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

        <div className="space-y-2">
          <Label htmlFor="area_id">Área *</Label>
          <Select
            value={String(areaId)}
            onValueChange={(val) => setValue('area_id', Number(val))}
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

        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
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

        <div className="space-y-2">
          <Label htmlFor="price">Precio (L.) *</Label>
          <Input
            id="price"
            type="text"
            inputMode="decimal"
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
          <div className="space-y-2">
            <Label htmlFor="price_change_reason">Motivo del cambio de precio *</Label>
            <Input
              id="price_change_reason"
              {...register('price_change_reason')}
              aria-invalid={Boolean(errors.price_change_reason)}
              aria-describedby={errors.price_change_reason ? 'service-price-reason-error' : undefined}
              className={cn(errors.price_change_reason && 'border-destructive')}
            />
            {errors.price_change_reason && (
              <p id="service-price-reason-error" role="alert" className="text-sm text-destructive">
                {errors.price_change_reason.message}
              </p>
            )}
          </div>
        )}

        {scannerEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="scan_code">Código de escáner</Label>
              <Input
                id="scan_code"
                placeholder="LAB-GLU-001"
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

            <div className="space-y-2">
              <Label htmlFor="barcode">Código de barra</Label>
              <Input
                id="barcode"
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

            <div className="space-y-2">
              <Label htmlFor="qr_code">Código QR</Label>
              <Input
                id="qr_code"
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
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="special_rule_code">Regla especial</Label>
          <Select value={specialRuleCode ?? 'none'} onValueChange={(val) => setValue('special_rule_code', val === 'none' ? null : val)}>
            <SelectTrigger id="special_rule_code">
              <SelectValue placeholder="Sin regla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin regla</SelectItem>
              <SelectItem value="ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION">
                Eritropoyetina con receta de dialisis
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer">
            <Controller
              control={control}
              name="taxable"
              render={({ field }) => (
                <Checkbox
                  id="taxable"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="taxable" className="text-sm font-medium cursor-pointer">Aplica ISV</Label>
          </div>

          <div className="flex items-center gap-2 cursor-pointer">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Checkbox
                  id="active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="active" className="text-sm font-medium cursor-pointer">Servicio activo</Label>
          </div>
        </div>

        {submitError && (
          <Alert variant="destructive" title="Error al guardar">
            {submitError}
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function applyBackendErrors(
  validationErrors: Record<string, string[]>,
  setError: ReturnType<typeof useForm<ServiceFormData>>['setError'],
) {
  (['category_id', 'area_id', 'name', 'price', 'price_change_reason', 'scan_code', 'barcode', 'qr_code'] as const).forEach((field) => {
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
  const firstFocusable = (['name', 'price', 'price_change_reason', 'scan_code', 'barcode', 'qr_code'] as const).find((field) => validationErrors[field]?.[0]);
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
