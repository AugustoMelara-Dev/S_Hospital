import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'La contrasena actual es requerida'),
  password: z.string()
    .min(12, 'La nueva contrasena debe tener al menos 12 caracteres')
    .regex(/\p{Ll}/u, 'La nueva contrasena debe incluir minuscula')
    .regex(/\p{Lu}/u, 'La nueva contrasena debe incluir mayuscula')
    .regex(/\d/, 'La nueva contrasena debe incluir numero')
    .regex(/[^\p{L}\p{N}]/u, 'La nueva contrasena debe incluir simbolo'),
  password_confirmation: z.string().min(1, 'Confirme la nueva contrasena'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Las contrasenas no coinciden',
  path: ['password_confirmation'],
});

export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

type PasswordChangeViewProps = {
  onSubmit: (data: PasswordChangeForm) => Promise<void>;
  submitting?: boolean;
  status?: string;
};

export function PasswordChangeView({ onSubmit, submitting = false, status }: PasswordChangeViewProps) {
  const showStatus = Boolean(status?.trim());

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      current_password: '',
      password: '',
      password_confirmation: '',
    },
  });

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
      <Card className="w-full max-w-xl">
        <CardHeader className="gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <CardDescription className="text-xs font-semibold uppercase tracking-normal text-primary">
              Seguridad de cuenta
            </CardDescription>
            <CardTitle>Cambio obligatorio de contraseña</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Actualice su contraseña antes de operar facturación, caja o reportes.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {showStatus ? (
              <Alert variant="warning" title="Revise la contraseña">
                {status}
              </Alert>
            ) : null}

            <FormField
              id="current_password"
              label="Contraseña actual"
              error={errors.current_password?.message}
              required
            >
              {({ describedBy, id, invalid }) => (
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    disabled={submitting}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="pl-10"
                    {...register('current_password')}
                  />
                </div>
              )}
            </FormField>

            <FormField
              id="password"
              label="Nueva contraseña"
              hint="Use al menos 12 caracteres, con mayúscula, minúscula, número y símbolo."
              error={errors.password?.message}
              required
            >
              {({ describedBy, id, invalid }) => (
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    disabled={submitting}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="pl-10"
                    {...register('password')}
                  />
                </div>
              )}
            </FormField>

            <FormField
              id="password_confirmation"
              label="Confirmar nueva contraseña"
              error={errors.password_confirmation?.message}
              required
            >
              {({ describedBy, id, invalid }) => (
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    disabled={submitting}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="pl-10"
                    {...register('password_confirmation')}
                  />
                </div>
              )}
            </FormField>

            <Button type="submit" disabled={submitting} className="min-h-11">
              {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
