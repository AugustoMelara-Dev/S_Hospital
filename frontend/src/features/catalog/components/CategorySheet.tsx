import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { FieldGroup, FormSection } from '@/components/ui/form-section';
import { cn } from '@/lib/utils';
import { CategorySheetFooter } from './CategorySheetFooter';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

type CategorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: {
    id: number;
    name: string;
    sort_order: number;
    active: boolean;
  } | null;
  onSuccess: () => void;
};

const defaultValues: CategoryFormData = {
  name: '',
  sort_order: 0,
  active: true,
};

export function CategorySheet({ open, onOpenChange, category, onSuccess }: CategorySheetProps) {
  const isEditing = !!category;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          sort_order: category.sort_order,
          active: category.active,
        });
      } else {
        reset(defaultValues);
      }
    }
  }, [open, category, reset]);

  async function onSubmit(data: CategoryFormData) {
    setSubmitError(null);
    try {
      await apiClient.saveCategory(data, category?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        applyCategoryBackendErrors(error.validationErrors, setError);
        focusFirstCategoryError(error.validationErrors, setFocus);
      }

      setSubmitError(userSafeErrorMessage(error, 'Error al guardar la categoría.'));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
      description={isEditing ? 'Modifique los datos de la categoría.' : 'Cree una nueva categoría para organizar servicios.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FormSection
          title="Datos de la categoría"
          description="Nombre, orden de aparición y disponibilidad."
        >
          <FieldGroup columns={2}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                {...register('name')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'category-name-error' : undefined}
                className={cn(errors.name && 'border-destructive')}
              />
              {errors.name && (
                <p id="category-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sort_order">Orden</Label>
              <Input
                id="sort_order"
                type="number"
                min={0}
                step={1}
                {...register('sort_order', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.sort_order)}
                aria-describedby={errors.sort_order ? 'category-sort-error' : undefined}
                className={cn(errors.sort_order && 'border-destructive')}
              />
              {errors.sort_order && (
                <p id="category-sort-error" role="alert" className="text-sm text-destructive">
                  {errors.sort_order.message}
                </p>
              )}
            </div>
          </FieldGroup>

          <div className="flex items-center gap-2">
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
            <Label htmlFor="active" className="cursor-pointer text-sm font-medium">
              Categoría activa
            </Label>
          </div>
        </FormSection>

        {submitError && (
          <Alert variant="destructive" title="Error al guardar">
            {submitError}
          </Alert>
        )}

        <CategorySheetFooter
          cancelLabel="Cancelar"
          isEditing={isEditing}
          isSubmitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
        />
      </form>
    </Sheet>
  );
}

function applyCategoryBackendErrors(
  validationErrors: Record<string, string[]>,
  setError: ReturnType<typeof useForm<CategoryFormData>>['setError'],
) {
  (['name', 'sort_order', 'active'] as const).forEach((field) => {
    const message = validationErrors[field]?.[0];
    if (message) {
      setError(field, { type: 'server', message });
    }
  });
}

function focusFirstCategoryError(
  validationErrors: Record<string, string[]>,
  setFocus: ReturnType<typeof useForm<CategoryFormData>>['setFocus'],
) {
  const firstFocusable = (['name', 'sort_order'] as const).find((field) => validationErrors[field]?.[0]);
  if (firstFocusable) {
    window.setTimeout(() => setFocus(firstFocusable), 0);
  }
}
