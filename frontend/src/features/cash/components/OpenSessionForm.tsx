import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { parseCents } from '@/lib/moneyCents';

const openSessionSchema = z.object({
  opening_amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un número válido')
    .refine(val => (parseCents(val) ?? 0) >= 0, 'El monto no puede ser negativo'),
});

type OpenSessionFormData = z.infer<typeof openSessionSchema>;

interface OpenSessionFormProps {
  isSubmitting: boolean;
  onSubmit: (data: { opening_amount: string }) => void;
}

export function OpenSessionForm({ isSubmitting, onSubmit }: OpenSessionFormProps) {
  const openingAmountRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<OpenSessionFormData>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: {
      opening_amount: '0.00',
    },
  });
  const openingAmountRegistration = register('opening_amount');

  useEffect(() => {
    openingAmountRef.current?.focus();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet data-icon aria-hidden="true" />
          Abrir caja
        </CardTitle>
        <CardDescription>
          Ingrese el efectivo real disponible al iniciar. Puede ser L.0.00.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-busy={isSubmitting}>
          <FormField
            id="opening_amount"
            label="Monto inicial (L.)"
            required
            error={errors.opening_amount?.message}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="font-mono text-lg tabular-nums"
                disabled={isSubmitting}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                {...openingAmountRegistration}
                ref={(element) => {
                  openingAmountRegistration.ref(element);
                  openingAmountRef.current = element;
                }}
              />
            )}
          </FormField>

          <Alert variant="default" icon={<Info data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}>
            <p>
              El monto inicial debe registrar el efectivo disponible en la caja al abrir.
            </p>
          </Alert>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
