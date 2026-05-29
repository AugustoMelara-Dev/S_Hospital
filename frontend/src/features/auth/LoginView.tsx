import { type FormEvent, useEffect, useState } from 'react';
import { Building2, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { displayHospitalName } from '../../lib/hospital-name';

type LoginViewProps = {
  login: string;
  password: string;
  status: string;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  logoUrl?: string | null;
};

export function LoginView({
  login,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  password,
  status,
  logoUrl,
}: LoginViewProps) {
  const { data: fiscal } = useFiscalSettings();
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hospitalName = displayHospitalName(fiscal?.hospital_name);

  useEffect(() => {
    if (status.includes('Demasiados intentos') || status.includes('bloqueado temporalmente')) {
      setCountdown(60);
    }
  }, [status]);

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
    status.includes('error') ||
    status.includes('No se pudo') ||
    status.includes('incorrecta') ||
    status.includes('inv') ||
    status.includes('credenciales') ||
    status.includes('Demasiados')
      ? 'destructive'
      : 'success';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-lg lg:grid-cols-[minmax(0,1fr)_26rem]">
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
              <p className="text-xs text-sidebar-foreground/70">Acceso en red local</p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="max-w-md">
              <h1 className="text-3xl font-semibold leading-tight">Caja institucional rápida y clara.</h1>
              <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">
                Facturacion, cobros, reportes y recibos institucionales para operar dentro del hospital.
              </p>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3">
                <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                <span>Funciona dentro de la red local.</span>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent p-3">
                <Lock data-icon="inline-start" aria-hidden="true" />
                <span>Sesión protegida para usuarios autorizados.</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-sidebar-foreground/50">Operación local</p>
        </section>

        <section className="flex min-h-screen items-center justify-center p-5 sm:min-h-[42rem] sm:p-8 lg:min-h-0">
          <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 text-left">
              <div className="mb-3 flex items-center gap-3 lg:hidden">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{hospitalName}</p>
                  <p className="text-xs text-muted-foreground">Acceso en red local</p>
                </div>
              </div>
              <CardDescription className="text-xs font-semibold uppercase tracking-normal text-primary">
                Acceso operativo
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tracking-normal">{hospitalName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Inicie sesión con sus credenciales para abrir el panel de caja.
              </p>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <form onSubmit={onSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-input" className="text-sm font-semibold">
                    Usuario o correo
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <User aria-hidden="true" />
                    </span>
                    <Input
                      id="login-input"
                      value={login}
                      placeholder="ej. cajero_01"
                      autoComplete="username"
                      onChange={(event) => onLoginChange(event.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password-input" className="text-sm font-semibold">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Lock aria-hidden="true" />
                    </span>
                    <Input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="********"
                      autoComplete="current-password"
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
                </div>

                <Button type="submit" disabled={countdown > 0} className="mt-2 h-11">
                  {countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar sesión'}
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
