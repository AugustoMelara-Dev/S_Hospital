import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { Check, CircleAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, errorMessage, isApiError } from '@/lib/api';
import { landingPath } from '@/auth/AuthProvider';
import { useAuth, useMe } from '@/auth/hooks';
import { BrandMark } from '@/shell/BrandMark';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { toast } from '@/ui/Toast';

/** Password policy (SPEC §5.11). Keep in sync with the API. */
export const PASSWORD_RULES: Array<{ id: string; label: string; test: (v: string) => boolean }> = [
  { id: 'len', label: 'Al menos 12 caracteres', test: (v) => v.length >= 12 },
  { id: 'lower', label: 'Una letra minúscula', test: (v) => /\p{Ll}/u.test(v) },
  { id: 'upper', label: 'Una letra mayúscula', test: (v) => /\p{Lu}/u.test(v) },
  { id: 'digit', label: 'Un número', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'Un símbolo (! # $ %)', test: (v) => /[^\p{L}\d\s]/u.test(v) },
];

export function passwordMeetsPolicy(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v));
}

const schema = z
  .object({
    current_password: z.string().min(1, 'Ingrese su contraseña actual.'),
    new_password: z.string().refine(passwordMeetsPolicy, 'La nueva contraseña no cumple los requisitos.'),
    confirm: z.string().min(1, 'Confirme la nueva contraseña.'),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' })
  .refine((v) => v.new_password !== v.current_password, {
    path: ['new_password'],
    message: 'La nueva contraseña debe ser distinta de la actual.',
  });
type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const me = useMe();
  const { refresh, logout } = useAuth();
  const navigate = useNavigate();
  const forced = me.must_change_password;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', confirm: '' },
  });
  const newPassword = useWatch({ control, name: 'new_password' });
  const confirm = useWatch({ control, name: 'confirm' });

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    setFormError(null);
    try {
      await api.post('/auth/change-password', { current_password, new_password });
      const updated = await refresh();
      toast.success('Contraseña actualizada.');
      navigate(updated ? landingPath(updated) : '/', { replace: true });
    } catch (e) {
      if (isApiError(e) && e.fields.current_password) setError('current_password', { message: e.fields.current_password });
      else if (isApiError(e) && e.fields.new_password) setError('new_password', { message: e.fields.new_password });
      else setFormError(errorMessage(e, 'No se pudo actualizar la contraseña.'));
    }
  });

  const checks = [
    ...PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(newPassword ?? '') })),
    { id: 'match', label: 'Las contraseñas coinciden', ok: Boolean(newPassword) && newPassword === confirm },
  ];

  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-[8vh]">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9" />
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-3">{me.name}</span>
            <span className="text-[12px] text-ink-3">{me.role.name}</span>
          </div>
        </div>
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-2">
          <div className="mb-5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-brand">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <h1 className="text-[20px] leading-tight font-semibold text-ink">{forced ? 'Proteja su cuenta' : 'Cambiar contraseña'}</h1>
            </div>
            <p className="text-[13.5px] text-ink-2">
              {forced
                ? 'Antes de continuar, reemplace la contraseña temporal por una propia.'
                : 'Elija una contraseña que no use en otros sistemas.'}
            </p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                <CircleAlert className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                {formError}
              </div>
            )}
            <Field label="Contraseña actual" error={errors.current_password?.message}>
              <Input type="password" autoComplete="current-password" autoFocus {...register('current_password')} />
            </Field>
            <Field label="Nueva contraseña" error={errors.new_password?.message}>
              <Input type="password" autoComplete="new-password" aria-describedby="pw-policy" {...register('new_password')} />
            </Field>
            <Field label="Confirmar contraseña" error={errors.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...register('confirm')} />
            </Field>

            <ul id="pw-policy" aria-label="Requisitos de la contraseña" className="grid gap-1.5 rounded-[var(--radius-sm)] border border-line bg-surface-2/60 p-3 sm:grid-cols-2">
              {checks.map((c) => (
                <li key={c.id} className={cn('flex items-center gap-2 text-[12.5px] transition-colors duration-[120ms]', c.ok ? 'text-ok' : 'text-ink-3')}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms]',
                      c.ok ? 'border-ok bg-ok text-white dark:text-[#0b1411]' : 'border-line-strong',
                    )}
                  >
                    {c.ok && <Check className="size-2.5" strokeWidth={3.5} />}
                  </span>
                  {c.label}
                  <span className="sr-only">{c.ok ? ': cumplido' : ': pendiente'}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              {forced ? (
                <Button variant="ghost" onClick={() => void logout()}>
                  Salir
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
