import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCallout, AdminDialog, AdminField, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, STICKY_ACTIONS, TEXTAREA_CLASS } from './settingsUi';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type HospitalSettingsViewProps = {
  canEdit: boolean;
  onStatus: OperationalStatusReporter;
};

const hospitalSchema = z.object({
  hospital_name: z.string().trim().min(1, 'El nombre del hospital es requerido'),
  rtn: z.string().trim().max(32, 'RTN muy largo').optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  phone: z.string().max(64).optional().or(z.literal('')),
  slogan: z.string().max(255).optional().or(z.literal('')),
  government_line: z.string().max(120).optional().or(z.literal('')),
  secretariat_line: z.string().max(160).optional().or(z.literal('')),
  receipt_location: z.string().max(160).optional().or(z.literal('')),
  receipt_footer_text: z.string().max(255).optional().or(z.literal('')),
  reason: z.string().max(500).optional().or(z.literal('')),
});

type HospitalFormData = z.infer<typeof hospitalSchema>;

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPlaceholderHospitalName(value: string | null | undefined): boolean {
  return new RegExp(`^hospital ${'de' + 'mo'}$`, 'i').test(value?.trim() ?? '');
}

function HospitalField({ children, error, hint, id, label, required }: {
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  id: string;
  label: string;
  required?: boolean;
}) {
  return <AdminField htmlFor={id} label={label} required={required} hint={hint} error={error}>{children}</AdminField>;
}

export function HospitalSettingsView({ canEdit, onStatus }: HospitalSettingsViewProps) {
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pendingChange, setPendingChange] = useState<HospitalFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const form = useForm<HospitalFormData>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      hospital_name: '',
      rtn: '',
      address: '',
      phone: '',
      slogan: '',
      government_line: '',
      secretariat_line: '',
      receipt_location: '',
      receipt_footer_text: '',
      reason: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiClient.getFiscalSettings();
      setSettings(data);
      form.reset({
        hospital_name: isPlaceholderHospitalName(data?.hospital_name) ? '' : data?.hospital_name ?? '',
        rtn: data?.rtn ?? '',
        address: data?.address ?? '',
        phone: data?.phone ?? '',
        slogan: data?.slogan ?? '',
        government_line: data?.government_line ?? '',
        secretariat_line: data?.secretariat_line ?? '',
        receipt_location: data?.receipt_location ?? '',
        receipt_footer_text: data?.receipt_footer_text ?? '',
        reason: '',
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar los datos del hospital.'));
      setLoadError(message);
      onStatus({ key: 'settings:hospital:load', level: 'error', message, toast: false });
    } finally {
      setLoading(false);
    }
  }, [form, onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const watchedRtn = form.watch('rtn') ?? '';
  const rtnChanged = settings !== null && watchedRtn.trim() !== (settings.rtn ?? '').trim();
  const draft = form.watch();

  useUnsavedChangesGuard(form.formState.isDirty);

  async function onSubmit(data: HospitalFormData) {
    const fiscalReason = data.reason?.trim() ?? '';
    if (rtnChanged && fiscalReason.length < 5) {
      form.setError('reason', {
        type: 'manual',
        message: 'Indique al menos 5 caracteres explicando el motivo del cambio fiscal.',
      });
      onStatus({ key: 'settings:hospital:validation', level: 'warning', message: 'Ingrese un motivo del cambio fiscal de al menos 5 caracteres.', toast: false });

      return;
    }
    if (rtnChanged) {
      setPendingChange(data);
      return;
    }

    await saveHospital(data);
  }

  async function saveHospital(data: HospitalFormData) {
    if (savingRef.current) return;
    const fiscalReason = data.reason?.trim() ?? '';
    savingRef.current = true;
    setSaving(true);
    setError('');
    onStatus({ key: 'settings:hospital:save', level: 'info', message: 'Guardando datos del hospital...', toast: false });
    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: data.hospital_name,
        rtn: data.rtn ?? '',
        address: optionalText(data.address ?? '') ?? '',
        phone: optionalText(data.phone ?? ''),
        slogan: optionalText(data.slogan ?? '') ?? '',
        government_line: optionalText(data.government_line ?? ''),
        secretariat_line: optionalText(data.secretariat_line ?? ''),
        receipt_location: optionalText(data.receipt_location ?? ''),
        receipt_footer_text: optionalText(data.receipt_footer_text ?? ''),
        ...(rtnChanged ? { reason: fiscalReason } : {}),
      });
      setSettings(updated);
      setPendingChange(null);
      form.reset({
        hospital_name: updated.hospital_name,
        rtn: updated.rtn ?? '',
        address: updated.address ?? '',
        phone: updated.phone ?? '',
        slogan: updated.slogan ?? '',
        government_line: updated.government_line ?? '',
        secretariat_line: updated.secretariat_line ?? '',
        receipt_location: updated.receipt_location ?? '',
        receipt_footer_text: updated.receipt_footer_text ?? '',
        reason: '',
      });
      onStatus({ key: 'settings:hospital:save', level: 'success', message: 'Datos del hospital guardados.' });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar los datos del hospital.'));
      setError(message);
      onStatus({ key: 'settings:hospital:save', level: 'error', message });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Cargando datos del hospital...
      </div>
    );
  }

  // Sin los datos vigentes no se dibuja el formulario: un formulario vacío
  // parece «el hospital no tiene nombre» y permitiría sobrescribir el registro
  // real con datos parciales.
  if (loadError) {
    return (
      <AdminPanel as="section" aria-labelledby="hospital-settings-title">
        <AdminPanelHeader
          id="hospital-settings-title"
          title="Datos del hospital"
          description="Información legal y de contacto que usan los recibos nuevos."
        />
        <div className="p-4">
          <AdminCallout tone="error" title="No se pudieron cargar los datos del hospital">
            {loadError}
            <div className="mt-3">
              <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void load()}>
                Reintentar carga
              </button>
            </div>
          </AdminCallout>
        </div>
      </AdminPanel>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <AdminPanel as="section" aria-labelledby="hospital-settings-title">
        <AdminPanelHeader
          id="hospital-settings-title"
          title="Datos del hospital"
          description="Información legal y de contacto que usan los recibos nuevos."
        />
        <div className="p-4">
          {error ? (
            <AdminCallout tone="error" title="No se pudo guardar">{error}</AdminCallout>
          ) : null}

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-5"
            aria-busy={form.formState.isSubmitting || saving}
          >
            <fieldset className="grid gap-4">
              <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Identidad</legend>
              <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Nombre legal, RTN y datos de contacto.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <HospitalField id="hospital_name" label="Nombre del hospital" required error={form.formState.errors.hospital_name?.message}>
                  <input id="hospital_name" placeholder="Hospital Nacional..." {...form.register('hospital_name')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.hospital_name)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="rtn" label="RTN" hint="Opcional. Si no aplica, dejar vacío." error={form.formState.errors.rtn?.message}>
                  <input id="rtn" placeholder="0801-XXXX-XXXXX" {...form.register('rtn')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.rtn)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="address" label="Dirección" error={form.formState.errors.address?.message}>
                  <input id="address" placeholder="Barrio Centro, Avenida Principal..." {...form.register('address')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.address)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="phone" label="Teléfono" error={form.formState.errors.phone?.message}>
                  <input id="phone" placeholder="2444-0000" {...form.register('phone')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.phone)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="slogan" label="Lema" error={form.formState.errors.slogan?.message}>
                  <input id="slogan" placeholder="Al servicio de tu salud..." {...form.register('slogan')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.slogan)} className={INPUT_CLASS} />
                </HospitalField>
                {rtnChanged ? (
                  <HospitalField id="hospital_reason" label="Motivo del cambio fiscal" required hint="Obligatorio al modificar el RTN." error={form.formState.errors.reason?.message}>
                    <textarea id="hospital_reason" rows={2} {...form.register('reason')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.reason)} className={TEXTAREA_CLASS} />
                  </HospitalField>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="grid gap-4">
              <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Encabezado y pie del recibo</legend>
              <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Líneas opcionales que se imprimen arriba y al pie del recibo.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <HospitalField id="government_line" label="Dependencia superior" hint="Encabezado autorizado." error={form.formState.errors.government_line?.message}>
                  <input id="government_line" {...form.register('government_line')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.government_line)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="secretariat_line" label="Secretaría o unidad" error={form.formState.errors.secretariat_line?.message}>
                  <input id="secretariat_line" {...form.register('secretariat_line')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.secretariat_line)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="receipt_location" label="Lugar del recibo" hint="Ciudad o lugar autorizado." error={form.formState.errors.receipt_location?.message}>
                  <input id="receipt_location" {...form.register('receipt_location')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.receipt_location)} className={INPUT_CLASS} />
                </HospitalField>
                <HospitalField id="receipt_footer_text" label="Texto al pie" error={form.formState.errors.receipt_footer_text?.message}>
                  <textarea id="receipt_footer_text" rows={2} {...form.register('receipt_footer_text')} disabled={!canEdit} aria-invalid={Boolean(form.formState.errors.receipt_footer_text)} className={TEXTAREA_CLASS} />
                </HospitalField>
              </div>
            </fieldset>

            {canEdit && form.formState.isDirty ? (
              <div data-sticky-actions="true" className={STICKY_ACTIONS}>
                <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Hay cambios sin guardar.</span>
                <button type="submit" data-ui-press className={PRIMARY_BUTTON} disabled={form.formState.isSubmitting || saving}>
                  {saving ? 'Guardando…' : 'Guardar datos del hospital'}
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </AdminPanel>

      <HospitalDraftPreview
        hospitalName={draft.hospital_name}
        rtn={draft.rtn}
        address={draft.address}
        phone={draft.phone}
        slogan={draft.slogan}
        governmentLine={draft.government_line}
        secretariatLine={draft.secretariat_line}
        receiptLocation={draft.receipt_location}
        receiptFooterText={draft.receipt_footer_text}
        isDirty={form.formState.isDirty}
      />

      <AdminDialog
        open={pendingChange !== null}
        onOpenChange={(next) => { if (!next && !saving) setPendingChange(null); }}
        title="Revisar cambio de RTN"
        description="Confirme el cambio fiscal antes de guardar."
        footer={(
          <>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={saving} onClick={() => setPendingChange(null)}>Cancelar</button>
            <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={saving} onClick={() => { if (pendingChange) void saveHospital(pendingChange); }}>
              {saving ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          </>
        )}
      >
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <AdminCallout tone="error" title="No se pudo guardar">{error}</AdminCallout> : null}
            <p>El RTN se usará en recibos y documentos institucionales emitidos después del cambio.</p>
            <dl className="grid gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">RTN actual</dt>
                <dd className="break-all font-mono tabular-nums">{settings?.rtn || 'Sin RTN'}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">RTN nuevo</dt>
                <dd className="break-all font-mono tabular-nums">{pendingChange.rtn?.trim() || 'Sin RTN'}</dd>
              </div>
            </dl>
            <p className="font-medium text-[color:var(--ui-ink)]">El motivo queda registrado en la auditoría del cambio.</p>
          </div>
        ) : null}
      </AdminDialog>
    </section>
  );
}

type HospitalDraftPreviewProps = {
  hospitalName?: string;
  rtn?: string;
  address?: string;
  phone?: string;
  slogan?: string;
  governmentLine?: string;
  secretariatLine?: string;
  receiptLocation?: string;
  receiptFooterText?: string;
  isDirty: boolean;
};

/**
 * Vista previa del borrador del encabezado/pie. Reutiliza los valores editados
 * (no persistidos) para que el operador vea el resultado antes de guardar; no
 * promete nada sobre documentos ya emitidos.
 */
function HospitalDraftPreview({
  address,
  governmentLine,
  hospitalName,
  isDirty,
  phone,
  receiptFooterText,
  receiptLocation,
  rtn,
  secretariatLine,
  slogan,
}: HospitalDraftPreviewProps) {
  const name = hospitalName?.trim() ?? '';

  return (
    <AdminPanel as="aside" aria-labelledby="hospital-draft-preview-title" className="xl:sticky xl:top-4">
      <AdminPanelHeader
        headingLevel={2}
        id="hospital-draft-preview-title"
        title="Vista previa del borrador"
        description="Así se verán los recibos nuevos antes de guardar."
      />
      <div role="status" aria-live="polite" className="flex flex-col gap-3 p-4">
        <div className="rounded-[var(--ui-radius)] border border-dashed border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] px-4 py-4 text-center">
          {governmentLine?.trim() ? (
            <p className="text-[length:var(--ui-text-xs)] uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">{governmentLine}</p>
          ) : null}
          {secretariatLine?.trim() ? (
            <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{secretariatLine}</p>
          ) : null}
          <p className="mt-1 text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">
            {name || 'Nombre del hospital pendiente'}
          </p>
          {rtn?.trim() ? (
            <p className="mt-0.5 text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">RTN {rtn}</p>
          ) : null}
          {address?.trim() ? (
            <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              {address}
              {phone?.trim() ? ` · ${phone}` : ''}
            </p>
          ) : null}
          {slogan?.trim() ? (
            <p className="mt-1 text-[length:var(--ui-text-xs)] italic text-[color:var(--ui-ink-soft)]">{slogan}</p>
          ) : null}
        </div>

        <dl className="grid gap-2 text-[length:var(--ui-text-xs)]">
          <div>
            <dt className="text-[color:var(--ui-ink-soft)]">Lugar del recibo</dt>
            <dd className="font-medium text-[color:var(--ui-ink)]">{receiptLocation?.trim() || 'Sin definir'}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ui-ink-soft)]">Texto al pie</dt>
            <dd className="font-medium text-[color:var(--ui-ink)]">{receiptFooterText?.trim() || 'Sin definir'}</dd>
          </div>
        </dl>

        <p className="border-t border-[var(--ui-line)] pt-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          {isDirty ? 'Borrador sin guardar.' : 'Sin cambios pendientes.'} Los documentos ya emitidos no se modifican.
        </p>
      </div>
    </AdminPanel>
  );
}
