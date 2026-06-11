import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'La contraseña actual es requerida'),
  password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  password_confirmation: z.string().min(1, 'Confirme la nueva contraseña'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Las contraseñas no coinciden',
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
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Cambio obligatorio de contraseña</CardTitle>
          <CardDescription>Actualice su contraseña antes de operar el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {showStatus ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" role="alert">
                {status}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <label htmlFor="current_password" className="text-sm font-semibold text-muted-foreground">
                Contraseña actual
              </label>
              <Input
                id="current_password"
                type="password"
                {...register('current_password')}
                autoComplete="current-password"
                disabled={submitting}
              />
              {errors.current_password && <span className="text-sm text-destructive">{errors.current_password.message}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-muted-foreground">
                Nueva contraseña
              </label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                autoComplete="new-password"
                disabled={submitting}
              />
              {errors.password && <span className="text-sm text-destructive">{errors.password.message}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password_confirmation" className="text-sm font-semibold text-muted-foreground">
                Confirmar nueva contraseña
              </label>
              <Input
                id="password_confirmation"
                type="password"
                {...register('password_confirmation')}
                autoComplete="new-password"
                disabled={submitting}
              />
              {errors.password_confirmation && <span className="text-sm text-destructive">{errors.password_confirmation.message}</span>}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
