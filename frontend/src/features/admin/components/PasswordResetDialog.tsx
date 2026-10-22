import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';

import { AdminCallout, AdminDialog, AdminField } from '@/design-system/admin/components';
import type { AuthUser } from '@/lib/api';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA_CLASS } from '../adminUi';
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
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}
      className="sm:max-w-2xl"
      title={`Restablecer clave para ${targetUser?.name ?? ''}`}
      description="Establezca una clave temporal. El usuario deberá cambiarla en su próximo ingreso."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        {globalError ? (
          <AdminCallout tone="error" title="No se pudo restablecer">{globalError}</AdminCallout>
        ) : null}

        <AdminCallout tone="info" title="Clave temporal">
          No se muestra ni se guarda la clave en pantalla después de enviarla.
        </AdminCallout>

        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <AdminField htmlFor="new-password" label="Nueva contraseña temporal" required error={errors.newPassword?.message}>
              <div className="relative">
                <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
                <input
                  {...field}
                  id="new-password"
                  type="password"
                  placeholder={passwordPolicyHint()}
                  aria-invalid={Boolean(errors.newPassword)}
                  className={`${INPUT_CLASS} pl-9`}
                  disabled={isSubmitting}
                />
              </div>
            </AdminField>
          )}
        />

        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <AdminField
              htmlFor="reset-password-reason"
              label="Motivo"
              required
              hint="Quedará registrado en auditoría junto al cambio de credencial."
              error={errors.reason?.message}
            >
              <textarea
                {...field}
                id="reset-password-reason"
                rows={3}
                placeholder="Ej. Solicitud del responsable de caja."
                aria-invalid={Boolean(errors.reason)}
                disabled={isSubmitting}
                className={TEXTAREA_CLASS}
              />
            </AdminField>
          )}
        />

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="submit" data-ui-press className={PRIMARY_BUTTON} disabled={isSubmitting}>
            {isSubmitting ? 'Restableciendo…' : 'Restablecer clave'}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
