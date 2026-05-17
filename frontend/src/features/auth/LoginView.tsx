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
};

export function LoginView({
  login,
  onLoginChange,
  onPasswordChange,
  onSubmit,
  password,
  status,
}: LoginViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Hospital Billing OS Offline</CardDescription>
          <CardTitle>Acceso local</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Usuario o email
              <Input value={login} onChange={(event) => onLoginChange(event.target.value)} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Contrasena
              <Input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </label>
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
