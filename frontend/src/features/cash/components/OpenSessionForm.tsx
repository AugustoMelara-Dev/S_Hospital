import { WalletOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Form, Input } from 'antd';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { parseCents } from '@/lib/moneyCents';

const openSessionSchema = z.object({
  opening_amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un número válido')
    .refine((value) => (parseCents(value) ?? 0) >= 0, 'El monto no puede ser negativo'),
});

type OpenSessionFormData = z.infer<typeof openSessionSchema>;

interface OpenSessionFormProps {
  isSubmitting: boolean;
  onSubmit: (data: { opening_amount: string }) => void;
}

export function OpenSessionForm({ isSubmitting, onSubmit }: OpenSessionFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<OpenSessionFormData>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: { opening_amount: '0.00' },
  });
  const registration = register('opening_amount');

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <section className="mx-auto w-full max-w-2xl border border-border bg-background" aria-labelledby="cash-open-title">
      <header className="flex items-start gap-3 border-b border-border p-5">
        <WalletOutlined aria-hidden="true" className="text-xl text-primary" />
        <div>
          <h2 id="cash-open-title" className="text-xl font-semibold">Apertura de caja</h2>
          <p className="text-sm text-muted-foreground">Ingrese el efectivo real disponible al iniciar. Puede ser L.0.00.</p>
        </div>
      </header>
      <Form component="form" layout="vertical" onFinish={handleSubmit(onSubmit)} className="p-5" aria-busy={isSubmitting}>
        <Form.Item label="Monto inicial (L.)" htmlFor="opening_amount" required validateStatus={errors.opening_amount ? 'error' : undefined} help={errors.opening_amount?.message}>
          <Input
            id="opening_amount"
            type="text"
            inputMode="decimal"
            defaultValue="0.00"
            disabled={isSubmitting}
            size="large"
            {...registration}
            ref={(element) => { registration.ref(element?.input ?? null); inputRef.current = element?.input ?? null; }}
          />
        </Form.Item>
        <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="El monto inicial debe registrar el efectivo disponible en la caja al abrir." />
        <Button htmlType="submit" type="primary" size="large" block loading={isSubmitting} disabled={isSubmitting} className="mt-4">
          {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
        </Button>
      </Form>
    </section>
  );
}
