import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { InfoPanel } from '@/components/shared';
import { type AuthUser } from '@/lib/api';
import { isPasswordPolicyCompliant, passwordPolicyHint } from './UserFormDialog';

const resetPasswordSchema = z.object({
  newPassword: z.string().refine(isPasswordPolicyCompliant, 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.'),
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

type PasswordResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: AuthUser | null;
  globalError: string | null;
  onSubmit: (data: ResetPasswordForm) => void | Promise<void>;
};

export function PasswordResetDialog({
  open,
  onOpenChange,
  targetUser,
  globalError,
  onSubmit,
}: PasswordResetDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  });

  useEffect(() => {
    if (open && targetUser) {
      reset({ newPassword: '' });
    }
  }, [open, targetUser, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!isSubmitting) onOpenChange(value);
      }}
      size="md"
      title={`Restablecer clave para ${targetUser?.name ?? ''}`}
      description="Establezca una nueva clave temporal. El usuario estará obligado a cambiarla en su próximo ingreso."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {globalError && (
          <Alert variant="destructive" title="No se pudo restablecer">
            {globalError}
          </Alert>
        )}

        <InfoPanel
          title="Clave temporal"
          description="No se muestra ni se guarda la clave en pantalla despues de enviarla. El usuario debera cambiarla en el proximo ingreso."
          tone="warning"
        />

        <div className="space-y-1">
          <Label htmlFor="new-password">Nueva contraseña temporal *</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              placeholder={passwordPolicyHint()}
              aria-invalid={Boolean(errors.newPassword)}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              className="pl-9"
              {...register('newPassword')}
            />
          </div>
          {errors.newPassword && (
            <p id="new-password-error" role="alert" className="text-xs text-destructive">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Restableciendo...' : 'Restablecer clave'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}