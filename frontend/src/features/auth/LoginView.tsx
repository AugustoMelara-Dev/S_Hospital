import { type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

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
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-5">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-2">
          {logoUrl ? (
            <div className="flex justify-center mb-4">
              <img
                src={logoUrl}
                alt="Logo institucional"
                className="max-h-16 object-contain rounded p-1 bg-white border border-border"
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <span className="flex size-12 items-center justify-center rounded-lg bg-secondary text-white font-bold text-lg">
                H
              </span>
            </div>
          )}
          <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Hospital Billing OS</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight">Acceso local</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-input" className="text-sm font-semibold text-muted-foreground">
                Usuario o email
              </label>
              <Input
                id="login-input"
                value={login}
                autoComplete="username"
                onChange={(event) => onLoginChange(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password-input" className="text-sm font-semibold text-muted-foreground">
                Contraseña
              </label>
              <Input
                id="password-input"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
            <Button type="submit">Entrar</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {status}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
