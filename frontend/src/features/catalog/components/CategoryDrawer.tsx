import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
});
type CategoryFormData = z.infer<typeof categorySchema>;
type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: { id: number; name: string; sort_order: number; active: boolean } | null;
  onSuccess: () => void;
};
const defaultValues: CategoryFormData = { name: '', sort_order: 0, active: true };

export function CategoryDrawer({ open, onOpenChange, category, onSuccess }: CategoryDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, reset, setError, setFocus, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema), defaultValues });

  useLayoutEffect(() => {
    if (open) reset(category ? { name: category.name, sort_order: category.sort_order, active: category.active } : defaultValues);
  }, [open, category, reset]);

  async function submit(data: CategoryFormData) {
    setSubmitError(null);
    try {
      await apiClient.saveCategory(data, category?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        (['name', 'sort_order', 'active'] as const).forEach((field) => {
          const message = error.validationErrors?.[field]?.[0];
          if (message) setError(field, { type: 'server', message });
        });
        if (error.validationErrors.name?.[0]) window.setTimeout(() => setFocus('name'), 0);
      }
      setSubmitError(userSafeErrorMessage(error, 'Error al guardar la categoría.'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</SheetTitle>
          <SheetDescription>
            {category ? 'Modifique los datos de la categoría.' : 'Cree una nueva categoría para organizar servicios.'}
          </SheetDescription>
        </SheetHeader>
        <form id="category-form" className="flex flex-1 flex-col gap-6 px-4" onSubmit={handleSubmit(submit)}>
          <FieldSet>
            <FieldLegend>Datos básicos</FieldLegend>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="name">Nombre</FieldLabel>
                <Input id="name" {...register('name')} aria-invalid={Boolean(errors.name)} disabled={isSubmitting} />
                <FieldError errors={errors.name ? [errors.name] : undefined} />
              </Field>
              <Controller control={control} name="sort_order" render={({ field }) => (
                <Field data-invalid={Boolean(errors.sort_order)}>
                  <FieldLabel htmlFor="sort_order">Orden</FieldLabel>
                  <Input
                    id="sort_order"
                    type="number"
                    min={0}
                    step={1}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber || 0)}
                    aria-invalid={Boolean(errors.sort_order)}
                    disabled={isSubmitting}
                  />
                  <FieldError errors={errors.sort_order ? [errors.sort_order] : undefined} />
                </Field>
              )} />
            </FieldGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>Estado</FieldLegend>
            <Controller control={control} name="active" render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox id="active" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} disabled={isSubmitting} />
                <FieldLabel htmlFor="active">Categoría activa</FieldLabel>
              </Field>
            )} />
          </FieldSet>
          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>Error al guardar</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : category ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
