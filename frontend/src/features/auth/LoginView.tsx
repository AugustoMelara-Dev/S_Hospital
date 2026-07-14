import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import {
  SafetyCertificateOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Input, Button, Alert } from 'antd';
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
  const isSessionStatus = normalizedStatus.includes('sesión vencida') || normalizedStatus.includes('sesión cerrada');

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

  const statusType = isLockoutStatus ||
      normalizedStatus.includes('error') ||
      normalizedStatus.includes('no se pudo') ||
      normalizedStatus.includes('incorrecta') ||
      normalizedStatus.includes('invál') ||
      normalizedStatus.includes('credenciales')
    ? 'error'
    : isSessionStatus ? 'warning' : 'success';

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
    <main className="flex min-h-screen items-center overflow-x-hidden bg-operational-bg p-4 text-foreground sm:p-6">
      <div className="mx-auto flex w-full max-w-lg border border-operational-border bg-operational-surface">
        <section className="flex min-w-0 flex-1 items-center px-5 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 pb-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo institucional"
                  className="size-11 shrink-0 border border-border bg-receipt-paper object-contain p-1"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                  <SafetyCertificateOutlined aria-hidden="true" className="text-xl" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{hospitalName}</p>
                <p className="text-xs text-muted-foreground">Sistema hospitalario local</p>
              </div>
              <span className="ml-auto hidden items-center gap-2 text-xs font-medium text-success sm:flex">
                <span aria-hidden="true" className="size-2 bg-success" />
                Red local segura
              </span>
            </div>

            <header className="border-t border-border pb-7 pt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Acceso operativo</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use las credenciales asignadas para continuar su turno.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-input" className="text-sm font-semibold text-foreground">
                  Usuario o correo <span className="text-destructive">*</span>
                </label>
                <Input
                  id="login-input"
                  value={login}
                  placeholder="ej. cajero_01"
                  autoComplete="username"
                  prefix={<UserOutlined className="text-muted-foreground mr-1" />}
                  onChange={(event) => onLoginChange(event.target.value)}
                  size="large"
                  disabled={loginDisabled}
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password-input" className="text-sm font-semibold text-foreground">
                  Contraseña <span className="text-destructive">*</span>
                </label>
                <Input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="********"
                  autoComplete="current-password"
                  prefix={<LockOutlined className="text-muted-foreground mr-1" />}
                  suffix={
                    <Button
                      type="text"
                      icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="text-muted-foreground p-0 min-h-0 min-w-0"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    />
                  }
                  onBlur={() => setCapsLockActive(false)}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  size="large"
                  disabled={loginDisabled}
                  className="h-11"
                />
                {capsLockActive ? (
                  <p id="password-caps-lock" className="mt-2 text-sm font-medium text-warning" role="status">
                    Bloq Mayús está activo
                  </p>
                ) : null}
              </div>

              <Button
                type="primary"
                htmlType="submit"
                disabled={loginDisabled}
                loading={submitting}
                className="mt-1 h-12 w-full font-semibold"
                size="large"
              >
                {submitting ? 'Validando acceso...' : countdown > 0 ? `Bloqueado (${countdown}s)` : 'Iniciar sesión'}
              </Button>
            </form>

            {status ? (
              <div className="mt-5 text-sm">
                <Alert description={status} type={statusType} showIcon role="alert" />
              </div>
            ) : null}

            <p className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
              Conexión local · No comparta usuarios entre turnos.
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
