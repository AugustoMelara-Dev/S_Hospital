import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const openSessionSchema = z.object({
  opening_amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un número válido')
    .refine(val => parseFloat(val) >= 0, 'El monto no puede ser negativo'),
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
      opening_amount: '500.00',
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
          <Wallet className="h-5 w-5" />
          Abrir Caja
        </CardTitle>
        <CardDescription>
          Ingrese el monto inicial en efectivo para comenzar la sesión.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opening_amount">Monto Inicial (L.) *</Label>
            <Input
              id="opening_amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              className="text-lg"
              aria-invalid={errors.opening_amount ? 'true' : 'false'}
              aria-describedby={errors.opening_amount ? 'opening-amount-error' : undefined}
              {...openingAmountRegistration}
              ref={(element) => {
                openingAmountRegistration.ref(element);
                openingAmountRef.current = element;
              }}
            />
            {errors.opening_amount && (
              <p id="opening-amount-error" className="text-sm text-destructive" role="alert">{errors.opening_amount.message}</p>
            )}
          </div>

          <Alert variant="default">
            <Info className="h-4 w-4" />
            <p>
              El monto inicial debe registrar el efectivo disponible en la caja al abrir.
            </p>
          </Alert>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Abriendo...' : 'Abrir Caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
