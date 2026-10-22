import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRoundIcon } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { AdminCallout, AdminField, AdminSpinner } from '@/design-system/admin/components';
import { AuthLayout } from '@/design-system/admin/AuthLayout';
import { usePublicBranding } from '../../hooks/useFiscalSettings';
import { displayHospitalName } from '../../lib/hospital-name';

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'La contraseña actual es requerida'),
  password: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres')
    .regex(/\p{Ll}/u, 'La nueva contraseña debe incluir minúscula')
    .regex(/\p{Lu}/u, 'La nueva contraseña debe incluir mayúscula')
    .regex(/\d/, 'La nueva contraseña debe incluir número')
    .regex(/[^\p{L}\p{N}]/u, 'La nueva contraseña debe incluir símbolo'),
  password_confirmation: z.string().min(1, 'Confirme la nueva contraseña'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Las contraseñas no coinciden', path: ['password_confirmation'],
});

export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

type PasswordChangeViewProps = { onSubmit: (data: PasswordChangeForm) => Promise<void>; submitting?: boolean; status?: string };

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

// Acción primaria de la pantalla: un único acento de acción (--ui-action).
const PRIMARY_BUTTON =
  `inline-flex h-[var(--ui-control-h-operational)] w-full items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] hover:bg-[var(--ui-action-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/**
 * Cambio obligatorio de contraseña con la misma composición del acceso,
 * campos con etiqueta asociada, error textual y una única acción primaria.
 */
export function PasswordChangeView({ onSubmit, submitting = false, status }: PasswordChangeViewProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  });
  const { data: fiscal } = usePublicBranding();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);

  return (
    <AuthLayout
      titleId="password-form-title"
      title="Proteja su cuenta"
      description="Antes de continuar, cree una contraseña que sólo usted conozca."
      brandName={hospitalName}
      footer="Este cambio es necesario para continuar."
      notice={
        status?.trim() ? (
          <AdminCallout tone="warn" title="Revise la contraseña">
            {status}
          </AdminCallout>
        ) : null
      }
      details={
        <details>
          <summary className="cursor-pointer text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
            Qué debe incluir la contraseña
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            <li>Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.</li>
            <li>Use una clave individual; evite claves compartidas entre turnos.</li>
          </ul>
        </details>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} aria-busy={submitting}>
        <PasswordField
          id="current_password"
          label="Contraseña actual"
          autoComplete="current-password"
          disabled={submitting}
          error={errors.current_password?.message}
          registration={register('current_password')}
        />
        <PasswordField
          id="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          disabled={submitting}
          error={errors.password?.message}
          registration={register('password')}
        />
        <PasswordField
          id="password_confirmation"
          label="Confirmar nueva contraseña"
          autoComplete="new-password"
          disabled={submitting}
          error={errors.password_confirmation?.message}
          registration={register('password_confirmation')}
        />
        <button
          type="submit"
          data-ui-press
          disabled={submitting}
          className={PRIMARY_BUTTON}
        >
          {submitting ? <AdminSpinner /> : null}
          {submitting ? 'Actualizando credenciales…' : 'Actualizar contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
}

type PasswordFieldProps = { id: string; label: string; autoComplete: 'current-password' | 'new-password'; disabled: boolean; error?: string; registration: UseFormRegisterReturn };

function PasswordField({ autoComplete, disabled, error, id, label, registration }: PasswordFieldProps) {
  return (
    <AdminField label={label} htmlFor={id} required error={error}>
      <div
        data-ui-focus-frame
        className={`flex items-center gap-2 rounded-[var(--ui-radius-control)] border bg-[var(--ui-surface)] px-2.5 ${
          error ? 'border-[var(--ui-danger)]' : 'border-[var(--ui-control-border)]'
        } focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]`}
      >
        <KeyRoundIcon
          aria-hidden="true"
          data-icon
          className="size-4 shrink-0 text-[color:var(--ui-ink-soft)]"
        />
        <input
          id={id}
          type="password"
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="h-[var(--ui-control-h)] min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          {...registration}
        />
      </div>
    </AdminField>
  );
}
