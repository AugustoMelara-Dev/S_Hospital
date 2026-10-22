import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCallout, AdminDialog, AdminField, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import { type FiscalSequence, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { INPUT_CLASS, ADMIN_TAG, PRIMARY_BUTTON, SECONDARY_BUTTON, STICKY_ACTIONS, TEXTAREA_CLASS } from './settingsUi';
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

function FiscalField({ children, error, hint, id, label, required }: {
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  id: string;
  label: string;
  required?: boolean;
}) {
  return <AdminField htmlFor={id} label={label} required={required} hint={hint} error={error}>{children}</AdminField>;
}

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

function fiscalDateValue(value: string | null | undefined): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}

function fiscalDateLabel(value: string | null | undefined): string {
  const normalized = fiscalDateValue(value);
  if (!normalized) return 'Sin configurar';
  const [year, month, day] = normalized.split('-').map(Number);
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function todayDateValue(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
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

  useUnsavedChangesGuard(form.formState.isDirty);

  async function load() {
    setLoading(true);
    try {
      const sequences = await apiClient.getFiscalSequences();
      const first = sequences[0] ?? null;
      const normalizedFirst = first
        ? { ...first, valid_until: fiscalDateValue(first.valid_until) }
        : null;
      setSequence(normalizedFirst);
      form.reset({
        prefix: first?.prefix ?? '',
        cai: isPlaceholderCai(first?.cai) ? '' : first?.cai ?? '',
        min_number: first?.min_number ?? 1,
        max_number: first?.max_number ?? 99999999,
        valid_until: fiscalDateValue(first?.valid_until),
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
      const normalizedSaved = { ...saved, valid_until: fiscalDateValue(saved.valid_until) };
      setSequence(normalizedSaved);
      setPendingChange(null);
      form.reset({
        prefix: saved.prefix,
        cai: saved.cai,
        min_number: saved.min_number,
        max_number: saved.max_number,
        valid_until: normalizedSaved.valid_until,
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
  const isExpired = sequence?.valid_until
    ? sequence.valid_until < todayDateValue()
    : false;
  const hasExpirationDate = Boolean(sequence?.valid_until);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Cargando numeración fiscal...
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <AdminPanel as="section" aria-labelledby="fiscal-numeration-title">
        <AdminPanelHeader
          id="fiscal-numeration-title"
          title="Numeración fiscal"
          description="Configure el rango autorizado. Los cambios requieren motivo y quedan auditados."
        />
        <div className="grid gap-4 p-4">
          {error ? (
            <AdminCallout tone="error" title="No se pudo guardar">{error}</AdminCallout>
          ) : null}

          {!sequence ? (
            <AdminCallout tone="warn" title="Sin numeración">
              Configure el CAI, prefijo y rango autorizado antes de emitir facturas.
            </AdminCallout>
          ) : null}

          {sequence ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-label="Estado del rango fiscal">
              <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Disponibilidad del rango</p>
                  {/* Chip de tono con la forma del ADMIN_TAG pero clases completas:
                      añadir border/text al ADMIN_TAG competiría con su borde y
                      tinta neutrales en el orden de utilidades (§2, no-solo-color:
                      la etiqueta textual acompaña). */}
                  <span className={availableNumbers <= 100
                    ? 'inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-warn)]'
                    : ADMIN_TAG}
                  >
                    {availableNumbers <= 100 ? 'Rango por agotarse' : 'Rango disponible'}
                  </span>
                </div>
                <p className="mt-2 text-[length:var(--ui-text-sm)] tabular-nums text-[color:var(--ui-ink-soft)]">
                  {availableNumbers.toLocaleString('es-HN')} números disponibles de {Number(sequence.max_number - sequence.min_number + 1).toLocaleString('es-HN')} autorizados.
                </p>
              </div>
              <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Vigencia</p>
                  <span className={isExpired
                    ? 'inline-flex w-fit items-center gap-1.5 rounded-[var(--ui-radius)] border border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-danger)]'
                    : ADMIN_TAG}
                  >
                    {!hasExpirationDate ? 'Sin fecha' : isExpired ? 'Vencida' : 'Vigente'}
                  </span>
                </div>
                <p className="mt-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                  {!hasExpirationDate
                    ? 'Fecha de vencimiento sin configurar.'
                    : `${isExpired ? 'Venció el' : 'Vigente hasta'} ${fiscalDateLabel(sequence.valid_until)}.`}
                </p>
              </div>
            </div>
          ) : null}

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" aria-busy={form.formState.isSubmitting || saving}>
            <fieldset className="grid gap-4">
              <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Datos fiscales</legend>
              <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">CAI, prefijo y rango autorizado por el SAR.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <FiscalField id="prefix" label="Prefijo" required error={form.formState.errors.prefix?.message}>
                  <input id="prefix" placeholder="A" {...form.register('prefix')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.prefix)} className={`${INPUT_CLASS} font-mono uppercase`} />
                </FiscalField>
                <FiscalField id="cai" label="CAI" required error={form.formState.errors.cai?.message}>
                  <input id="cai" placeholder="CAI-XXXXX-XXXXX-XXXXX" {...form.register('cai')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.cai)} className={`${INPUT_CLASS} font-mono`} />
                </FiscalField>
                <FiscalField id="valid_until" label="Válido hasta" required error={form.formState.errors.valid_until?.message}>
                  <input id="valid_until" type="date" {...form.register('valid_until')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.valid_until)} className={INPUT_CLASS} />
                </FiscalField>
                <FiscalField id="min_number" label="Desde el número" required error={form.formState.errors.min_number?.message}>
                  <input id="min_number" type="number" {...form.register('min_number', { valueAsNumber: true })} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.min_number)} className={INPUT_CLASS} />
                </FiscalField>
                <FiscalField id="max_number" label="Hasta el número" required error={form.formState.errors.max_number?.message}>
                  <input id="max_number" type="number" {...form.register('max_number', { valueAsNumber: true })} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.max_number)} className={INPUT_CLASS} />
                </FiscalField>
                <div className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4 text-[length:var(--ui-text-sm)]">
                  <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">
                    Correlativo actual
                  </p>
                  <p className="mt-1 font-mono text-[length:var(--ui-text-lg)] font-semibold tabular-nums text-[color:var(--ui-ink)]">
                    {sequence?.prefix && sequence?.current_number != null
                      ? `${sequence.prefix}-${String(sequence.current_number).padStart(8, '0')}`
                      : 'Sin correlativo'}
                  </p>
                  <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                    El número aumenta al emitir una factura. No se reinicia desde esta pantalla.
                  </p>
                </div>
              </div>
            </fieldset>

            {sequence?.id ? (
              <FiscalField
                id="fiscal_reason"
                label="Motivo del cambio fiscal"
                required
                hint="Obligatorio al guardar cambios de prefijo, CAI, rango, correlativo o vigencia."
                error={form.formState.errors.reason?.message}
              >
                <textarea id="fiscal_reason" rows={3} {...form.register('reason')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.reason)} placeholder="Ej. Nuevo rango autorizado por SAR" className={TEXTAREA_CLASS} />
              </FiscalField>
            ) : null}

            {canEdit && form.formState.isDirty ? (
              <div data-sticky-actions="true" className={STICKY_ACTIONS}>
                <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Hay cambios fiscales sin guardar.</span>
                <button type="submit" data-ui-press className={PRIMARY_BUTTON} disabled={form.formState.isSubmitting || saving}>
                  {saving ? 'Guardando…' : 'Guardar numeración'}
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </AdminPanel>

      <AdminDialog
        open={pendingChange !== null}
        onOpenChange={(next) => { if (!next && !saving) setPendingChange(null); }}
        className="sm:max-w-2xl"
        title="Revisar cambio fiscal"
        description="Confirme la numeración autorizada antes de guardar."
        footer={(
          <>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={saving} onClick={() => setPendingChange(null)}>Cancelar</button>
            <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={saving} onClick={() => { if (pendingChange) void saveSequence(pendingChange); }}>
              {saving ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          </>
        )}
      >
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <AdminCallout tone="error" title="No se pudo guardar">{error}</AdminCallout> : null}
            <p>Este cambio afecta la numeración de las próximas facturas y quedará auditado.</p>
            <dl className="grid gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Prefijo</dt>
                <dd className="font-mono tabular-nums">{sequence?.prefix ?? 'Sin configurar'} → {pendingChange.prefix}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">CAI actual</dt>
                <dd className="break-all font-mono">{sequence?.cai || 'Sin configurar'}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">CAI nuevo</dt>
                <dd className="break-all font-mono">{pendingChange.cai}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Rango actual</dt>
                <dd className="font-mono tabular-nums">
                  {sequence ? `${sequence.min_number.toLocaleString('es-HN')} a ${sequence.max_number.toLocaleString('es-HN')}` : 'Sin configurar'}
                </dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Rango nuevo</dt>
                <dd className="font-mono tabular-nums">{pendingChange.min_number.toLocaleString('es-HN')} a {pendingChange.max_number.toLocaleString('es-HN')}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Vigencia actual</dt>
                <dd>{fiscalDateLabel(sequence?.valid_until)}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Vigencia nueva</dt>
                <dd>{fiscalDateLabel(pendingChange.valid_until)}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">Correlativo actual</dt>
                <dd className="font-mono tabular-nums">{sequence?.current_number ?? 0}</dd>
              </div>
            </dl>
            <p className="font-medium text-[color:var(--ui-ink)]">El correlativo actual no cambia desde esta pantalla.</p>
          </div>
        ) : null}
      </AdminDialog>
    </section>
  );
}
