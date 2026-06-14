import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

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
      setSubmitError(null);
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
        applyBackendErrors(error.validationErrors, setError);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            {...register('name')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'category-name-error' : undefined}
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && <p id="category-name-error" role="alert" className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort_order">Orden</Label>
          <Input
            id="sort_order"
            type="number"
            min={0}
            {...register('sort_order', { valueAsNumber: true })}
          />
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
          <Label htmlFor="active" className="text-sm font-medium cursor-pointer">Categoría activa</Label>
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
