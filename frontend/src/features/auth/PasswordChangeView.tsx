import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { InfoPanel } from '../../components/shared';

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
    <main className="flex min-h-[100dvh] items-center justify-center bg-operational-bg p-4 text-foreground sm:p-6">
      <Card className="w-full max-w-2xl overflow-hidden border-operational-border bg-operational-surface shadow-operational">
        <CardHeader className="gap-4 border-b border-operational-border bg-operational-panel/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardDescription className="text-xs font-semibold uppercase tracking-normal text-primary">
                Seguridad de cuenta
              </CardDescription>
              <CardTitle className="text-2xl">Cambio obligatorio de contraseña</CardTitle>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Actualice su contraseña antes de operar facturacion, caja o reportes. Esta pantalla mantiene la sesion en modo restringido hasta completar el cambio.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <InfoPanel
            title="Requisitos de contraseña"
            description="Minimo 12 caracteres, con mayuscula, minuscula, numero y simbolo. Use una clave individual de turno, no una clave compartida."
            tone="warning"
            icon={<LockKeyhole data-icon aria-hidden="true" />}
          />

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
              {submitting ? 'Actualizando credenciales...' : 'Actualizar contraseña'}
            </Button>
          </form>

          <div className="grid gap-3 border-t border-operational-border pt-5 text-sm sm:grid-cols-2">
            <div className="flex gap-2 text-muted-foreground">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>Despues del cambio podra continuar con sus permisos asignados.</span>
            </div>
            <div className="flex gap-2 text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>La administracion puede restablecer el acceso si olvida la clave.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
