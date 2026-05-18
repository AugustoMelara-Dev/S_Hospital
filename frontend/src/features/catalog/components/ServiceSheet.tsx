import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Sheet } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const serviceSchema = z.object({
  category_id: z.number().min(1, 'Seleccione una categoría'),
  name: z.string().min(1, 'El nombre es requerido'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio debe ser un número válido'),
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
  onSuccess: () => void;
};

const defaultValues: ServiceFormData = {
  category_id: 0,
  name: '',
  price: '0.00',
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  special_rule_code: null,
};

export function ServiceSheet({ open, onOpenChange, service, categories, onSuccess }: ServiceSheetProps) {
  const isEditing = !!service;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues,
  });
  const categoryId = watch('category_id');
  const specialRuleCode = watch('special_rule_code');

  useEffect(() => {
    if (open) {
      if (service) {
        reset({
          category_id: service.category_id,
          name: service.name,
          price: service.price,
          scan_code: service.scan_code,
          barcode: service.barcode,
          qr_code: service.qr_code,
          taxable: service.taxable,
          active: service.active,
          special_rule_code: service.special_rule_code,
        });
      } else {
        reset({ ...defaultValues, category_id: categories[0]?.id || 0 });
      }
    }
  }, [open, service, categories, reset]);

  async function onSubmit(data: ServiceFormData) {
    setSubmitError(null);
    const optionalCode = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };
    const payload = {
      ...data,
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
      setSubmitError(userSafeErrorMessage(error, 'Error al guardar el servicio.'));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar Servicio' : 'Nuevo Servicio'}
      description={isEditing ? 'Modifique los datos del servicio.' : 'Agregue un nuevo servicio al catálogo.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category_id">Categoría *</Label>
          <Select
            value={String(categoryId)}
            onValueChange={(val) => setValue('category_id', Number(val))}
          >
            <SelectTrigger className={cn(errors.category_id && 'border-destructive')}>
              <SelectValue placeholder="Seleccione una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            {...register('name')}
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Precio (L.) *</Label>
          <Input
            id="price"
            type="text"
            inputMode="decimal"
            {...register('price')}
            className={cn(errors.price && 'border-destructive')}
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scan_code">Código de Scanner</Label>
          <Input
            id="scan_code"
            placeholder="LAB-GLU-001"
            {...register('scan_code')}
            className={cn(errors.scan_code && 'border-destructive')}
          />
          {errors.scan_code && <p className="text-sm text-destructive">{errors.scan_code.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcode">Código de Barra</Label>
          <Input
            id="barcode"
            placeholder="Código de barra opcional"
            {...register('barcode')}
            className={cn(errors.barcode && 'border-destructive')}
          />
          {errors.barcode && <p className="text-sm text-destructive">{errors.barcode.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="qr_code">Código QR</Label>
          <Input
            id="qr_code"
            placeholder="Código QR opcional"
            {...register('qr_code')}
            className={cn(errors.qr_code && 'border-destructive')}
          />
          {errors.qr_code && <p className="text-sm text-destructive">{errors.qr_code.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="special_rule_code">Regla Especial</Label>
          <Select value={specialRuleCode ?? 'none'} onValueChange={(val) => setValue('special_rule_code', val === 'none' ? null : val)}>
            <SelectTrigger>
              <SelectValue placeholder="Sin regla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin regla</SelectItem>
              <SelectItem value="ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION">
                Eritropoyetina con receta de diálisis
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox {...register('taxable')} />
            <span className="text-sm font-medium">Aplica ISV</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox {...register('active')} />
            <span className="text-sm font-medium">Servicio activo</span>
          </label>
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
