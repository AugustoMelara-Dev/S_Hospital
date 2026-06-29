import { type FormEvent, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Eye, EyeOff, Lock, MonitorCheck, ShieldCheck, User, WifiOff } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '../../components/ui/card';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { InfoPanel } from '../../components/shared';
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
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const statusVariant =
    isLockoutStatus ||
    status.includes('error') ||
    status.includes('No se pudo') ||
    status.includes('incorrecta') ||
    status.includes('inv') ||
    status.includes('credenciales') ||
    status.includes('Demasiados')
      ? 'destructive'
      : 'success';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (countdown > 0) {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  }

  const loginDisabled = submitting || countdown > 0;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-operational-bg p-4 text-foreground sm:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-panel border border-operational-border bg-operational-surface shadow-operational lg:grid-cols-[minmax(0,1.08fr)_27rem]">
        <section className="hidden min-h-[42rem] flex-col justify-between bg-sidebar p-8 text-sidebar-foreground lg:flex">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo institucional"
                className="size-12 shrink-0 rounded-md bg-white object-contain p-1"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 aria-hidden="true" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{hospitalName}</p>
              <p className="text-xs text-sidebar-foreground/70">Sistema hospitalario LAN</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="max-w-md">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
                Operacion local segura
              </p>
              <h2 className="text-4xl font-semibold leading-tight">Acceso institucional para caja y administracion</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/75">
                Facturacion, cobros, reportes y recibos preparados para trabajar dentro de la red del hospital.
              </p>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-start gap-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3">
                <MonitorCheck data-icon="inline-start" aria-hidden="true" className="mt-0.5" />
                <span>
                  <strong className="block">Operable sin internet</strong>
                  <span className="text-sidebar-foreground/72">El flujo principal trabaja en servidor local y clientes LAN.</span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3">
                <ShieldCheck data-icon="inline-start" aria-hidden="true" className="mt-0.5" />
                <span>
                  <strong className="block">Acceso por rol</strong>
                  <span className="text-sidebar-foreground/72">Cada usuario entra solo a los modulos autorizados.</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-xs text-sidebar-foreground/75">
            <WifiOff aria-hidden="true" className="size-4" />
            <span>Preparado para operacion offline/LAN</span>
          </div>
        </section>

        <section className="flex min-h-[calc(100dvh-2rem)] items-center justify-center p-5 sm:min-h-[42rem] sm:p-8 lg:min-h-0">
          <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 text-left">
              <div className="mb-3 flex items-center gap-3 lg:hidden">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{hospitalName}</p>
                  <p className="text-xs text-muted-foreground">Sistema hospitalario LAN</p>
                </div>
              </div>
              <CardDescription className="text-xs font-semibold uppercase tracking-normal text-primary">
                Acceso operativo
              </CardDescription>
              <h1 className="text-3xl font-semibold tracking-normal">{hospitalName}</h1>
              <p className="text-sm text-muted-foreground">
                Inicie sesion con su usuario autorizado para abrir el panel operativo.
              </p>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <InfoPanel
                title="Conexion local"
                description="Use las credenciales asignadas por administracion. No comparta usuarios entre turnos."
                tone="info"
                icon={<CheckCircle2 data-icon aria-hidden="true" />}
                className="mb-5"
              />

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <FormField id="login-input" label="Usuario o correo" required>
                  {({ describedBy, id, invalid }) => (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <User aria-hidden="true" />
                      </span>
                      <Input
                        id={id}
                        value={login}
                        placeholder="ej. cajero_01"
                        autoComplete="username"
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        onChange={(event) => onLoginChange(event.target.value)}
                        className="h-11 pl-10"
                      />
                    </div>
                  )}
                </FormField>

                <FormField id="password-input" label="Contraseña" required>
                  {({ describedBy, id, invalid }) => (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Lock aria-hidden="true" />
                      </span>
                      <Input
                        id={id}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        placeholder="********"
                        autoComplete="current-password"
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        className="h-11 pl-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff data-icon="inline-start" aria-hidden="true" /> : <Eye data-icon="inline-start" aria-hidden="true" />}
                      </Button>
                    </div>
                  )}
                </FormField>

                <Button type="submit" disabled={loginDisabled} className="mt-2 min-h-12 w-full">
                  {submitting ? 'Validando acceso...' : countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar sesión'}
                </Button>
              </form>

              {status ? (
                <div className="mt-5 text-sm">
                  <Alert variant={statusVariant}>{status}</Alert>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
