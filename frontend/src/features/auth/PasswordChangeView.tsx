import { type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export type PasswordChangeForm = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

type PasswordChangeViewProps = {
  form: PasswordChangeForm;
  onChange: (form: PasswordChangeForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  status?: string;
};

export function PasswordChangeView({ form, onChange, onSubmit, submitting = false, status }: PasswordChangeViewProps) {
  const showStatus = Boolean(status?.trim());

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Cambio obligatorio de contraseña</CardTitle>
          <CardDescription>Actualice su contraseña antes de operar el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {showStatus ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" role="alert">
                {status}
              </p>
            ) : null}
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Contraseña actual
              <Input
                type="password"
                value={form.current_password}
                autoComplete="current-password"
                disabled={submitting}
                onChange={(event) => onChange({ ...form, current_password: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Nueva contraseña
              <Input
                type="password"
                value={form.password}
                autoComplete="new-password"
                disabled={submitting}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Confirmar nueva contraseña
              <Input
                type="password"
                value={form.password_confirmation}
                autoComplete="new-password"
                disabled={submitting}
                onChange={(event) => onChange({ ...form, password_confirmation: event.target.value })}
              />
            </label>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
