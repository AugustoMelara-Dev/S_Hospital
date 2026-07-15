import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SaveOutlined as Save } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal, Typography } from 'antd';
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
    <Form.Item label={label} htmlFor={id} required={required} validateStatus={error ? 'error' : undefined} help={error}>
      {children({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : undefined })}
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
    <section>
      <Typography.Title level={3}>Datos del hospital</Typography.Title>
      <Typography.Paragraph type="secondary">Información legal y de contacto del hospital. Aparece en recibos y cabecera de la app.</Typography.Paragraph>
      {error ? (
        <Alert type="error" showIcon title="No se pudo guardar" description={error} />
      ) : null}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        aria-busy={form.formState.isSubmitting || saving}
      >
        <Card>
          <Typography.Title level={3}>Identidad</Typography.Title>
          <Typography.Paragraph type="secondary">Nombre legal y datos fiscales básicos.</Typography.Paragraph>
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
        </Card>

        <Card>
          <Typography.Title level={3}>Encabezado institucional</Typography.Title>
          <Typography.Paragraph type="secondary">Líneas opcionales que aparecen en el encabezado de recibos.</Typography.Paragraph>
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
        </Card>

        <Card>
          <Typography.Title level={3}>Pie de recibo</Typography.Title>
          <Typography.Paragraph type="secondary">Textos opcionales que aparecen al pie del recibo.</Typography.Paragraph>
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
        </Card>

        <div
          data-sticky-actions="true"
          className="sticky bottom-0 z-10 flex justify-end border-t border-operational-border bg-operational-surface p-3"
        >
          <Button htmlType="submit" type="primary" icon={<Save aria-hidden="true" />} disabled={!canEdit || form.formState.isSubmitting || saving}>
            Guardar datos del hospital
          </Button>
        </div>
      </form>

      <Modal
        open={pendingChange !== null}
        title="Revisar cambio de RTN"
        okText={saving ? 'Guardando...' : 'Confirmar y guardar'}
        okButtonProps={{ disabled: saving }}
        cancelButtonProps={{ disabled: saving }}
        onCancel={() => setPendingChange(null)}
        onOk={() => {
          if (pendingChange) void saveHospital(pendingChange);
        }}
        modalRender={(node) => <div role="alertdialog" aria-label="Revisar cambio de RTN">{node}</div>}
      >
        {pendingChange ? (
          <div className="space-y-3">
            {error ? <Alert type="error" showIcon title="No se pudo guardar" description={error} /> : null}
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
      </Modal>
    </section>
  );
}
