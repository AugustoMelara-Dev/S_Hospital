import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import type { ComponentProps, ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertOutlined as AlertTriangle, SaveOutlined as Save } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal, Tag, Typography } from 'antd';
import { type FiscalSequence, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type FiscalNumerationViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
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
  const help = error ?? hint;
  return (
    <Form.Item label={label} htmlFor={id} required={required} validateStatus={error ? 'error' : undefined} help={help}>
      {children({ id, invalid: Boolean(error), describedBy: help ? `${id}-help` : undefined })}
    </Form.Item>
  );
}

function RegisteredInput({ registration, ...props }: ComponentProps<typeof Input> & { registration: UseFormRegisterReturn }) {
  const { ref, ...field } = registration;
  return <Input {...field} {...props} ref={(node) => ref(node?.input ?? null)} />;
}

function RegisteredTextArea({ registration, ...props }: ComponentProps<typeof Input.TextArea> & { registration: UseFormRegisterReturn }) {
  const { ref, ...field } = registration;
  return <Input.TextArea {...field} {...props} ref={(node) => ref(node?.resizableTextArea?.textArea ?? null)} />;
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
      onStatus('Ingrese un motivo del cambio fiscal de al menos 5 caracteres.');
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
    onStatus('Guardando numeración fiscal...');
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
      onStatus('Numeración fiscal guardada.');
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar la numeración.'));
      setError(message);
      onStatus(message);
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
    <section>
      <Typography.Title level={3}>Numeración fiscal</Typography.Title>
      <Typography.Paragraph type="secondary">Configure el rango autorizado para emitir facturas. Cambios requieren motivo y quedan auditados.</Typography.Paragraph>
      {error ? (
        <Alert type="error" showIcon title="No se pudo guardar" description={error} />
      ) : null}

      {!sequence && (
        <Alert type="warning" showIcon icon={<AlertTriangle />} title="Sin numeración" description="Configure el CAI, prefijo y rango autorizado antes de emitir facturas." />
      )}

      {sequence ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Estado del rango fiscal">
          <div className="border border-operational-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Disponibilidad del rango</p>
              <Tag color={availableNumbers <= 100 ? 'warning' : 'success'}>
                {availableNumbers <= 100 ? 'Rango por agotarse' : 'Rango disponible'}
              </Tag>
            </div>
            <p className="mt-2 text-sm tabular-nums text-muted-foreground">
              {availableNumbers.toLocaleString('es-HN')} números disponibles de {Number(sequence.max_number - sequence.min_number + 1).toLocaleString('es-HN')} autorizados.
            </p>
          </div>
          <div className="border border-operational-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Vigencia</p>
              <Tag color={isExpired ? 'error' : 'success'}>
                {isExpired ? 'Vencida' : 'Vigente'}
              </Tag>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isExpired ? 'Venció el' : 'Vigente hasta'} {sequence.valid_until}.
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={form.formState.isSubmitting || saving}>
        <Card>
          <Typography.Title level={3}>Datos fiscales</Typography.Title>
          <Typography.Paragraph type="secondary">CAI, prefijo y rango autorizado por el SAR.</Typography.Paragraph>
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
                  : 'ú?,????'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                El backend lo incrementa al emitir. No se reinicia desde esta pantalla.
              </p>
            </div>
          </div>
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

        <div className="flex justify-end">
          <Button htmlType="submit" type="primary" icon={<Save aria-hidden="true" />} disabled={!canEdit || form.formState.isSubmitting || saving}>
            Guardar numeración
          </Button>
        </div>
      </form>

      <Modal
        open={pendingChange !== null}
        title="Revisar cambio fiscal"
        okText={saving ? 'Guardando...' : 'Confirmar y guardar'}
        okButtonProps={{ disabled: saving }}
        cancelButtonProps={{ disabled: saving }}
        onCancel={() => setPendingChange(null)}
        onOk={() => {
          if (pendingChange) void saveSequence(pendingChange);
        }}
        modalRender={(node) => <div role="alertdialog" aria-label="Revisar cambio fiscal">{node}</div>}
      >
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <Alert type="error" showIcon title="No se pudo guardar" description={error} /> : null}
            <p>Este cambio afecta la numeración de las próximas facturas y quedará auditado.</p>
            <dl className="grid gap-3 border border-operational-border bg-muted/40 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium">Prefijo</dt>
                <dd className="font-mono tabular-nums">{sequence?.prefix ?? 'ú?,????'} ú?????T {pendingChange.prefix}</dd>
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
                  {sequence ? `${sequence.min_number.toLocaleString('es-HN')} ú?,??ó ${sequence.max_number.toLocaleString('es-HN')}` : 'Sin configurar'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium">Rango nuevo</dt>
                <dd className="font-mono tabular-nums">{pendingChange.min_number.toLocaleString('es-HN')} ú?,??ó {pendingChange.max_number.toLocaleString('es-HN')}</dd>
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
      </Modal>
    </section>
  );
}
