import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowUp, CircleAlert, Lock } from 'lucide-react';
import { errorMessage, isApiError } from '@/lib/api';
import { landingPath } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/hooks';
import { FullScreenLoader } from '@/auth/guards';
import { useBranding } from '@/shell/useBranding';
import { BrandTile } from '@/ui/BrandTile';
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

function BrandPanel() {
  const { data } = useBranding();
  const name = data?.hospital_name || 'Caja hospitalaria';
  return (
    <aside className="relative hidden flex-col justify-between bg-rail px-12 py-10 text-rail-ink lg:flex" aria-label="Institución">
      <div className="flex items-center gap-3">
        <BrandTile size={40} />
        <span className="text-[18px] leading-6 font-bold tracking-[-0.01em]">S_Hospital</span>
      </div>
      <div className="flex max-w-[440px] flex-col gap-6">
        <BrandTile size={96} />
        <div className="flex flex-col gap-3">
          <h2 className="text-[36px] leading-[42px] font-bold tracking-[-0.02em] text-balance">{name}</h2>
          {data?.slogan && <p className="text-[15px] leading-6 text-rail-muted">{data.slogan}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-rail-line pt-4 text-[13px] text-rail-muted">
        <span>Caja hospitalaria · red local</span>
        {data?.has_logo && (
          <img src="/api/branding/logo" alt="" className="h-9 w-auto rounded-[2px] bg-rail-ink object-contain p-1" />
        )}
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
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(440px,5fr)_7fr]">
      <BrandPanel />
      <main className="relative flex items-center justify-center bg-surface px-6 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <BrandTile size={32} />
              <span className="text-[16px] leading-5 font-bold">S_Hospital</span>
            </div>
            <h1 className="text-[28px] leading-8 font-bold tracking-[-0.02em]">Iniciar sesión</h1>
            <p className="text-[14px] leading-5 text-ink-2">Use la cuenta que le asignó la administración.</p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger"
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
              <Input className="min-h-10" autoComplete="username" autoFocus autoCapitalize="none" spellCheck={false} {...register('login')} />
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
                    className="h-7 rounded-[3px] px-2 text-[13px] font-semibold text-slate hover:bg-slate-soft"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                }
                className="min-h-10 pr-[84px]"
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
          <p className="border-t border-junta pt-4 text-[13px] text-ink-2">¿Olvidó su contraseña? Solicite un restablecimiento a la administración.</p>
        </div>
      </main>
    </div>
  );
}
