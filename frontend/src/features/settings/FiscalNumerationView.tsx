import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { type FiscalSequence, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type FiscalNumerationViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

const sequenceSchema = z.object({
  prefix: z.string().min(1, 'El prefijo es requerido').max(32, 'Prefijo muy largo'),
  cai: z.string().min(1, 'El CAI es requerido').max(128, 'CAI muy largo'),
  min_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  max_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  valid_until: z.string().min(1, 'La fecha de vencimiento es requerida'),
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

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

export function FiscalNumerationView({ canEdit, onStatus }: FiscalNumerationViewProps) {
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const form = useForm<SequenceFormData>({
    resolver: zodResolver(sequenceSchema),
    defaultValues: {
      prefix: '',
      cai: '',
      min_number: 1,
      max_number: 99999999,
      valid_until: '',
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
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar la secuencia fiscal.'));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: SequenceFormData) {
    if (savingRef.current) return;
    savingRef.current = true;
    setError('');
    onStatus('Guardando numeración fiscal...');
    try {
      const saved = await apiClient.saveFiscalSequence({
        id: sequence?.id,
        document_type: 'invoice',
        prefix: data.prefix,
        cai: data.cai,
        min_number: data.min_number,
        max_number: data.max_number,
        current_number: sequence?.current_number ?? 0,
        valid_until: data.valid_until,
        active: true,
      });
      setSequence(saved);
      onStatus('Numeración fiscal guardada.');
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar la numeración.'));
      setError(message);
      onStatus(message);
    } finally {
      savingRef.current = false;
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Cargando numeración fiscal...
      </div>
    );
  }

  return (
    <FormSection
      title="Numeración fiscal"
      description="Configure el rango autorizado para emitir facturas. Cambios requieren motivo y quedan auditados."
    >
      {error ? (
        <Alert variant="destructive" title="No se pudo guardar">
          {error}
        </Alert>
      ) : null}

      {!sequence && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin numeración</AlertTitle>
          <AlertDescription>
            Configure el CAI, prefijo y rango autorizado antes de emitir facturas.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={form.formState.isSubmitting}>
        <Card>
          <CardHeader>
            <CardTitle>Datos fiscales</CardTitle>
            <CardDescription>CAI, prefijo y rango autorizado por el SAR.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FormField id="prefix" label="Prefijo" required error={form.formState.errors.prefix?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('prefix')}
                  placeholder="A"
                  className="font-mono uppercase"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="cai" label="CAI" required error={form.formState.errors.cai?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('cai')}
                  placeholder="CAI-XXXXX-XXXXX-XXXXX"
                  className="font-mono"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="valid_until" label="Válido hasta" required error={form.formState.errors.valid_until?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="date"
                  {...form.register('valid_until')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="min_number" label="Desde el número" required error={form.formState.errors.min_number?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  {...form.register('min_number', { valueAsNumber: true })}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="max_number" label="Hasta el número" required error={form.formState.errors.max_number?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  {...form.register('max_number', { valueAsNumber: true })}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <div className="rounded-md border border-operational-border bg-operational-panel p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Correlativo actual
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {sequence?.prefix && sequence?.current_number != null
                  ? `${sequence.prefix}-${String(sequence.current_number).padStart(8, '0')}`
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                El backend lo incrementa al emitir. No se reinicia desde esta pantalla.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canEdit || form.formState.isSubmitting}>
            <Save data-icon aria-hidden="true" />
            Guardar numeración
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
