import { zodResolver } from '@hookform/resolvers/zod';
import { CheckOutlined, KeyOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Button, Input } from 'antd';

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
    <main className="min-h-screen overflow-x-hidden bg-operational-bg p-4 text-foreground sm:p-6 lg:flex lg:items-center">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden border border-operational-border bg-operational-surface lg:grid-cols-2">
        <aside className="border-b border-operational-border bg-sidebar px-5 py-7 text-sidebar-foreground sm:px-8 lg:border-b-0 lg:border-r lg:py-10">
          <span className="flex size-11 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
            <SafetyOutlined aria-hidden="true" className="text-xl" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/65">
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
                <CheckOutlined aria-hidden="true" className="mt-0.5 text-base shrink-0" />
                Use una clave individual.
              </li>
              <li className="flex gap-2">
                <CheckOutlined aria-hidden="true" className="mt-0.5 text-base shrink-0" />
                Evite claves compartidas entre turnos.
              </li>
            </ul>
          </section>
        </aside>

        <section className="min-w-0 px-5 py-7 sm:px-8 lg:px-10 lg:py-10" aria-labelledby="password-form-title">
          <header className="mb-7">
            <div className="flex items-center gap-3">
              <LockOutlined aria-hidden="true" className="text-xl text-primary" />
              <h2 id="password-form-title" className="text-xl font-semibold">Defina su nueva clave</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              La sesión permanecerá restringida hasta completar este formulario.
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {status?.trim() ? (
              <Alert
                type="warning"
                title="Revise la contraseña"
                description={status}
                showIcon
                role="alert"
                className="mb-2"
              />
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

            <Button
              type="primary"
              htmlType="submit"
              disabled={submitting}
              loading={submitting}
              className="mt-1 h-12 w-full sm:w-auto sm:self-start font-semibold"
              size="large"
            >
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <span className="text-destructive" aria-hidden="true">*</span>
      </div>
      <Input.Password
        id={id}
        autoComplete={autoComplete}
        disabled={disabled}
        prefix={<KeyOutlined className="text-muted-foreground mr-1" />}
        size="large"
        className="h-11"
        {...registration}
        ref={(element) => {
          registration.ref(element?.input ?? null);
        }}
      />
      {error ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
