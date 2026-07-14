import { useEffect, useMemo, useState } from 'react';
import { CheckCircleOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Collapse, Form, Input, InputNumber, Radio, Select, Spin, Tabs, theme as antdTheme } from 'antd';
import { ReactNode, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SectionCard, StatCard } from '@/design-system/components/InstitutionalComponents';
import { PageHeader } from '@/design-system/components/PageHeader';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import { type InstitutionalReceiptSeries, type ReceiptPrintProfile, apiClient, userSafeErrorMessage } from '@/lib/api';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { downloadBlob } from '@/lib/download';
import { queryKeys } from '@/lib/queryKeys';
import {
  PAPER_CHOICES,
  THERMAL_COMPATIBILITY_CHOICES,
  institutionalPaperFromProfile,
  paperChoiceFor,
  paperProfileCode,
  type InstitutionalPaper,
} from '@/modules/receipts/paperPolicy';
import {
  receiptProfileSchema,
  type ReceiptProfileForm,
} from './receiptSettings.schema';

type InstitutionalReceiptSettingsViewProps = {
  canEdit: boolean;
  canEditAdvanced?: boolean;
  onStatus: OperationalStatusReporter;
};

const PROFILE_FORM_DEFAULTS = {
  copies_mode: 'original_only',
  show_copy_legend: true,
  show_physical_seal_space: true,
  use_logo: false,
  active: false,
  is_global_default: false,
} as const;

const institutionSchema = z.object({
  hospital_name: z.string().trim().min(1, 'Requerido'),
  rtn: z.string().trim().max(64).optional(),
  address: z.string().max(255).optional(),
  slogan: z.string().max(255).optional(),
  government_line: z.string().max(120).optional(),
  secretariat_line: z.string().max(160).optional(),
  receipt_location: z.string().max(160).optional(),
  receipt_footer_text: z.string().max(255).optional(),
});

const seriesSchema = z.object({
  series: z.string().trim().min(1, 'Requerido'),
  prefix: z.string().trim().min(1, 'Requerido'),
  number_format: z.string().trim().min(1, 'Requerido'),
  min_number: z.number().int().min(1),
  max_number: z.number().int().min(1),
  current_number: z.number().int().min(0),
  range_authorization: z.string().max(120).optional(),
  legal_text: z.string().max(255).optional(),
  receipt_number_color: z.string().max(16),
  active: z.boolean(),
}).refine((data) => data.max_number >= data.min_number, {
  path: ['max_number'],
  message: 'El numero final debe ser mayor o igual al inicial.',
}).refine((data) => data.current_number <= data.max_number, {
  path: ['current_number'],
  message: 'El correlativo actual no puede superar el numero final.',
}).refine((data) => !data.active || (data.current_number + 1 >= data.min_number && data.current_number + 1 <= data.max_number), {
  path: ['current_number'],
  message: 'El siguiente recibo debe quedar dentro del rango autorizado.',
});

const advancedProfileSchema = z.object({
  width_mm: z.number().positive('Debe ser mayor que cero.'),
  height_mm: z.number().positive('Debe ser mayor que cero.'),
  margin_top_mm: z.number().min(0),
  margin_right_mm: z.number().min(0),
  margin_bottom_mm: z.number().min(0),
  margin_left_mm: z.number().min(0),
  orientation: z.enum(['landscape', 'portrait']),
  font_family: z.string().trim().min(1),
  font_scale: z.number().min(0.5).max(2),
  support_reason: z.string().trim().min(10, 'Documente el motivo de soporte.'),
});

type InstitutionFormData = z.infer<typeof institutionSchema>;
type SeriesFormData = z.infer<typeof seriesSchema>;
type ProfileFormData = ReceiptProfileForm;
type AdvancedProfileFormData = z.infer<typeof advancedProfileSchema>;
const { TextArea } = Input;
export function InstitutionalReceiptSettingsView({
  canEdit,
  canEditAdvanced = false,
  onStatus,
}: InstitutionalReceiptSettingsViewProps) {
  const queryClient = useQueryClient();
  const [paper, setPaper] = useState<InstitutionalPaper>('half_letter');
  const [error, setError] = useState('');
  const institutionSavingRef = useRef(false);
  const seriesSavingRef = useRef(false);
  const profileSavingRef = useRef(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.institutionalReceipts(),
    queryFn: () => apiClient.getInstitutionalReceiptSettings(),
  });

  const settings = settingsQuery.data;
  const activeSeries = settings?.active_series ?? settings?.series[0] ?? null;
  const selectedProfile = useMemo(
    () =>
      settings?.print_profiles.find((candidate) => candidate.code === paperProfileCode(paper)) ?? null,
    [paper, settings],
  );

  const institutionForm = useForm<InstitutionFormData>({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      hospital_name: '',
      rtn: '',
      address: '',
      slogan: '',
      government_line: '',
      secretariat_line: '',
      receipt_location: '',
      receipt_footer_text: '',
    },
  });

  const seriesForm = useForm<SeriesFormData>({
    resolver: zodResolver(seriesSchema),
    defaultValues: {
      series: 'REC-A',
      prefix: 'RA',
      number_format: '{series}-{number:08}',
      min_number: 1,
      max_number: 99999999,
      current_number: 0,
      range_authorization: '',
      legal_text: '',
      receipt_number_color: String(antdTheme.getDesignToken().colorError),
      active: true,
    },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(receiptProfileSchema),
    defaultValues: PROFILE_FORM_DEFAULTS,
  });

  const advancedProfileForm = useForm<AdvancedProfileFormData>({
    resolver: zodResolver(advancedProfileSchema),
    defaultValues: {
      width_mm: 215.9,
      height_mm: 139.7,
      margin_top_mm: 6,
      margin_right_mm: 6,
      margin_bottom_mm: 6,
      margin_left_mm: 6,
      orientation: 'landscape',
      font_family: 'Arial, sans-serif',
      font_scale: 1,
      support_reason: '',
    },
  });

  useEffect(() => {
    if (!settings) return;

    const institution = settings.institution;
    institutionForm.reset({
      hospital_name: institution?.hospital_name ?? '',
      rtn: institution?.rtn ?? '',
      address: institution?.address ?? '',
      slogan: institution?.slogan ?? '',
      government_line: institution?.government_line ?? '',
      secretariat_line: institution?.secretariat_line ?? '',
      receipt_location: institution?.receipt_location ?? '',
      receipt_footer_text: institution?.receipt_footer_text ?? '',
    });

    if (activeSeries) {
      seriesForm.reset({
        series: activeSeries.series,
        prefix: activeSeries.prefix,
        number_format: activeSeries.number_format,
        min_number: activeSeries.min_number,
        max_number: activeSeries.max_number,
        current_number: activeSeries.current_number,
        range_authorization: activeSeries.range_authorization ?? '',
        legal_text: activeSeries.legal_text ?? '',
        receipt_number_color: activeSeries.receipt_number_color,
        active: activeSeries.active,
      });
    }

    setPaper(institutionalPaperFromProfile(settings.resolved_profile));
  }, [settings, activeSeries, institutionForm, seriesForm]);

  useEffect(() => {
    if (!selectedProfile) return;
    profileForm.reset({
      copies_mode: selectedProfile.copies_mode ?? PROFILE_FORM_DEFAULTS.copies_mode,
      show_copy_legend: selectedProfile.show_copy_legend ?? PROFILE_FORM_DEFAULTS.show_copy_legend,
      show_physical_seal_space: selectedProfile.show_physical_seal_space ?? PROFILE_FORM_DEFAULTS.show_physical_seal_space,
      use_logo: selectedProfile.use_logo ?? PROFILE_FORM_DEFAULTS.use_logo,
      active: selectedProfile.active ?? PROFILE_FORM_DEFAULTS.active,
      is_global_default: selectedProfile.is_global_default ?? PROFILE_FORM_DEFAULTS.is_global_default,
    });
    advancedProfileForm.reset({
      width_mm: Number(selectedProfile.width_mm ?? 215.9),
      height_mm: Number(selectedProfile.height_mm ?? 139.7),
      margin_top_mm: Number(selectedProfile.margin_top_mm ?? 6),
      margin_right_mm: Number(selectedProfile.margin_right_mm ?? 6),
      margin_bottom_mm: Number(selectedProfile.margin_bottom_mm ?? 6),
      margin_left_mm: Number(selectedProfile.margin_left_mm ?? 6),
      orientation: selectedProfile.orientation ?? 'landscape',
      font_family: selectedProfile.font_family ?? 'Arial, sans-serif',
      font_scale: Number(selectedProfile.font_scale ?? 1),
      support_reason: '',
    });
  }, [selectedProfile, profileForm, advancedProfileForm]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.institutionalReceipts() });

  const institutionMutation = useMutation({
    mutationFn: (payload: InstitutionFormData) => apiClient.updateReceiptInstitution(payload),
    onMutate: () => onStatus({
      key: 'receipt-settings:institution',
      level: 'info',
      message: 'Guardando datos institucionales del recibo...',
      toast: false,
    }),
    onSuccess: async () => {
      await invalidate();
      onStatus({ key: 'receipt-settings:institution', level: 'success', message: 'Datos institucionales del recibo guardados.' });
    },
    onError: (err) => {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la institución del recibo.');
      setError(message);
      onStatus({ key: 'receipt-settings:institution', level: 'error', message });
    },
    onSettled: () => {
      institutionSavingRef.current = false;
    },
  });

  const seriesMutation = useMutation({
    mutationFn: (payload: SeriesFormData) =>
      activeSeries
        ? apiClient.updateReceiptSeries(activeSeries.id, payload)
        : apiClient.storeReceiptSeries({ ...payload, document_type: 'institutional_receipt' }),
    onMutate: () => onStatus({
      key: 'receipt-settings:series',
      level: 'info',
      message: 'Guardando serie y correlativo del recibo...',
      toast: false,
    }),
    onSuccess: async () => {
      await invalidate();
      onStatus({ key: 'receipt-settings:series', level: 'success', message: 'Serie y correlativo del recibo guardados.' });
    },
    onError: (err) => {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la serie del recibo.');
      setError(message);
      onStatus({ key: 'receipt-settings:series', level: 'error', message });
    },
    onSettled: () => {
      seriesSavingRef.current = false;
    },
  });

  const profileMutation = useMutation({
    mutationFn: (payload: ProfileFormData) => {
      if (!selectedProfile) throw new Error('Seleccione un perfil de impresión.');
      return apiClient.updateReceiptPrintProfile(selectedProfile.id, {
        copies_mode: payload.copies_mode,
        show_physical_seal_space: payload.show_physical_seal_space,
        use_logo: payload.use_logo,
        active: true,
        is_global_default: true,
        template_code: 'institutional_classic',
        ...(canEditAdvanced
          ? advancedProfilePayload(advancedProfileForm.getValues())
          : {}),
      });
    },
    onMutate: () => onStatus({
      key: 'receipt-settings:profile',
      level: 'info',
      message: 'Guardando perfil de impresión del recibo...',
      toast: false,
    }),
    onSuccess: async () => {
      await invalidate();
      onStatus({ key: 'receipt-settings:profile', level: 'success', message: 'Perfil de impresión del recibo guardado.' });
    },
    onError: (err) => {
      const message = userSafeErrorMessage(err, 'No se pudo guardar el perfil de impresión.');
      setError(message);
      onStatus({ key: 'receipt-settings:profile', level: 'error', message });
    },
    onSettled: () => {
      profileSavingRef.current = false;
    },
  });

  const testPrintMutation = useMutation({
    mutationFn: () =>
      apiClient.testPrintInstitutionalReceipt({
        profile_code: selectedProfile?.code ?? paperProfileCode(paper),
        payer_name: 'Paciente de prueba',
        concept: 'Servicios hospitalarios de prueba',
        amount: '25.00',
      }),
    onMutate: () => onStatus({
      key: 'receipt-settings:test-print',
      level: 'info',
      message: 'Generando PDF de prueba...',
      toast: false,
    }),
    onSuccess: (blob) => {
      downloadBlob(blob, 'recibo-institucional-prueba.pdf');
      onStatus({ key: 'receipt-settings:test-print', level: 'success', message: 'PDF de prueba generado sin reservar correlativo.' });
    },
    onError: (err) => {
      const message = userSafeErrorMessage(err, 'No se pudo generar la impresión de prueba.');
      setError(message);
      onStatus({ key: 'receipt-settings:test-print', level: 'error', message });
    },
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Preparando ajustes de recibos"
          description="Papel, copias, logo y firma. El sistema prepara la impresión según el perfil seleccionado."
        />
        <div className="flex min-h-48 items-center justify-center" role="status" aria-label="Cargando ajustes de recibos...">
          <Spin size="large" description="Cargando ajustes de recibos..." />
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <>
        <PageHeader
          title="Recibos institucionales"
          description="Configuración del recibo clásico, serie, papel y copias para impresora normal."
        />
        <Alert
          type="error"
          showIcon
          title="No se pudieron cargar los ajustes de recibos"
          description={userSafeErrorMessage(settingsQuery.error, 'Revise el servidor local y vuelva a intentar.')}
        />
        <Button htmlType="button" onClick={() => void settingsQuery.refetch()}>
          Reintentar
        </Button>
      </>
    );
  }

  const institutionValues = institutionForm.watch();
  const seriesValues = seriesForm.watch();
  const previewSeries: InstitutionalReceiptSeries | null = activeSeries
    ? { ...activeSeries, ...seriesValues }
    : null;
  const watchedProfile = profileForm.watch();
  const baseProfile = selectedProfile
    ? {
        ...selectedProfile,
        copies_mode: watchedProfile.copies_mode,
        show_copy_legend: watchedProfile.show_copy_legend,
        show_physical_seal_space: watchedProfile.show_physical_seal_space,
        use_logo: watchedProfile.use_logo,
        active: watchedProfile.active,
        is_global_default: watchedProfile.is_global_default,
      }
    : null;
  const previewProfile: ReceiptPrintProfile | null = baseProfile;

  const copiesCount =
    watchedProfile.copies_mode === 'original_first_second'
      ? '3'
      : watchedProfile.copies_mode === 'original_first'
        ? '2'
        : '1';
  const profileControlsDisabled = !canEdit || profileMutation.isPending;

  return (
    <>
      <PageHeader
        title="Recibos institucionales"
        description="Papel, copias, logo y firma. El sistema prepara la impresión según el perfil seleccionado."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Papel"
          value={paperChoiceFor(paper).label}
          helper="Tamaño resuelto por el sistema"
          tone="success"
        />
        <StatCard
          label="Serie"
          value={activeSeries?.series ?? 'Pendiente'}
          helper={activeSeries ? `Próximo ${activeSeries.current_number + 1}` : 'Configure una serie'}
          tone={activeSeries?.active ? 'success' : 'warning'}
        />
        <StatCard
          label="Copias"
          value={copiesCount}
          helper={watchedProfile.show_copy_legend ? 'Con leyenda' : 'Sin leyenda'}
          tone="info"
        />
        <StatCard
          label="Permiso"
          value={canEdit ? 'Editable' : 'Lectura'}
          tone={canEdit ? 'success' : 'warning'}
        />
      </div>

      {!canEdit && (
        <Alert
          type="warning"
          showIcon
          title="Modo solo lectura"
          description="Solo usuarios autorizados pueden cambiar serie, perfiles o textos institucionales."
        />
      )}

      {error && (
        <Alert type="error" showIcon title="Error" description={error} />
      )}

      <Tabs
        defaultActiveKey="papel"
        destroyOnHidden={false}
        items={[
          {
            key: 'institucion',
            label: 'Institución',
            children: (
              <div className="min-w-0 space-y-6">
          <SectionCard
            title="Datos del recibo"
            description="Encabezado, ubicación y leyenda del documento institucional."
          >
            <form
              className="space-y-4"
              onSubmit={institutionForm.handleSubmit((data) =>
                institutionSavingRef.current
                  ? undefined
                  : (() => {
                      institutionSavingRef.current = true;
                      institutionMutation.mutate(data);
                    })(),
              )}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre del hospital" id="hospital_name" error={institutionForm.formState.errors.hospital_name?.message}>
                  <Controller name="hospital_name" control={institutionForm.control} render={({ field }) => <Input id="hospital_name" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="RTN si aplica" id="rtn">
                  <Controller name="rtn" control={institutionForm.control} render={({ field }) => <Input id="rtn" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Dependencia superior" id="government_line" hint="Déjelo en blanco si no existe un encabezado oficial.">
                  <Controller name="government_line" control={institutionForm.control} render={({ field }) => <Input id="government_line" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Secretaría o unidad" id="secretariat_line">
                  <Controller name="secretariat_line" control={institutionForm.control} render={({ field }) => <Input id="secretariat_line" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Ciudad o lugar" id="receipt_location" hint="No se completa automáticamente desde la dirección.">
                  <Controller name="receipt_location" control={institutionForm.control} render={({ field }) => <Input id="receipt_location" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Dirección o referencia" id="address">
                  <Controller name="address" control={institutionForm.control} render={({ field }) => <Input id="address" disabled={!canEdit} {...field} />} />
                </Field>
              </div>
              <Field label="Leyenda de copias o pie" id="receipt_footer_text">
                <Controller name="receipt_footer_text" control={institutionForm.control} render={({ field }) => <TextArea id="receipt_footer_text" disabled={!canEdit} {...field} />} />
              </Field>
              <div className="flex justify-end">
                <Button htmlType="submit" type="primary" loading={institutionMutation.isPending} disabled={!canEdit} icon={<SaveOutlined />}>
                  Guardar institución
                </Button>
              </div>
            </form>
          </SectionCard>
              </div>
            ),
          },
          {
            key: 'serie',
            label: 'Serie',
            children: (
              <div className="space-y-6">
          <SectionCard
            title="Serie y control fiscal"
            description="Rango, formato y correlativo actual del recibo institucional."
          >
            <form
              className="space-y-4"
              onSubmit={seriesForm.handleSubmit((data) =>
                seriesSavingRef.current
                  ? undefined
                  : (() => {
                      seriesSavingRef.current = true;
                      seriesMutation.mutate(data);
                    })(),
              )}
            >
              <Alert
                type="warning"
                showIcon
                title="Correlativo sensible"
                description="Cambie el correlativo solo con autorización documentada. No lo use para corregir recibos ya emitidos."
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Serie" id="series" error={seriesForm.formState.errors.series?.message}>
                  <Controller name="series" control={seriesForm.control} render={({ field }) => <Input id="series" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Prefijo" id="prefix" error={seriesForm.formState.errors.prefix?.message}>
                  <Controller name="prefix" control={seriesForm.control} render={({ field }) => <Input id="prefix" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Formato" id="number_format">
                  <Controller name="number_format" control={seriesForm.control} render={({ field }) => <Input id="number_format" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Número inicial" id="min_number">
                  <Controller name="min_number" control={seriesForm.control} render={({ field }) => <InputNumber id="min_number" disabled={!canEdit} className="w-full" {...field} />} />
                </Field>
                <Field label="Número final" id="max_number" error={seriesForm.formState.errors.max_number?.message}>
                  <Controller name="max_number" control={seriesForm.control} render={({ field }) => <InputNumber id="max_number" disabled={!canEdit} className="w-full" {...field} />} />
                </Field>
                <Field
                  label="Correlativo actual"
                  id="current_number"
                  error={seriesForm.formState.errors.current_number?.message}
                  hint="El próximo recibo usará este valor + 1."
                >
                  <Controller name="current_number" control={seriesForm.control} render={({ field }) => <InputNumber id="current_number" disabled={!canEdit} className="w-full" {...field} />} />
                </Field>
                <Field label="Color del número" id="receipt_number_color">
                  <Controller name="receipt_number_color" control={seriesForm.control} render={({ field }) => <Input id="receipt_number_color" type="color" disabled={!canEdit} {...field} />} />
                </Field>
                <Field label="Rango autorizado" id="range_authorization">
                  <Controller name="range_authorization" control={seriesForm.control} render={({ field }) => <Input id="range_authorization" disabled={!canEdit} {...field} />} />
                </Field>
                <div className="flex items-center gap-2 pt-7">
                  <Checkbox
                    id="active"
                    checked={seriesForm.watch('active')}
                    disabled={!canEdit}
                    onChange={(event) => seriesForm.setValue('active', event.target.checked)}
                  >
                    Serie activa
                  </Checkbox>
                </div>
              </div>
              <Field label="Texto legal del recibo" id="legal_text">
                <Controller name="legal_text" control={seriesForm.control} render={({ field }) => <TextArea id="legal_text" disabled={!canEdit} {...field} />} />
              </Field>
              <div className="flex justify-end">
                <Button htmlType="submit" type="primary" loading={seriesMutation.isPending} disabled={!canEdit} icon={<SaveOutlined />}>
                  Guardar serie
                </Button>
              </div>
            </form>
          </SectionCard>
              </div>
            ),
          },
          {
            key: 'papel',
            label: 'Papel y copias',
            children: (
              <div className="space-y-6">
          <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:items-start">
            <SectionCard
              title="Papel del recibo"
              description="El sistema ajusta márgenes, fuente y escala automáticamente."
            >
              <fieldset disabled={profileControlsDisabled} className="min-w-0 space-y-3">
                <legend className="text-sm font-semibold text-foreground">Formatos institucionales</legend>
                <Radio.Group
                  name="institutional-receipt-paper"
                  aria-label="Formatos institucionales: tipo de papel del recibo"
                  value={paper}
                  disabled={profileControlsDisabled}
                  onChange={(event) => setPaper(event.target.value as InstitutionalPaper)}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {PAPER_CHOICES.map((choice) => {
                    const selected = choice.value === paper;
                    return (
                      <Radio
                        key={choice.value}
                        value={choice.value}
                        className={`min-h-11 border p-3 text-left ${
                          selected
                            ? 'border-hospital-primary bg-hospital-primary/5'
                            : 'border-operational-border bg-operational-surface'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {choice.label}
                            {selected ? <CheckCircleOutlined aria-hidden="true" /> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {choice.description}
                          </span>
                          {selected ? <span className="mt-1 block text-xs font-semibold">Seleccionado</span> : null}
                        </span>
                      </Radio>
                    );
                  })}
                </Radio.Group>
              </fieldset>

              <fieldset className="mt-5 min-w-0 border border-dashed border-operational-border p-3">
                <legend className="px-1 text-sm font-semibold text-foreground">Formatos térmicos secundarios</legend>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Disponibles solo para compatibilidad secundaria; no reemplazan el recibo institucional.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {THERMAL_COMPATIBILITY_CHOICES.map((choice) => (
                    <li key={choice.value} className="min-h-11 border border-operational-border bg-muted/40 p-3">
                      <span className="text-sm font-semibold text-foreground">{choice.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {choice.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <form
                className="mt-5 space-y-4"
                onSubmit={profileForm.handleSubmit(async (data) => {
                  if (profileSavingRef.current) return;
                  if (canEditAdvanced && !(await advancedProfileForm.trigger())) return;
                  profileSavingRef.current = true;
                  profileMutation.mutate(data);
                })}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Copias" id="copies_mode">
                    <Select
                      id="copies_mode"
                      aria-label="Copias"
                      value={profileForm.watch('copies_mode')}
                      onChange={(value) => profileForm.setValue('copies_mode', value as ProfileFormData['copies_mode'])}
                      disabled={profileControlsDisabled}
                      options={[
                        { value: 'original_only', label: 'Solo original' },
                        { value: 'original_first', label: 'Original + primera copia' },
                        { value: 'original_first_second', label: 'Original + dos copias' },
                      ]}
                    />
                  </Field>
                  <CheckboxField
                    id="profile_show_seal_space"
                    label="Espacio para sello/firma"
                    checked={Boolean(profileForm.watch('show_physical_seal_space'))}
                    disabled={profileControlsDisabled}
                    onChange={(value) => profileForm.setValue('show_physical_seal_space', value === true)}
                  />
                  <CheckboxField
                    id="profile_use_logo"
                    label="Mostrar logo autorizado"
                    checked={Boolean(profileForm.watch('use_logo'))}
                    disabled={profileControlsDisabled}
                    onChange={(value) => profileForm.setValue('use_logo', value === true)}
                  />
                </div>

                {canEditAdvanced ? (
                  <Collapse
                    items={[{
                      key: 'advanced',
                      label: 'Ajustes técnicos avanzados',
                      children: (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {([
                            ['width_mm', 'Ancho mm'],
                            ['height_mm', 'Alto mm'],
                            ['margin_top_mm', 'Margen sup. (mm)'],
                            ['margin_right_mm', 'Margen der. (mm)'],
                            ['margin_bottom_mm', 'Margen inf. (mm)'],
                            ['margin_left_mm', 'Margen izq. (mm)'],
                          ] as const).map(([name, label]) => (
                            <Controller
                              key={name}
                              control={advancedProfileForm.control}
                              name={name}
                              render={({ field, fieldState }) => (
                                <Field id={`advanced_${name}`} label={label} error={fieldState.error?.message}>
                                  <InputNumber
                                    id={`advanced_${name}`}
                                    min={0}
                                    step={0.1}
                                    value={field.value}
                                    onBlur={field.onBlur}
                                    onChange={(value) => field.onChange(value ?? 0)}
                                    className="w-full"
                                  />
                                </Field>
                              )}
                            />
                          ))}
                          <Controller
                            control={advancedProfileForm.control}
                            name="orientation"
                            render={({ field }) => (
                              <Field id="advanced_orientation" label="Orientación">
                                <Select
                                  id="advanced_orientation"
                                  value={field.value}
                                  onChange={field.onChange}
                                  options={[
                                    { value: 'landscape', label: 'Horizontal' },
                                    { value: 'portrait', label: 'Vertical' },
                                  ]}
                                />
                              </Field>
                            )}
                          />
                          <Field id="advanced_font_family" label="Fuente" error={advancedProfileForm.formState.errors.font_family?.message}>
                            <Input id="advanced_font_family" {...advancedProfileForm.register('font_family')} />
                          </Field>
                          <Controller
                            control={advancedProfileForm.control}
                            name="font_scale"
                            render={({ field, fieldState }) => (
                              <Field id="advanced_font_scale" label="Escala" error={fieldState.error?.message}>
                                <InputNumber
                                  id="advanced_font_scale"
                                  min={0.5}
                                  max={2}
                                  step={0.05}
                                  value={field.value}
                                  onChange={(value) => field.onChange(value ?? 1)}
                                />
                              </Field>
                            )}
                          />
                          <div className="md:col-span-2 xl:col-span-3">
                            <Field id="advanced_support_reason" label="Motivo de soporte" error={advancedProfileForm.formState.errors.support_reason?.message}>
                              <TextArea id="advanced_support_reason" rows={3} {...advancedProfileForm.register('support_reason')} />
                            </Field>
                          </div>
                        </div>
                      ),
                    }]}
                  />
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button htmlType="button" disabled={profileControlsDisabled} loading={testPrintMutation.isPending} onClick={() => testPrintMutation.mutate()} icon={<PrinterOutlined />}>
                    Imprimir prueba
                  </Button>
                  <Button htmlType="submit" type="primary" loading={profileMutation.isPending} disabled={!canEdit || !selectedProfile} icon={<SaveOutlined />}>
                    Guardar perfil
                  </Button>
                </div>
              </form>
            </SectionCard>

            <div className="min-w-0">
              <ReceiptSettingsPreview
                hospitalName={institutionValues.hospital_name}
                governmentLine={institutionValues.government_line ?? ''}
                secretariatLine={institutionValues.secretariat_line ?? ''}
                location={institutionValues.receipt_location ?? ''}
                footerText={institutionValues.receipt_footer_text ?? ''}
                series={previewSeries}
                profile={previewProfile}
                paper={paper}
                draft
              />
            </div>
          </div>
              </div>
            ),
          },
          {
            key: 'vista',
            label: 'Vista previa',
            children: (
          <ReceiptSettingsPreview
            hospitalName={institutionValues.hospital_name}
            governmentLine={institutionValues.government_line ?? ''}
            secretariatLine={institutionValues.secretariat_line ?? ''}
            location={institutionValues.receipt_location ?? ''}
            footerText={institutionValues.receipt_footer_text ?? ''}
            series={previewSeries}
            profile={previewProfile}
            paper={paper}
            draft
          />
            ),
          },
        ]}
      />
    </>
  );
}

function advancedProfilePayload(values: AdvancedProfileFormData) {
  const decimal = (value: number) => value.toFixed(2);
  return {
    width_mm: decimal(values.width_mm),
    height_mm: decimal(values.height_mm),
    margin_top_mm: decimal(values.margin_top_mm),
    margin_right_mm: decimal(values.margin_right_mm),
    margin_bottom_mm: decimal(values.margin_bottom_mm),
    margin_left_mm: decimal(values.margin_left_mm),
    orientation: values.orientation,
    font_family: values.font_family,
    font_scale: decimal(values.font_scale),
    show_technical_fields: true,
    support_reason: values.support_reason,
  };
}

function Field({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <Form.Item
      label={label}
      htmlFor={id}
      validateStatus={error ? 'error' : undefined}
      help={error ?? hint}
      className="mb-0"
    >
      {children}
    </Form.Item>
  );
}

function CheckboxField({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 border border-operational-border bg-operational-panel p-3 text-sm">
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      >
        {label}
      </Checkbox>
    </div>
  );
}
