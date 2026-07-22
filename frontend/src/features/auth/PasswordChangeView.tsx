import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, KeyRoundIcon, LockKeyholeIcon, ShieldCheckIcon } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'La contraseña actual es requerida'),
  password: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres')
    .regex(/\p{Ll}/u, 'La nueva contraseña debe incluir minúscula')
    .regex(/\p{Lu}/u, 'La nueva contraseña debe incluir mayúscula')
    .regex(/\d/, 'La nueva contraseña debe incluir número')
    .regex(/[^\p{L}\p{N}]/u, 'La nueva contraseña debe incluir símbolo'),
  password_confirmation: z.string().min(1, 'Confirme la nueva contraseña'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Las contraseñas no coinciden', path: ['password_confirmation'],
});

export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

type PasswordChangeViewProps = { onSubmit: (data: PasswordChangeForm) => Promise<void>; submitting?: boolean; status?: string };

export function PasswordChangeView({ onSubmit, submitting = false, status }: PasswordChangeViewProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  });

  return (
    <main className="flex min-h-dvh items-center overflow-x-hidden bg-muted/30 p-3 text-foreground sm:p-6 lg:p-10">
      <Card className="mx-auto w-full max-w-6xl py-0 shadow-sm">
        <CardContent className="grid min-h-0 p-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <aside className="border-b border-border bg-muted/35 p-5 sm:p-8 lg:min-h-[40rem] lg:border-r lg:border-b-0 lg:p-10">
          <span className="flex size-11 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"><ShieldCheckIcon aria-hidden="true" /></span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-primary">Seguridad de cuenta</p>
          <h1 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-balance">Cambio obligatorio de contraseña</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Complete el cambio antes de operar facturación, caja o reportes.</p>
          <section aria-labelledby="password-requirements" className="mt-10 max-w-lg border-l-2 border-primary pl-4">
            <h2 id="password-requirements" className="text-sm font-semibold">Requisitos de contraseña</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><CheckIcon aria-hidden="true" /> Use una clave individual.</li>
              <li className="flex gap-2"><CheckIcon aria-hidden="true" /> Evite claves compartidas entre turnos.</li>
            </ul>
          </section>
        </aside>

        <section className="flex min-w-0 items-center px-5 py-8 sm:px-10 lg:px-12" aria-labelledby="password-form-title">
          <div className="mx-auto w-full max-w-md">
          <header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Acceso protegido</p>
              <Badge variant="outline" className="gap-1.5 border-primary/25 text-primary"><ShieldCheckIcon aria-hidden="true" />Cuenta segura</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3"><LockKeyholeIcon aria-hidden="true" className="text-primary" /><h2 id="password-form-title" className="text-2xl font-semibold tracking-tight text-foreground">Defina su nueva clave</h2></div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">La sesión permanecerá restringida hasta completar este formulario.</p>
          </header>
          <Separator className="my-7" />
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {status?.trim() ? <Alert><AlertTitle>Revise la contraseña</AlertTitle><AlertDescription>{status}</AlertDescription></Alert> : null}
              <PasswordField id="current_password" label="Contraseña actual" autoComplete="current-password" disabled={submitting} error={errors.current_password?.message} registration={register('current_password')} />
              <PasswordField id="password" label="Nueva contraseña" autoComplete="new-password" disabled={submitting} error={errors.password?.message} registration={register('password')} />
              <PasswordField id="password_confirmation" label="Confirmar nueva contraseña" autoComplete="new-password" disabled={submitting} error={errors.password_confirmation?.message} registration={register('password_confirmation')} />
              <Button type="submit" disabled={submitting} size="lg" className="h-12 w-full font-semibold sm:w-auto sm:self-start">
                {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" role="presentation" /> : null}{submitting ? 'Actualizando credenciales...' : 'Actualizar contraseña'}
              </Button>
            </FieldGroup>
          </form>
          </div>
        </section>
        </CardContent>
      </Card>
    </main>
  );
}

type PasswordFieldProps = { id: string; label: string; autoComplete: 'current-password' | 'new-password'; disabled: boolean; error?: string; registration: UseFormRegisterReturn };

function PasswordField({ autoComplete, disabled, error, id, label, registration }: PasswordFieldProps) {
  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label} <span className="text-destructive" aria-hidden="true">*</span></FieldLabel>
      <InputGroup>
        <InputGroupAddon><KeyRoundIcon aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput id={id} type="password" autoComplete={autoComplete} disabled={disabled} aria-label={label} aria-invalid={Boolean(error)} {...registration} />
      </InputGroup>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
