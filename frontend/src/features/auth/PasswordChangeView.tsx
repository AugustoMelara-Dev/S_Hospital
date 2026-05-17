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
};

export function PasswordChangeView({ form, onChange, onSubmit }: PasswordChangeViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Cambio obligatorio de contrasena</CardTitle>
          <CardDescription>Actualice su contrasena antes de operar el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Contrasena actual
              <Input
                type="password"
                value={form.current_password}
                onChange={(event) => onChange({ ...form, current_password: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Nueva contrasena
              <Input
                type="password"
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Confirmar nueva contrasena
              <Input
                type="password"
                value={form.password_confirmation}
                onChange={(event) => onChange({ ...form, password_confirmation: event.target.value })}
              />
            </label>
            <Button type="submit">Actualizar contrasena</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
