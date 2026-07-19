import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
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

function HospitalField({ children, error, id, label, required }: {
  children: (props: { id: string; invalid: boolean; describedBy: string | undefined }) => ReactNode;
  error?: string;
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}{required ? ' *' : ''}</FieldLabel>
      {children({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : undefined })}
      <FieldError id={`${id}-error`}>{error}</FieldError>
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
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Cargando datos del hospital...
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <header><h2 className="text-lg font-semibold">Datos del hospital</h2><p className="text-sm text-muted-foreground">Información legal y de contacto visible en recibos y en la aplicación.</p></header>
      {error ? (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4"
        aria-busy={form.formState.isSubmitting || saving}
      >
        <Card>
          <CardHeader><CardTitle>Identidad</CardTitle><CardDescription>Nombre legal y datos fiscales básicos.</CardDescription></CardHeader>
          <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <HospitalField id="hospital_name" label="Nombre del hospital" required error={form.formState.errors.hospital_name?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('hospital_name')}
                  placeholder="Hospital Nacional..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="rtn" label="RTN" hint="Opcional. Si no aplica, dejar vacío." error={form.formState.errors.rtn?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('rtn')}
                  placeholder="0801-XXXX-XXXXX"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            {rtnChanged ? (
              <HospitalField id="reason" label="Motivo del cambio fiscal" required hint="Obligatorio al modificar el RTN." error={form.formState.errors.reason?.message}>
                {({ id, invalid, describedBy }) => (
                  <RegisteredTextArea
                    id={id}
                    registration={form.register('reason')}
                    rows={2}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                )}
              </HospitalField>
            ) : null}
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Encabezado institucional</CardTitle><CardDescription>Líneas opcionales que aparecen en el encabezado de recibos.</CardDescription></CardHeader>
          <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <HospitalField id="government_line" label="Dependencia superior" hint="Encabezado autorizado." error={form.formState.errors.government_line?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('government_line')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="secretariat_line" label="Secretaría o unidad" error={form.formState.errors.secretariat_line?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('secretariat_line')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="address" label="Dirección" error={form.formState.errors.address?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('address')}
                  placeholder="Barrio Centro, Avenida Principal..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="phone" label="Teléfono" error={form.formState.errors.phone?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('phone')}
                  placeholder="2444-0000"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="slogan" label="Lema" error={form.formState.errors.slogan?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('slogan')}
                  placeholder="Al servicio de tu salud..."
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pie de recibo</CardTitle><CardDescription>Textos opcionales que aparecen al pie del recibo.</CardDescription></CardHeader>
          <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <HospitalField id="receipt_location" label="Lugar del recibo" hint="Ciudad o lugar autorizado." error={form.formState.errors.receipt_location?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredInput
                  id={id}
                  registration={form.register('receipt_location')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
            <HospitalField id="receipt_footer_text" label="Texto al pie" error={form.formState.errors.receipt_footer_text?.message}>
              {({ id, invalid, describedBy }) => (
                <RegisteredTextArea
                  id={id}
                  registration={form.register('receipt_footer_text')}
                  rows={2}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={!canEdit}
                />
              )}
            </HospitalField>
          </div>
          </CardContent>
        </Card>

        {canEdit && form.formState.isDirty ? (
          <div
            data-sticky-actions="true"
            className="sticky bottom-20 z-20 flex items-center justify-between gap-3 border-t border-operational-border bg-operational-surface p-3 lg:bottom-0"
          >
            <span className="text-xs text-muted-foreground">Hay cambios sin guardar.</span>
            <Button type="submit" disabled={form.formState.isSubmitting || saving}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Guardar datos del hospital
            </Button>
          </div>
        ) : null}
      </form>

      <AlertDialog open={pendingChange !== null} onOpenChange={(next) => { if (!next && !saving) setPendingChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisar cambio de RTN</AlertDialogTitle>
            <AlertDialogDescription>Confirme el cambio fiscal antes de guardar.</AlertDialogDescription>
          </AlertDialogHeader>
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            <p>El RTN se usará en recibos y documentos institucionales emitidos después del cambio.</p>
            <dl className="grid gap-3 border border-operational-border bg-muted/40 p-4 sm:grid-cols-2">
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => { if (pendingChange) void saveHospital(pendingChange); }}>
              {saving ? <Spinner data-icon="inline-start" /> : null}{saving ? 'Guardando…' : 'Confirmar y guardar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
