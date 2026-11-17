import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowUp, CircleAlert, Lock, Wifi } from 'lucide-react';
import { api, errorMessage, isApiError } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Branding } from '@/api/types';
import { landingPath } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/hooks';
import { FullScreenLoader } from '@/auth/guards';
import { BrandMark } from '@/shell/BrandMark';
import { ThemeToggle } from '@/shell/TopBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Spinner } from '@/ui/Spinner';

const schema = z.object({
  login: z.string().trim().min(1, 'Ingrese su usuario o correo.'),
  password: z.string().min(1, 'Ingrese su contraseña.'),
});
type FormValues = z.infer<typeof schema>;

export function useBranding() {
  return useQuery({
    queryKey: qk.branding,
    queryFn: () => api.get<Branding>('/branding', undefined, { skipAuthRedirect: true }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

function BrandPanel() {
  const { data } = useBranding();
  const name = data?.hospital_name ?? 'Sistema de caja hospitalaria';
  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden bg-[#0f5c4d] p-10 text-white lg:flex"
      aria-label="Institución"
    >
      {/* Quiet ledger texture: hairline grid + soft light, no imagery needed offline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at 30% 20%, #000 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.10),transparent_65%)]"
      />
      <div className="relative flex items-center gap-3">
        {data?.has_logo ? (
          <img src="/api/branding/logo" alt="" className="size-10 rounded-[8px] bg-white object-contain p-1 outline outline-1 outline-white/10" />
        ) : (
          <BrandMark className="size-10" inverted />
        )}
        <span className="text-[13px] font-medium tracking-[0.04em] text-white/75 uppercase">Caja y facturación</span>
      </div>
      <div className="relative flex max-w-[460px] flex-col gap-4">
        <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{name}</h2>
        {data?.slogan && <p className="text-[15px] leading-relaxed text-white/75">{data.slogan}</p>}
      </div>
      <div className="relative flex items-center gap-2 text-[12.5px] text-white/65">
        <Wifi className="size-3.5" aria-hidden="true" />
        Red local del hospital · funciona sin internet
      </div>
    </aside>
  );
}

export default function LoginPage() {
  const { me, status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [formError, setFormError] = useState<{ message: string; locked: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { login: '', password: '' } });

  if (status === 'loading') return <FullScreenLoader />;
  if (me) {
    return <Navigate to={me.must_change_password ? '/cambiar-clave' : (from ?? landingPath(me))} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      if (user.must_change_password) navigate('/cambiar-clave', { replace: true });
      else navigate(from && from !== '/login' ? from : landingPath(user), { replace: true });
    } catch (e) {
      if (isApiError(e) && e.status === 423) {
        setFormError({ message: 'Demasiados intentos. Espere 15 minutos.', locked: true });
      } else if (isApiError(e) && (e.status === 401 || e.status === 422 || e.status === 400)) {
        setFormError({ message: e.message || 'Usuario o contraseña incorrectos.', locked: false });
      } else {
        setFormError({ message: errorMessage(e, 'No se pudo iniciar sesión.'), locked: false });
      }
    }
  });

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  const passwordField = register('password');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <BrandPanel />
      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[380px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <BrandMark className="size-9 lg:hidden" />
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.015em]">Iniciar sesión</h1>
            <p className="text-[13.5px] text-ink-2">Use la cuenta que le asignó la administración.</p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
              >
                {formError.locked ? (
                  <Lock className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CircleAlert className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{formError.message}</span>
              </div>
            )}

            <Field label="Usuario o correo" error={errors.login?.message}>
              <Input autoComplete="username" autoFocus autoCapitalize="none" spellCheck={false} {...register('login')} />
            </Field>

            <Field
              label="Contraseña"
              error={errors.password?.message}
              hint={
                capsLock ? (
                  <span className="inline-flex items-center gap-1 font-medium text-warn">
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                    Bloq Mayús está activo
                  </span>
                ) : undefined
              }
            >
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...passwordField}
                onKeyDown={trackCaps}
                onKeyUp={trackCaps}
                onBlur={(e) => {
                  setCapsLock(false);
                  void passwordField.onBlur(e);
                }}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-pressed={showPassword}
                    className="h-7 rounded-[4px] px-2 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                }
                className="pr-[84px]"
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              leftIcon={isSubmitting ? <Spinner /> : undefined}
            >
              {isSubmitting ? 'Comprobando acceso…' : 'Iniciar sesión'}
            </Button>
          </form>
          <p className="text-[12.5px] text-ink-3">¿Olvidó su contraseña? Solicite un restablecimiento a la administración.</p>
        </div>
      </main>
    </div>
  );
}
