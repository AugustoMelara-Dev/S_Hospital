import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyOutlined as KeyRound } from '@ant-design/icons';
import { Alert, Button, Input, Modal } from 'antd';
import { type AuthUser } from '@/lib/api';
import { isPasswordPolicyCompliant, passwordPolicyHint } from './UserFormDialog';

const resetPasswordSchema = z.object({
  reason: z.string().trim().min(5, 'Motivo debe tener al menos 5 caracteres.').max(500, 'Motivo maximo 500 caracteres.'),
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
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', reason: '' },
  });

  useEffect(() => {
    if (open && targetUser) {
      reset({ newPassword: '', reason: '' });
    }
  }, [open, targetUser, reset]);

  return (
    <Modal
      open={open}
      onCancel={() => { if (!isSubmitting) onOpenChange(false); }}
      title={`Restablecer clave para ${targetUser?.name ?? ''}`}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <p>Establezca una nueva clave temporal. El usuario estará obligado a cambiarla en su próximo ingreso.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {globalError && (
          <Alert type="error" showIcon title="No se pudo restablecer" description={globalError} />
        )}

        <Alert
          type="warning"
          showIcon
          title="Clave temporal"
          description="No se muestra ni se guarda la clave en pantalla despues de enviarla. El usuario debera cambiarla en el proximo ingreso."
        />

        <div className="space-y-1">
          <label htmlFor="new-password">Nueva contraseña temporal *</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Controller name="newPassword" control={control} render={({ field: { ref: _ref, ...field } }) => <Input.Password id="new-password" placeholder={passwordPolicyHint()} aria-invalid={Boolean(errors.newPassword)} aria-describedby={errors.newPassword ? 'new-password-error' : undefined} className="min-h-12 pl-10" disabled={isSubmitting} {...field} />} />
          </div>
          {errors.newPassword && (
            <p id="new-password-error" role="alert" className="text-xs text-destructive">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="reset-password-reason">Motivo *</label>
          <Controller name="reason" control={control} render={({ field: { ref: _ref, ...field } }) => <Input.TextArea id="reset-password-reason" rows={3} placeholder="Ej. Solicitud del responsable de caja." aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'reset-password-reason-error reset-password-reason-help' : 'reset-password-reason-help'} disabled={isSubmitting} {...field} />} />
          <p id="reset-password-reason-help" className="text-xs text-muted-foreground">
            Quedara registrado en auditoria junto al cambio de credencial.
          </p>
          {errors.reason && (
            <p id="reset-password-reason-error" role="alert" className="text-xs text-destructive">
              {errors.reason.message}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Restableciendo...' : 'Restablecer clave'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
