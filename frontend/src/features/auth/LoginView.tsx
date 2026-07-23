import { EyeIcon, EyeOffIcon, LockIcon, UserIcon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { InstitutionalIdentity } from '../../design-system/components/InstitutionalIdentity';
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
  const displayStatus = submitting ? 'Validando credenciales' : status;
  const normalizedStatus = displayStatus.toLocaleLowerCase('es-HN');
  const isLockoutStatus = normalizedStatus.includes('demasiados intentos')
    || normalizedStatus.includes('bloqueado temporalmente')
    || normalizedStatus.includes('cuenta bloqueada');
  const isSessionStatus = normalizedStatus.includes('sesión vencida')
    || normalizedStatus.includes('sesión cerrada');

  useEffect(() => {
    if (normalizedStatus.includes('cuenta bloqueada')) setCountdown(15 * 60);
    else if (normalizedStatus.includes('demasiados intentos') || normalizedStatus.includes('bloqueado temporalmente')) setCountdown(60);
  }, [normalizedStatus]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((previous) => previous - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const isError = isLockoutStatus
    || normalizedStatus.includes('error')
    || normalizedStatus.includes('no se pudo')
    || normalizedStatus.includes('incorrecta')
    || normalizedStatus.includes('invál');
  const statusRole = isError || isSessionStatus ? 'alert' : 'status';
  const loginDisabled = submitting || countdown > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (loginDisabled) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    const uppercaseWithoutShift = event.key.length === 1
      && /[A-ZÁÉÍÓÚÜÑ]/.test(event.key)
      && !event.shiftKey;
    setCapsLockActive(event.getModifierState('CapsLock') || uppercaseWithoutShift);
  }

  return (
    <main className="flex min-h-dvh items-center bg-muted/20 p-4 text-foreground sm:p-6">
      <Card data-testid="login-card" className="mx-auto w-full max-w-md py-0 shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <InstitutionalIdentity
            hospitalName={hospitalName}
            location="Tocoa, Colón, Honduras"
            logoUrl={logoUrl}
          />
          <Separator className="my-6" />
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ingrese con su usuario y contraseña.
            </p>
          </header>

          <div className="mt-6">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-disabled={loginDisabled}>
                  <FieldLabel htmlFor="login-input">
                    Usuario o correo <span className="text-destructive">*</span>
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><UserIcon aria-hidden="true" /></InputGroupAddon>
                    <InputGroupInput
                      id="login-input"
                      value={login}
                      placeholder="ej. cajero_01"
                      autoComplete="username"
                      onChange={(event) => onLoginChange(event.target.value)}
                      disabled={loginDisabled}
                    />
                  </InputGroup>
                </Field>
                <Field data-disabled={loginDisabled}>
                  <FieldLabel htmlFor="password-input">
                    Contraseña <span className="text-destructive">*</span>
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><LockIcon aria-hidden="true" /></InputGroupAddon>
                    <InputGroupInput
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="********"
                      autoComplete="current-password"
                      onBlur={() => setCapsLockActive(false)}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      onKeyDown={updateCapsLock}
                      onKeyUp={updateCapsLock}
                      disabled={loginDisabled}
                      aria-describedby={capsLockActive ? 'password-caps-lock' : undefined}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {capsLockActive ? (
                    <p id="password-caps-lock" className="text-sm font-medium text-warning" role="status">
                      Bloq Mayús está activo
                    </p>
                  ) : null}
                </Field>
                <Button type="submit" disabled={loginDisabled} size="lg" className="h-12 w-full font-semibold">
                  {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" role="presentation" /> : null}
                  {submitting
                    ? 'Validando credenciales'
                    : countdown > 0
                      ? `Bloqueado (${countdown}s)`
                      : 'Iniciar sesión'}
                </Button>
              </FieldGroup>
            </form>

            <div className="mt-5 min-h-14 text-sm" aria-live="polite">
              {displayStatus ? (
                <Alert variant={isError ? 'destructive' : 'default'} role={statusRole}>
                  <AlertDescription>{displayStatus}</AlertDescription>
                </Alert>
              ) : null}
            </div>
            <Separator className="mt-6" />
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Use únicamente su cuenta asignada.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
