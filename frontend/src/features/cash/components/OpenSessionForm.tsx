import { InfoIcon, WalletIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseCents } from '@/lib/moneyCents';

const openSessionSchema = z.object({ opening_amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un número válido').refine((value) => (parseCents(value) ?? 0) >= 0, 'El monto no puede ser negativo') });
type OpenSessionFormData = z.infer<typeof openSessionSchema>;
interface OpenSessionFormProps { isSubmitting: boolean; onSubmit: (data: { opening_amount: string }) => void }

export function OpenSessionForm({ isSubmitting, onSubmit }: OpenSessionFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<OpenSessionFormData>({ resolver: zodResolver(openSessionSchema), defaultValues: { opening_amount: '0.00' } });
  const registration = register('opening_amount');
  useEffect(() => { inputRef.current?.focus(); }, []);
  return <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-labelledby="cash-open-title">
    <header className="flex items-start gap-3 border-b border-border p-5"><WalletIcon aria-hidden="true" className="size-5 text-primary" /><div><h2 id="cash-open-title" className="text-xl font-semibold">Apertura de caja</h2><p className="text-sm text-muted-foreground">Ingrese el efectivo real disponible al iniciar. Puede ser L 0.00.</p></div></header>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5" aria-busy={isSubmitting}>
      <div className="grid gap-2"><Label htmlFor="opening_amount">Monto inicial (L.) *</Label><Input id="opening_amount" type="text" inputMode="decimal" defaultValue="0.00" disabled={isSubmitting} aria-invalid={Boolean(errors.opening_amount)} aria-describedby={errors.opening_amount ? 'opening-amount-error' : undefined} {...registration} ref={(element) => { registration.ref(element); inputRef.current = element; }} />{errors.opening_amount ? <p id="opening-amount-error" role="alert" className="text-sm text-destructive">{errors.opening_amount.message}</p> : null}</div>
      <Alert><InfoIcon aria-hidden="true" /><AlertDescription>El monto inicial debe registrar el efectivo disponible en la caja al abrir.</AlertDescription></Alert>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Abriendo...' : 'Abrir caja'}</Button>
    </form>
  </section>;
}
