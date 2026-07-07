import { type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldGroup, FormSection } from '@/components/ui/form-section';
import { cn } from '@/lib/utils';
import { type ServiceFormData } from './serviceSheetTypes';

type ServiceSheetBasicSectionProps = {
  areaId: number;
  areas: Array<{ id: number; name: string }>;
  categoryId: number;
  categories: Array<{ id: number; name: string }>;
  errors: FieldErrors<ServiceFormData>;
  isSubmitting: boolean;
  register: UseFormRegister<ServiceFormData>;
  setValue: UseFormSetValue<ServiceFormData>;
};

export function ServiceSheetBasicSection({
  areaId,
  areas,
  categoryId,
  categories,
  errors,
  isSubmitting,
  register,
  setValue,
}: ServiceSheetBasicSectionProps) {
  return (
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
  );
}
