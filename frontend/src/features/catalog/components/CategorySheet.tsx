import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '@/lib/api';
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

  const {
    register,
    handleSubmit,
    reset,
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
    await apiClient.saveCategory(data, category?.id);
    onSuccess();
    onOpenChange(false);
    reset(defaultValues);
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

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox {...register('active')} />
          <span className="text-sm font-medium">Categoría activa</span>
        </label>

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
