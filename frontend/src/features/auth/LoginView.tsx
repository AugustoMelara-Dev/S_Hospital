import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { Building2, Eye, EyeOff, Lock, ShieldCheck, User, WifiOff } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { usePublicBranding } from '../../hooks/useFiscalSettings';
import { displayHospitalName } from '../../lib/hospital-name';

type LoginViewProps = {
  login: string;
  password: string;
  status: string;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  logoUrl?: string | null;
};

export function LoginView({
  login,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  password,
  status,
  submitting = false,
  logoUrl,
}: LoginViewProps) {
  const { data: fiscal } = usePublicBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const normalizedStatus = status.toLocaleLowerCase('es-HN');
  const isLockoutStatus =
    normalizedStatus.includes('demasiados intentos') ||
    normalizedStatus.includes('bloqueado temporalmente') ||
    normalizedStatus.includes('cuenta bloqueada');

  useEffect(() => {
    if (normalizedStatus.includes('cuenta bloqueada')) {
      setCountdown(15 * 60);
    } else if (
      normalizedStatus.includes('demasiados intentos') ||
      normalizedStatus.includes('bloqueado temporalmente')
    ) {
      setCountdown(60);
    }
  }, [normalizedStatus]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const statusVariant =
    isLockoutStatus ||
    normalizedStatus.includes('error') ||
    normalizedStatus.includes('no se pudo') ||
    normalizedStatus.includes('incorrecta') ||
    normalizedStatus.includes('invál') ||
    normalizedStatus.includes('credenciales')
      ? 'destructive'
      : 'success';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (countdown > 0) {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  }

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    const uppercaseWithoutShift = event.key.length === 1 && /[A-ZÁÉÍÓÚÜÑ]/.test(event.key) && !event.shiftKey;
    setCapsLockActive(event.getModifierState('CapsLock') || uppercaseWithoutShift);
  }

  const loginDisabled = submitting || countdown > 0;

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-operational-bg text-foreground">
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-7xl lg:grid-cols-[minmax(20rem,1fr)_minmax(24rem,0.78fr)]">
        <section className="order-1 flex min-w-0 items-center bg-operational-surface px-5 py-8 sm:px-10 lg:order-2 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 border-b border-operational-border pb-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo institucional"
                  className="size-11 shrink-0 rounded-md border border-border bg-white object-contain p-1"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 aria-hidden="true" className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{hospitalName}</p>
                <p className="text-xs text-muted-foreground">Sistema hospitalario local</p>
              </div>
              <span className="ml-auto hidden items-center gap-2 text-xs font-medium text-success sm:flex">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                Operación local
              </span>
            </div>

            <header className="pb-6 pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Acceso operativo</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use las credenciales asignadas para continuar su turno.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <FormField id="login-input" label="Usuario o correo" required>
                {({ describedBy, id, invalid }) => (
                  <div className="relative">
                    <User aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={id}
                      value={login}
                      placeholder="ej. cajero_01"
                      autoComplete="username"
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      onChange={(event) => onLoginChange(event.target.value)}
                      className="min-h-11 pl-10"
                    />
                  </div>
                )}
              </FormField>

              <FormField id="password-input" label="Contraseña" required>
                {({ describedBy, id, invalid }) => (
                  <div>
                    <div className="relative">
                      <Lock aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={id}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        placeholder="********"
                        autoComplete="current-password"
                        aria-describedby={[describedBy, capsLockActive ? 'password-caps-lock' : null].filter(Boolean).join(' ') || undefined}
                        aria-invalid={invalid}
                        onBlur={() => setCapsLockActive(false)}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        onKeyDown={updateCapsLock}
                        onKeyUp={updateCapsLock}
                        className="min-h-11 pl-10 pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-0 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </Button>
                    </div>
                    {capsLockActive ? (
                      <p id="password-caps-lock" className="mt-2 text-sm font-medium text-warning" role="status">
                        Bloq Mayús está activo
                      </p>
                    ) : null}
                  </div>
                )}
              </FormField>

              <Button type="submit" disabled={loginDisabled} className="mt-1 min-h-12 w-full">
                {submitting ? 'Validando acceso...' : countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar sesión'}
              </Button>
            </form>

            {status ? (
              <div className="mt-5 text-sm">
                <Alert variant={statusVariant}>{status}</Alert>
              </div>
            ) : null}

            <p className="mt-6 border-t border-operational-border pt-5 text-xs leading-5 text-muted-foreground">
              Conexión local · No comparta usuarios entre turnos.
            </p>
          </div>
        </section>

        <section className="order-2 flex min-w-0 items-center bg-sidebar px-6 py-10 text-sidebar-foreground sm:px-10 lg:order-1 lg:min-h-[100dvh] lg:px-14">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
              Consola clínica
            </p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Caja y administración en un entorno institucional seguro.
            </h2>
            <div className="mt-8 border-l border-sidebar-border pl-5 text-sm leading-6 text-sidebar-foreground/75">
              <p className="flex items-start gap-3 py-2">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                El acceso por rol muestra solo los módulos autorizados.
              </p>
              <p className="flex items-start gap-3 py-2">
                <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                La operación principal continúa sin internet dentro de la red local.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
