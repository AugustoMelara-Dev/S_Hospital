import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, Checkbox, Drawer, Form, Input, InputNumber, Space, Typography } from 'antd';
import { ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';

const categorySchema = z.object({ name: z.string().trim().min(1, 'El nombre es requerido'), sort_order: z.number().int().min(0), active: z.boolean() });
type CategoryFormData = z.infer<typeof categorySchema>;
type CategoryDrawerProps = { open: boolean; onOpenChange: (open: boolean) => void; category?: { id: number; name: string; sort_order: number; active: boolean } | null; onSuccess: () => void };
const defaultValues: CategoryFormData = { name: '', sort_order: 0, active: true };

export function CategoryDrawer({ open, onOpenChange, category, onSuccess }: CategoryDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, reset, setError, setFocus, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema), defaultValues });
  useLayoutEffect(() => { if (open) reset(category ? { name: category.name, sort_order: category.sort_order, active: category.active } : defaultValues); }, [open, category, reset]);
  async function submit(data: CategoryFormData) {
    setSubmitError(null);
    try { await apiClient.saveCategory(data, category?.id); onSuccess(); onOpenChange(false); reset(defaultValues); }
    catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        (['name', 'sort_order', 'active'] as const).forEach((field) => { const message = error.validationErrors?.[field]?.[0]; if (message) setError(field, { type: 'server', message }); });
        if (error.validationErrors.name?.[0]) window.setTimeout(() => setFocus('name'), 0);
      }
      setSubmitError(userSafeErrorMessage(error, 'Error al guardar la categoría.'));
    }
  }
  const nameRegistration = register('name');
  return (
    <Drawer open={open} onClose={() => onOpenChange(false)} title={category ? 'Editar Categoría' : 'Nueva Categoría'} destroyOnHidden footer={<Space><Button onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="primary" htmlType="submit" form="category-form" loading={isSubmitting}>{category ? 'Guardar cambios' : 'Crear categoría'}</Button></Space>}>
      <Typography.Paragraph>{category ? 'Modifique los datos de la categoría.' : 'Cree una nueva categoría para organizar servicios.'}</Typography.Paragraph>
      <Form id="category-form" layout="vertical" onFinish={handleSubmit(submit)}>
        <Typography.Title level={5}>Datos básicos</Typography.Title>
        <Form.Item label="Nombre" htmlFor="name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}><Input id="name" {...nameRegistration} ref={(element) => nameRegistration.ref(element?.input ?? null)} aria-invalid={Boolean(errors.name)} /></Form.Item>
        <Controller control={control} name="sort_order" render={({ field }) => <Form.Item label="Orden" htmlFor="sort_order" validateStatus={errors.sort_order ? 'error' : undefined} help={errors.sort_order?.message}><InputNumber id="sort_order" min={0} precision={0} value={field.value} onChange={(value) => field.onChange(value ?? 0)} /></Form.Item>} />
        <Typography.Title level={5}>Estado</Typography.Title>
        <Controller control={control} name="active" render={({ field }) => <Checkbox id="active" checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>Categoría activa</Checkbox>} />
        {submitError ? <Alert type="error" title="Error al guardar" description={submitError} showIcon /> : null}
      </Form>
    </Drawer>
  );
}
