import { CircleCheckIcon, EyeIcon, EyeOffIcon, LockIcon, ServerIcon, ShieldCheckIcon, UserIcon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { usePublicBranding } from '../../hooks/useFiscalSettings';
import { displayHospitalName } from '../../lib/hospital-name';
import { InstitutionalIdentity } from '../../design-system/components/InstitutionalIdentity';

type LoginViewProps = {
  login: string; password: string; status: string;
  onLoginChange: (value: string) => void; onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean; logoUrl?: string | null;
};

export function LoginView({ login, onLoginChange, onPasswordChange, onSubmit, password, status, submitting = false, logoUrl }: LoginViewProps) {
  const { data: fiscal } = usePublicBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const displayStatus = submitting ? 'Validando credenciales' : status;
  const normalizedStatus = displayStatus.toLocaleLowerCase('es-HN');
  const isLockoutStatus = normalizedStatus.includes('demasiados intentos') || normalizedStatus.includes('bloqueado temporalmente') || normalizedStatus.includes('cuenta bloqueada');
  const isSessionStatus = normalizedStatus.includes('sesión vencida') || normalizedStatus.includes('sesión cerrada');

  useEffect(() => {
    if (normalizedStatus.includes('cuenta bloqueada')) setCountdown(15 * 60);
    else if (normalizedStatus.includes('demasiados intentos') || normalizedStatus.includes('bloqueado temporalmente')) setCountdown(60);
  }, [normalizedStatus]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((previous) => previous - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const isError = isLockoutStatus || normalizedStatus.includes('error') || normalizedStatus.includes('no se pudo') || normalizedStatus.includes('incorrecta') || normalizedStatus.includes('invál');
  const statusRole = isError || isSessionStatus ? 'alert' : 'status';
  const loginDisabled = submitting || countdown > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (loginDisabled) { event.preventDefault(); return; }
    onSubmit(event);
  }

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    const uppercaseWithoutShift = event.key.length === 1 && /[A-ZÁÉÍÓÚÜÑ]/.test(event.key) && !event.shiftKey;
    setCapsLockActive(event.getModifierState('CapsLock') || uppercaseWithoutShift);
  }

  return (
    <main className="flex min-h-dvh items-center overflow-x-hidden bg-muted/30 p-3 text-foreground sm:p-6 lg:p-10">
      <Card className="mx-auto w-full max-w-6xl py-0 shadow-sm">
        <CardContent className="grid min-h-0 p-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <aside className="flex min-w-0 flex-col border-b border-border bg-muted/35 p-5 lg:min-h-[40rem] lg:border-r lg:border-b-0 lg:p-10">
            <InstitutionalIdentity hospitalName={hospitalName} location="Tocoa, Colón, Honduras" logoUrl={logoUrl} />
            <div className="hidden max-w-xl flex-1 flex-col justify-center lg:flex">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Acceso institucional</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Caja y facturación, listas para el turno.</h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">Ingrese con una cuenta autorizada para registrar facturas, cobros y recibos desde la red local del hospital.</p>
              <div className="mt-10 grid max-w-lg gap-3">
                <div className="flex items-start gap-3 border-l-2 border-primary pl-4">
                  <ShieldCheckIcon aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                  <div><p className="font-medium">Acceso según su rol</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Cada usuario ve únicamente los módulos autorizados por administración.</p></div>
                </div>
                <div className="flex items-start gap-3 border-l-2 border-border pl-4">
                  <ServerIcon aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div><p className="font-medium">Operación en red local</p><p className="mt-1 text-sm leading-6 text-muted-foreground">El flujo de caja continúa dentro de la infraestructura del hospital.</p></div>
                </div>
              </div>
            </div>
            <p className="mt-4 hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><CircleCheckIcon aria-hidden="true" className="text-primary" />Estación de trabajo institucional</p>
          </aside>

          <section className="flex min-w-0 items-center px-5 py-8 sm:px-10 lg:px-12">
            <div className="mx-auto w-full max-w-md">
              <header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Acceso operativo</p>
                  <Badge variant="outline" className="gap-1.5 border-primary/25 text-primary"><CircleCheckIcon aria-hidden="true" />Red local</Badge>
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">Iniciar sesión</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use las credenciales asignadas para continuar su turno.</p>
              </header>

            <Separator className="my-7" />

            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-disabled={loginDisabled}>
                  <FieldLabel htmlFor="login-input">Usuario o correo <span className="text-destructive">*</span></FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><UserIcon aria-hidden="true" /></InputGroupAddon>
                    <InputGroupInput id="login-input" value={login} placeholder="ej. cajero_01" autoComplete="username" onChange={(event) => onLoginChange(event.target.value)} disabled={loginDisabled} />
                  </InputGroup>
                </Field>
                <Field data-disabled={loginDisabled}>
                  <FieldLabel htmlFor="password-input">Contraseña <span className="text-destructive">*</span></FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><LockIcon aria-hidden="true" /></InputGroupAddon>
                    <InputGroupInput id="password-input" type={showPassword ? 'text' : 'password'} value={password} placeholder="********" autoComplete="current-password" onBlur={() => setCapsLockActive(false)} onChange={(event) => onPasswordChange(event.target.value)} onKeyDown={updateCapsLock} onKeyUp={updateCapsLock} disabled={loginDisabled} aria-describedby={capsLockActive ? 'password-caps-lock' : undefined} />
                    <InputGroupAddon align="inline-end"><InputGroupButton aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</InputGroupButton></InputGroupAddon>
                  </InputGroup>
                  {capsLockActive ? <p id="password-caps-lock" className="text-sm font-medium text-warning" role="status">Bloq Mayús está activo</p> : null}
                </Field>
                <Button type="submit" disabled={loginDisabled} size="lg" className="h-12 w-full font-semibold">
                  {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" role="presentation" /> : null}
                  {submitting ? 'Validando credenciales' : countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar sesión'}
                </Button>
              </FieldGroup>
            </form>

            <div className="mt-5 min-h-14 text-sm" aria-live="polite">
              {displayStatus ? <Alert variant={isError ? 'destructive' : 'default'} role={statusRole}><AlertDescription>{displayStatus}</AlertDescription></Alert> : null}
            </div>
            <Separator className="mt-6" />
            <p className="mt-5 text-xs leading-5 text-muted-foreground">Conexión local · No comparta usuarios entre turnos.</p>
          </div>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
