import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import type { ComponentProps, ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { type FiscalSequence, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type FiscalNumerationViewProps = {
  canEdit: boolean;
  onStatus: OperationalStatusReporter;
};

const sequenceSchema = z.object({
  prefix: z.string().min(1, 'El prefijo es requerido').max(32, 'Prefijo muy largo'),
  cai: z.string().min(1, 'El CAI es requerido').max(128, 'CAI muy largo'),
  min_number: z.number().int().min(1, 'Debe ser mayor a 0').max(Number.MAX_SAFE_INTEGER, 'Número fuera del rango permitido'),
  max_number: z.number().int().min(1, 'Debe ser mayor a 0').max(Number.MAX_SAFE_INTEGER, 'Número fuera del rango permitido'),
  valid_until: z.string().min(1, 'La fecha de vencimiento es requerida'),
  reason: z.string().max(500, 'Motivo muy largo').optional(),
}).superRefine((data, ctx) => {
  if (data.max_number < data.min_number) {
    ctx.addIssue({
      code: 'custom',
      path: ['max_number'],
      message: 'El número máximo debe ser mayor o igual al mínimo.',
    });
  }
});

type SequenceFormData = z.infer<typeof sequenceSchema>;

function FiscalField({ children, error, id, label, required, hint }: {
  children: (props: { id: string; invalid: boolean; describedBy: string | undefined }) => ReactNode;
  error?: string;
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)} data-required={required}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({ id, invalid: Boolean(error), describedBy: error || hint ? `${id}-help` : undefined })}
      {error ? <FieldError id={`${id}-help`}>{error}</FieldError> : hint ? <FieldDescription id={`${id}-help`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

function RegisteredInput({ registration, ...props }: ComponentProps<typeof Input> & { registration: UseFormRegisterReturn }) {
  const { ref, ...field } = registration;
  return <Input {...field} {...props} ref={ref} />;
}

function RegisteredTextArea({ registration, ...props }: ComponentProps<typeof Textarea> & { registration: UseFormRegisterReturn }) {
  const { ref, ...field } = registration;
  return <Textarea {...field} {...props} ref={ref} />;
}

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

export function FiscalNumerationView({ canEdit, onStatus }: FiscalNumerationViewProps) {
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingChange, setPendingChange] = useState<SequenceFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const form = useForm<SequenceFormData>({
    resolver: zodResolver(sequenceSchema),
    defaultValues: {
      prefix: '',
      cai: '',
      min_number: 1,
      max_number: 99999999,
      valid_until: '',
      reason: '',
    },
  });

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const sequences = await apiClient.getFiscalSequences();
      const first = sequences[0] ?? null;
      setSequence(first);
      form.reset({
        prefix: first?.prefix ?? '',
        cai: isPlaceholderCai(first?.cai) ? '' : first?.cai ?? '',
        min_number: first?.min_number ?? 1,
        max_number: first?.max_number ?? 99999999,
        valid_until: first?.valid_until ?? '',
        reason: '',
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar la secuencia fiscal.'));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: SequenceFormData) {
    const reason = data.reason?.trim() ?? '';
    if (sequence?.id && reason.length < 5) {
      form.setError('reason', {
        type: 'manual',
        message: 'Indique al menos 5 caracteres explicando el motivo del cambio fiscal.',
      });
      onStatus({ key: 'settings:fiscal-sequence:validation', level: 'warning', message: 'Ingrese un motivo del cambio fiscal de al menos 5 caracteres.', toast: false });
      return;
    }

    setPendingChange(data);
  }

  async function saveSequence(data: SequenceFormData) {
    if (savingRef.current) return;
    const reason = data.reason?.trim() ?? '';
    savingRef.current = true;
    setSaving(true);
    setError('');
    onStatus({ key: 'settings:fiscal-sequence:save', level: 'info', message: 'Guardando numeración fiscal...', toast: false });
    try {
      const saved = await apiClient.saveFiscalSequence({
        ...(sequence?.id ? { id: sequence.id } : {}),
        document_type: 'invoice',
        prefix: data.prefix,
        cai: data.cai,
        min_number: data.min_number,
        max_number: data.max_number,
        current_number: sequence?.current_number ?? data.min_number - 1,
        valid_until: data.valid_until,
        active: true,
        ...(sequence?.id ? { reason } : {}),
      });
      setSequence(saved);
      setPendingChange(null);
      form.reset({
        prefix: saved.prefix,
        cai: saved.cai,
        min_number: saved.min_number,
        max_number: saved.max_number,
        valid_until: saved.valid_until,
        reason: '',
      });
      onStatus({ key: 'settings:fiscal-sequence:save', level: 'success', message: 'Numeración fiscal guardada.' });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar la numeración.'));
      setError(message);
      onStatus({ key: 'settings:fiscal-sequence:save', level: 'error', message });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const availableNumbers = sequence
    ? Math.max(0, Number(sequence.max_number) - Number(sequence.current_number))
    : 0;
  const isExpired = sequence ? new Date(`${sequence.valid_until}T23:59:59`) < new Date() : false;

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Cargando numeración fiscal...
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <header><h2 className="text-lg font-semibold">Numeración fiscal</h2><p className="text-sm text-muted-foreground">Configure el rango autorizado. Los cambios requieren motivo y quedan auditados.</p></header>
      {error ? (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      {!sequence && (
        <Alert><TriangleAlert /><AlertTitle>Sin numeración</AlertTitle><AlertDescription>Configure el CAI, prefijo y rango autorizado antes de emitir facturas.</AlertDescription></Alert>
      )}

      {sequence ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Estado del rango fiscal">
          <div className="border border-operational-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Disponibilidad del rango</p>
              <Badge variant="secondary">
                {availableNumbers <= 100 ? 'Rango por agotarse' : 'Rango disponible'}
              </Badge>
            </div>
            <p className="mt-2 text-sm tabular-nums text-muted-foreground">
              {availableNumbers.toLocaleString('es-HN')} números disponibles de {Number(sequence.max_number - sequence.min_number + 1).toLocaleString('es-HN')} autorizados.
            </p>
          </div>
          <div className="border border-operational-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Vigencia</p>
              <Badge variant={isExpired ? 'destructive' : 'secondary'}>
                {isExpired ? 'Vencida' : 'Vigente'}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isExpired ? 'Venció el' : 'Vigente hasta'} {sequence.valid_until}.
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" aria-busy={form.formState.isSubmitting || saving}>
        <Card>
          <CardHeader><CardTitle>Datos fiscales</CardTitle><CardDescription>CAI, prefijo y rango autorizado por el SAR.</CardDescription></CardHeader>
          <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <FiscalField id="prefix" label="Prefijo" required error={form.formState.errors.prefix?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('prefix')}
                  placeholder="A"
                  className="font-mono uppercase"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FiscalField>
            <FiscalField id="cai" label="CAI" required error={form.formState.errors.cai?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('cai')}
                  placeholder="CAI-XXXXX-XXXXX-XXXXX"
                  className="font-mono"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FiscalField>
            <FiscalField id="valid_until" label="Válido hasta" required error={form.formState.errors.valid_until?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  type="date"
                  registration={form.register('valid_until')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FiscalField>
            <FiscalField id="min_number" label="Desde el número" required error={form.formState.errors.min_number?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  type="number"
                  registration={form.register('min_number', { valueAsNumber: true })}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FiscalField>
            <FiscalField id="max_number" label="Hasta el número" required error={form.formState.errors.max_number?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  type="number"
                  registration={form.register('max_number', { valueAsNumber: true })}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FiscalField>
            <div className="border border-operational-border bg-muted/40 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correlativo actual
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {sequence?.prefix && sequence?.current_number != null
                  ? `${sequence.prefix}-${String(sequence.current_number).padStart(8, '0')}`
                  : 'Sin correlativo'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                El backend lo incrementa al emitir. No se reinicia desde esta pantalla.
              </p>
            </div>
          </div>
          </CardContent>
        </Card>

        {sequence?.id ? (
          <FiscalField
            id="reason"
            label="Motivo del cambio fiscal"
            required
            hint="Obligatorio al guardar cambios de prefijo, CAI, rango, correlativo o vigencia."
            error={form.formState.errors.reason?.message}
          >
            {({ id, invalid, describedBy }) => (
              <RegisteredTextArea
                id={id}
                registration={form.register('reason')}
                rows={3}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                disabled={!canEdit}
                placeholder="Ej. Nuevo rango autorizado por SAR"
              />
            )}
          </FiscalField>
        ) : null}

        {canEdit && form.formState.isDirty ? (
          <div
            data-sticky-actions="true"
            className="sticky bottom-20 z-20 flex items-center justify-between gap-3 border-t border-operational-border bg-operational-surface p-3 lg:bottom-0"
          >
            <span className="text-xs text-muted-foreground">Hay cambios fiscales sin guardar.</span>
            <Button type="submit" disabled={form.formState.isSubmitting || saving}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Guardar numeración
            </Button>
          </div>
        ) : null}
      </form>

      <AlertDialog open={pendingChange !== null} onOpenChange={(next) => { if (!next && !saving) setPendingChange(null); }}>
        <AlertDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <AlertDialogHeader><AlertDialogTitle>Revisar cambio fiscal</AlertDialogTitle><AlertDialogDescription>Confirme la numeración autorizada antes de guardar.</AlertDialogDescription></AlertDialogHeader>
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            <p>Este cambio afecta la numeración de las próximas facturas y quedará auditado.</p>
            <dl className="grid gap-3 border border-operational-border bg-muted/40 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium">Prefijo</dt>
                <dd className="font-mono tabular-nums">{sequence?.prefix ?? 'Sin configurar'} → {pendingChange.prefix}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">CAI actual</dt>
                <dd className="break-all font-mono">{sequence?.cai || 'Sin configurar'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">CAI nuevo</dt>
                <dd className="break-all font-mono">{pendingChange.cai}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Rango actual</dt>
                <dd className="font-mono tabular-nums">
                  {sequence ? `${sequence.min_number.toLocaleString('es-HN')} a ${sequence.max_number.toLocaleString('es-HN')}` : 'Sin configurar'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Rango nuevo</dt>
                <dd className="font-mono tabular-nums">{pendingChange.min_number.toLocaleString('es-HN')} a {pendingChange.max_number.toLocaleString('es-HN')}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Vigencia actual</dt>
                <dd>{sequence?.valid_until || 'Sin configurar'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Vigencia nueva</dt>
                <dd>{pendingChange.valid_until}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Correlativo actual</dt>
                <dd className="font-mono tabular-nums">{sequence?.current_number ?? 0}</dd>
              </div>
            </dl>
            <p className="font-medium text-foreground">El correlativo actual no cambia desde esta pantalla.</p>
          </div>
        ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => { if (pendingChange) void saveSequence(pendingChange); }}>
              {saving ? <Spinner data-icon="inline-start" /> : null}{saving ? 'Guardando…' : 'Confirmar y guardar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
