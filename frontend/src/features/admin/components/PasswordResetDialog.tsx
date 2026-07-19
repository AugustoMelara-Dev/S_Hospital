import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, KeyRound, TriangleAlert } from 'lucide-react';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { AuthUser } from '@/lib/api';
import { isPasswordPolicyCompliant, passwordPolicyHint } from './UserFormDialog';

const resetPasswordSchema = z.object({
  reason: z.string().trim().min(5, 'Motivo debe tener al menos 5 caracteres.').max(500, 'Motivo máximo 500 caracteres.'),
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

export function PasswordResetDialog({ open, onOpenChange, targetUser, globalError, onSubmit }: PasswordResetDialogProps) {
  const { handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', reason: '' },
  });

  useEffect(() => {
    if (open && targetUser) reset({ newPassword: '', reason: '' });
  }, [open, targetUser, reset]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(event) => { if (isSubmitting) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Restablecer clave para {targetUser?.name ?? ''}</DialogTitle>
          <DialogDescription>
            Establezca una clave temporal. El usuario deberá cambiarla en su próximo ingreso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {globalError ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>No se pudo restablecer</AlertTitle>
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            ) : null}

            <Alert>
              <Info />
              <AlertTitle>Clave temporal</AlertTitle>
              <AlertDescription>
                No se muestra ni se guarda la clave en pantalla después de enviarla.
              </AlertDescription>
            </Alert>

            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <Field data-invalid={Boolean(errors.newPassword)}>
                  <FieldLabel htmlFor="new-password">Nueva contraseña temporal *</FieldLabel>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      {...field}
                      id="new-password"
                      type="password"
                      placeholder={passwordPolicyHint()}
                      aria-invalid={Boolean(errors.newPassword)}
                      aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
                      className="pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                  <FieldError id="new-password-error">{errors.newPassword?.message}</FieldError>
                </Field>
              )}
            />

            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Field data-invalid={Boolean(errors.reason)}>
                  <FieldLabel htmlFor="reset-password-reason">Motivo *</FieldLabel>
                  <Textarea
                    {...field}
                    id="reset-password-reason"
                    rows={3}
                    placeholder="Ej. Solicitud del responsable de caja."
                    aria-invalid={Boolean(errors.reason)}
                    aria-describedby={errors.reason ? 'reset-password-reason-error reset-password-reason-help' : 'reset-password-reason-help'}
                    disabled={isSubmitting}
                  />
                  <FieldDescription id="reset-password-reason-help">
                    Quedará registrado en auditoría junto al cambio de credencial.
                  </FieldDescription>
                  <FieldError id="reset-password-reason-error">{errors.reason?.message}</FieldError>
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? 'Restableciendo…' : 'Restablecer clave'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
