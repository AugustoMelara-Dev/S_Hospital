import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCallout, AdminDialog, AdminField } from '@/design-system/admin/components';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './catalogUi';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido'),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
  availability_change_reason: z.string().max(500, 'El motivo no puede exceder 500 caracteres').nullable().optional(),
});
type CategoryFormData = z.infer<typeof categorySchema>;
type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: { id: number; name: string; sort_order: number; active: boolean; services_count?: number; active_services_count?: number } | null;
  onSuccess: () => void;
};
const defaultValues: CategoryFormData = { name: '', sort_order: 0, active: true, availability_change_reason: null };

export function CategoryDrawer({ open, onOpenChange, category, onSuccess }: CategoryDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, reset, setError, setFocus, watch, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema), defaultValues });
  const active = watch('active');
  const statusChanged = Boolean(category && category.active !== active);
  const deactivating = Boolean(category?.active && !active);

  useLayoutEffect(() => {
    if (open) reset(category ? { name: category.name, sort_order: category.sort_order, active: category.active, availability_change_reason: null } : defaultValues);
  }, [open, category, reset]);

  async function submit(data: CategoryFormData) {
    setSubmitError(null);
    const reason = data.availability_change_reason?.trim() || null;
    if (statusChanged && (!reason || reason.length < 5)) {
      setError('availability_change_reason', { type: 'manual', message: 'Indique un motivo de al menos 5 caracteres.' });
      setFocus('availability_change_reason');
      return;
    }
    try {
      const payload = {
        name: data.name,
        sort_order: data.sort_order,
        active: data.active,
        ...(statusChanged ? { availability_change_reason: reason } : {}),
      };
      await apiClient.saveCategory(payload, category?.id);
      onSuccess();
      onOpenChange(false);
      reset(defaultValues);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        (['name', 'sort_order', 'active', 'availability_change_reason'] as const).forEach((field) => {
          const message = error.validationErrors?.[field]?.[0];
          if (message) setError(field, { type: 'server', message });
        });
        if (error.validationErrors.name?.[0]) window.setTimeout(() => setFocus('name'), 0);
      }
      const safeMessage = userSafeErrorMessage(error, 'No se pudo guardar la categoría.');
      setSubmitError(safeMessage.includes('Si estaba cobrando')
        ? 'No se pudo confirmar si la categoría se guardó. Cierre esta ventana y revise el catálogo antes de intentarlo otra vez.'
        : safeMessage);
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      description={category ? 'Modifique los datos y confirme cualquier cambio de disponibilidad.' : 'Cree una nueva categoría para organizar productos y servicios.'}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" form="category-form" data-ui-press className={PRIMARY_BUTTON} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : deactivating ? 'Desactivar categoría' : category ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </>
      )}
    >
      <form id="category-form" className="flex flex-col gap-5" onSubmit={handleSubmit(submit)}>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Datos básicos</legend>
          <AdminField htmlFor="name" label="Nombre" required error={errors.name?.message}>
            <input id="name" className={INPUT_CLASS} {...register('name')} aria-invalid={Boolean(errors.name)} disabled={isSubmitting} />
          </AdminField>
          <Controller control={control} name="sort_order" render={({ field }) => (
            <AdminField htmlFor="sort_order" label="Orden" error={errors.sort_order?.message}>
              <input
                id="sort_order"
                type="number"
                min={0}
                step={1}
                className={INPUT_CLASS}
                value={field.value}
                onChange={(event) => field.onChange(event.target.valueAsNumber || 0)}
                aria-invalid={Boolean(errors.sort_order)}
                disabled={isSubmitting}
              />
            </AdminField>
          )} />
        </fieldset>
        {deactivating ? (
          <AdminCallout tone="warn" title="Impacto en caja">
            Al desactivar esta categoría, {category?.active_services_count ?? category?.services_count ?? 0} producto(s) o servicio(s) activo(s) dejarán de estar disponibles para nuevos cobros. Los documentos emitidos no cambian. Confirme con un motivo.
          </AdminCallout>
        ) : null}
        {statusChanged ? (
          <AdminField htmlFor="availability_change_reason" label="Motivo del cambio de disponibilidad" required error={errors.availability_change_reason?.message}>
            <textarea id="availability_change_reason" rows={3} className={INPUT_CLASS} {...register('availability_change_reason')} aria-invalid={Boolean(errors.availability_change_reason)} disabled={isSubmitting} />
          </AdminField>
        ) : null}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Estado</legend>
          <Controller control={control} name="active" render={({ field }) => (
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                disabled={isSubmitting}
              />
              <label htmlFor="active" className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">Categoría activa</label>
            </div>
          )} />
        </fieldset>
        {submitError ? (
          <AdminCallout tone="error" title="Error al guardar">{submitError}</AdminCallout>
        ) : null}
      </form>
    </AdminDialog>
  );
}
