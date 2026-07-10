import { zodResolver } from '@hookform/resolvers/zod';
import { Check, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, 'La contraseña actual es requerida'),
    password: z
      .string()
      .min(12, 'La nueva contraseña debe tener al menos 12 caracteres')
      .regex(/\p{Ll}/u, 'La nueva contraseña debe incluir minúscula')
      .regex(/\p{Lu}/u, 'La nueva contraseña debe incluir mayúscula')
      .regex(/\d/, 'La nueva contraseña debe incluir número')
      .regex(/[^\p{L}\p{N}]/u, 'La nueva contraseña debe incluir símbolo'),
    password_confirmation: z.string().min(1, 'Confirme la nueva contraseña'),
  })
  .refine((data) => data.password === data.password_confirmation, {
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
    <main className="min-h-[100dvh] overflow-x-hidden bg-operational-bg p-4 text-foreground sm:p-6 lg:flex lg:items-center">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden border border-operational-border bg-operational-surface lg:grid-cols-[minmax(17rem,0.72fr)_minmax(22rem,1fr)]">
        <aside className="border-b border-operational-border bg-sidebar px-5 py-7 text-sidebar-foreground sm:px-8 lg:border-b-0 lg:border-r lg:py-10">
          <span className="flex size-11 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/65">
            Seguridad de cuenta
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">Cambio obligatorio de contraseña</h1>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">
            Complete el cambio antes de operar facturación, caja o reportes.
          </p>

          <section aria-labelledby="password-requirements" className="mt-7 border-l border-sidebar-border pl-4">
            <h2 id="password-requirements" className="text-sm font-semibold">
              Requisitos de contraseña
            </h2>
            <p className="mt-2 text-sm leading-6 text-sidebar-foreground/75">
              Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-sidebar-foreground/75">
              <li className="flex gap-2">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Use una clave individual.
              </li>
              <li className="flex gap-2">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Evite claves compartidas entre turnos.
              </li>
            </ul>
          </section>
        </aside>

        <section className="min-w-0 px-5 py-7 sm:px-8 lg:px-10 lg:py-10" aria-labelledby="password-form-title">
          <header className="mb-7">
            <div className="flex items-center gap-3">
              <LockKeyhole aria-hidden="true" className="size-5 text-primary" />
              <h2 id="password-form-title" className="text-xl font-semibold">Defina su nueva clave</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              La sesión permanecerá restringida hasta completar este formulario.
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {status?.trim() ? (
              <Alert variant="warning" title="Revise la contraseña">
                {status}
              </Alert>
            ) : null}

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

            <Button type="submit" disabled={submitting} className="mt-1 min-h-12 w-full sm:w-auto sm:self-start">
              {submitting ? 'Actualizando credenciales...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  disabled: boolean;
  error?: string;
  registration: UseFormRegisterReturn;
};

function PasswordField({ autoComplete, disabled, error, id, label, registration }: PasswordFieldProps) {
  return (
    <FormField id={id} label={label} error={error} required>
      {({ describedBy, id: fieldId, invalid }) => (
        <div className="relative">
          <KeyRound
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={fieldId}
            type="password"
            autoComplete={autoComplete}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="min-h-11 pl-10"
            {...registration}
          />
        </div>
      )}
    </FormField>
  );
}
