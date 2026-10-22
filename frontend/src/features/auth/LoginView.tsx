import { CircleHelpIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { AdminSpinner } from '@/design-system/admin/components';
import { AuthLayout } from '@/design-system/admin/AuthLayout';
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

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/**
 * Superficie de acceso del panel administrativo: identidad compacta y tarjeta
 * centrada con el mismo sistema sans y el acento cobalto del resto del panel.
 * Sin panel editorial ni titular de libro contable.
 */
export function LoginView({
  login,
  logoUrl,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  password,
  status,
  submitting = false,
}: LoginViewProps) {
  const { data: fiscal } = usePublicBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const displayStatus = submitting ? 'Comprobando acceso…' : status;
  const normalizedStatus = displayStatus.toLocaleLowerCase('es-HN');
  const isLockoutStatus =
    normalizedStatus.includes('demasiados intentos') ||
    normalizedStatus.includes('bloqueado temporalmente') ||
    normalizedStatus.includes('cuenta bloqueada');
  const isSessionStatus =
    normalizedStatus.includes('sesión vencida') || normalizedStatus.includes('sesión cerrada');

  useEffect(() => {
    if (normalizedStatus.includes('cuenta bloqueada')) setCountdown(15 * 60);
    else if (
      normalizedStatus.includes('demasiados intentos') ||
      normalizedStatus.includes('bloqueado temporalmente')
    ) {
      setCountdown(60);
    }
  }, [normalizedStatus]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((previous) => previous - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const isError =
    isLockoutStatus ||
    normalizedStatus.includes('error') ||
    normalizedStatus.includes('no se pudo') ||
    normalizedStatus.includes('incorrecta') ||
    normalizedStatus.includes('invál');
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
    const uppercaseWithoutShift =
      event.key.length === 1 && /[A-ZÁÉÍÓÚÜÑ]/.test(event.key) && !event.shiftKey;
    setCapsLockActive(event.getModifierState('CapsLock') || uppercaseWithoutShift);
  }

  return (
    <AuthLayout
      titleId="login-title"
      title="Iniciar sesión"
      description="Use la cuenta asignada para este equipo."
      brandName={hospitalName}
      logoUrl={logoUrl}
      footer={`${hospitalName} · sistema interno`}
      notice={
        displayStatus && !normalizedStatus.includes('listo para iniciar sesión') ? (
          <p
            role={statusRole}
            className={
              isError
                ? 'rounded-[var(--ui-radius-control)] border border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] px-3 py-2 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-danger)]'
                : 'rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-3 py-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]'
            }
          >
            {displayStatus}
          </p>
        ) : null
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} aria-busy={submitting}>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-input"
                className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
              >
                Usuario o correo{' '}
                <span aria-hidden="true" className="text-[color:var(--ui-danger)]">
                  *
                </span>
              </label>
              <div
                data-ui-focus-frame
                className="flex items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]"
              >
                <UserIcon
                  aria-hidden="true"
                  data-icon
                  className="size-4 shrink-0 text-[color:var(--ui-ink-faint)]"
                />
                <input
                  id="login-input"
                  value={login}
                  placeholder="ej. cajero_01"
                  autoComplete="username"
                  onChange={(event) => onLoginChange(event.target.value)}
                  disabled={loginDisabled}
                  className="h-[var(--ui-control-h)] min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-faint)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password-input"
                className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
              >
                Contraseña{' '}
                <span aria-hidden="true" className="text-[color:var(--ui-danger)]">
                  *
                </span>
              </label>
              <div
                data-ui-focus-frame
                className="flex items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]"
              >
                <LockIcon
                  aria-hidden="true"
                  data-icon
                  className="size-4 shrink-0 text-[color:var(--ui-ink-faint)]"
                />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  onBlur={() => setCapsLockActive(false)}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  disabled={loginDisabled}
                  aria-describedby={capsLockActive ? 'password-caps-lock' : undefined}
                  className="h-[var(--ui-control-h)] min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-faint)]"
                />
                <button
                  type="button"
                  data-ui-press
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className={`rounded-[var(--ui-radius)] p-1 text-[color:var(--ui-ink-faint)] hover:text-[color:var(--ui-ink)] ${focusRing}`}
                >
                  {/* Intercambio contextual de iconos: ambos viven en el DOM y se
                      cruzan con opacity/scale/blur (better-ui/icon-transitions.md). */}
                  <span aria-hidden="true" className="relative flex size-4 items-center justify-center">
                    <span
                      data-ui-icon-swap
                      data-active={showPassword ? 'true' : undefined}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <EyeOffIcon data-icon className="size-4" />
                    </span>
                    <span
                      data-ui-icon-swap
                      data-active={showPassword ? undefined : 'true'}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <EyeIcon data-icon className="size-4" />
                    </span>
                  </span>
                </button>
              </div>
              {capsLockActive ? (
                <p
                  id="password-caps-lock"
                  role="status"
                  className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-warn)]"
                >
                  Bloq Mayús está activo
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              data-ui-press
              disabled={loginDisabled}
              className={`inline-flex h-[var(--ui-control-h-operational)] w-full items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] hover:bg-[var(--ui-action-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {submitting ? <AdminSpinner /> : null}
              {submitting
                ? 'Comprobando acceso…'
                : countdown > 0
                  ? `Bloqueado (${countdown}s)`
                  : 'Iniciar sesión'}
            </button>
      </form>
      <div className="mt-5 border-t border-[var(--ui-line)] pt-4">
        <button
          type="button"
          data-ui-press
          aria-expanded={showRecoveryHelp}
          aria-controls="access-recovery-help"
          onClick={() => setShowRecoveryHelp((visible) => !visible)}
          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--ui-radius-control)] px-3 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-action)] hover:bg-[var(--ui-action-subtle)] ${focusRing}`}
        >
          <CircleHelpIcon aria-hidden="true" data-icon className="size-4" />
          ¿Olvidó su contraseña?
        </button>
        {showRecoveryHelp ? (
          <div
            id="access-recovery-help"
            className="mt-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3 text-[length:var(--ui-text-sm)] leading-5 text-[color:var(--ui-ink-soft)]"
          >
            <p>
              Otro administrador puede restablecer su acceso en Administración → Usuarios.
            </p>
            <p className="mt-2">
              Si es el único administrador, abra <strong>Recuperar acceso a S_Hospital</strong> desde
              Inicio de Windows. Windows solicitará autorización del administrador del equipo.
            </p>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
