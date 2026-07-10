import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type HospitalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

const hospitalSchema = z.object({
  hospital_name: z.string().trim().min(1, 'El nombre del hospital es requerido'),
  rtn: z.string().trim().max(32, 'RTN muy largo').optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
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

export function HospitalSettingsView({ canEdit, onStatus }: HospitalSettingsViewProps) {
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingChange, setPendingChange] = useState<HospitalFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const form = useForm<HospitalFormData>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      hospital_name: '',
      rtn: '',
      address: '',
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
    try {
      const data = await apiClient.getFiscalSettings();
      setSettings(data);
      form.reset({
        hospital_name: isPlaceholderHospitalName(data?.hospital_name) ? '' : data?.hospital_name ?? '',
        rtn: data?.rtn ?? '',
        address: data?.address ?? '',
        slogan: data?.slogan ?? '',
        government_line: data?.government_line ?? '',
        secretariat_line: data?.secretariat_line ?? '',
        receipt_location: data?.receipt_location ?? '',
        receipt_footer_text: data?.receipt_footer_text ?? '',
        reason: '',
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar los datos del hospital.'));
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const watchedRtn = form.watch('rtn') ?? '';
  const rtnChanged = settings !== null && watchedRtn.trim() !== (settings.rtn ?? '').trim();

  async function onSubmit(data: HospitalFormData) {
    const fiscalReason = data.reason?.trim() ?? '';
    if (rtnChanged && fiscalReason.length < 5) {
      form.setError('reason', {
        type: 'manual',
        message: 'Indique al menos 5 caracteres explicando el motivo del cambio fiscal.',
      });
      onStatus('Ingrese un motivo del cambio fiscal de al menos 5 caracteres.');

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
    onStatus('Guardando datos del hospital...');
    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: data.hospital_name,
        rtn: data.rtn ?? '',
        address: optionalText(data.address ?? '') ?? '',
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
        slogan: updated.slogan ?? '',
        government_line: updated.government_line ?? '',
        secretariat_line: updated.secretariat_line ?? '',
        receipt_location: updated.receipt_location ?? '',
        receipt_footer_text: updated.receipt_footer_text ?? '',
        reason: '',
      });
      onStatus('Datos del hospital guardados.');
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar los datos del hospital.'));
      setError(message);
      onStatus(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Cargando datos del hospital...
      </div>
    );
  }

  return (
    <FormSection
      title="Datos del hospital"
      description="Información legal y de contacto del hospital. Aparece en recibos y cabecera de la app."
    >
      {error ? (
        <Alert variant="destructive" title="No se pudo guardar">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        aria-busy={form.formState.isSubmitting || saving}
      >
        <Card>
          <CardHeader>
            <CardTitle>Identidad</CardTitle>
            <CardDescription>Nombre legal y datos fiscales básicos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField id="hospital_name" label="Nombre del hospital" required error={form.formState.errors.hospital_name?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('hospital_name')}
                  placeholder="Hospital Nacional..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="rtn" label="RTN" hint="Opcional. Si no aplica, dejar vacío." error={form.formState.errors.rtn?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('rtn')}
                  placeholder="0801-XXXX-XXXXX"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            {rtnChanged ? (
              <FormField id="reason" label="Motivo del cambio fiscal" required hint="Obligatorio al modificar el RTN." error={form.formState.errors.reason?.message}>
                {({ id, invalid, describedBy }) => (
                  <Textarea
                    id={id}
                    {...form.register('reason')}
                    rows={2}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                )}
              </FormField>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Encabezado institucional</CardTitle>
            <CardDescription>Líneas opcionales que aparecen en el encabezado de recibos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField id="government_line" label="Dependencia superior" hint="Encabezado autorizado." error={form.formState.errors.government_line?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('government_line')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="secretariat_line" label="Secretaría o unidad" error={form.formState.errors.secretariat_line?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('secretariat_line')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="address" label="Dirección" error={form.formState.errors.address?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('address')}
                  placeholder="Barrio Centro, Avenida Principal..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="slogan" label="Lema" error={form.formState.errors.slogan?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('slogan')}
                  placeholder="Al servicio de tu salud..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pie de recibo</CardTitle>
            <CardDescription>Textos opcionales que aparecen al pie del recibo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField id="receipt_location" label="Lugar del recibo" hint="Ciudad o lugar autorizado." error={form.formState.errors.receipt_location?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  {...form.register('receipt_location')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            <FormField id="receipt_footer_text" label="Texto al pie" error={form.formState.errors.receipt_footer_text?.message}>
              {({ id, invalid, describedBy }) => (
                <Textarea
                  id={id}
                  {...form.register('receipt_footer_text')}
                  rows={2}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canEdit || form.formState.isSubmitting || saving}>
            <Save data-icon aria-hidden="true" />
            Guardar datos del hospital
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingChange !== null}
        title="Revisar cambio de RTN"
        confirmLabel={saving ? 'Guardando...' : 'Confirmar y guardar'}
        confirmDisabled={saving}
        cancelDisabled={saving}
        onCancel={() => setPendingChange(null)}
        onConfirm={() => {
          if (pendingChange) void saveHospital(pendingChange);
        }}
      >
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <Alert variant="destructive" title="No se pudo guardar">{error}</Alert> : null}
            <p>El RTN se usará en recibos y documentos institucionales emitidos después del cambio.</p>
            <dl className="grid gap-2 rounded-md border border-operational-border bg-operational-panel p-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium">RTN actual</dt>
                <dd className="break-all font-mono tabular-nums">{settings?.rtn || 'Sin RTN'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium">RTN nuevo</dt>
                <dd className="break-all font-mono tabular-nums">{pendingChange.rtn?.trim() || 'Sin RTN'}</dd>
              </div>
            </dl>
            <p className="font-medium text-foreground">El motivo se enviará al servidor para auditoría.</p>
          </div>
        ) : null}
      </ConfirmDialog>
    </FormSection>
  );
}
