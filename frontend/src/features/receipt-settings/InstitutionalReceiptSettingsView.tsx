import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Printer, Save } from 'lucide-react';
import { type ReactElement, ReactNode, cloneElement, isValidElement, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard, StatCard } from '@/components/shared';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import { type InstitutionalReceiptSeries, type ReceiptPrintProfile, apiClient, userSafeErrorMessage } from '@/lib/api';
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
  onStatus: (message: string) => void;
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

type InstitutionFormData = z.infer<typeof institutionSchema>;
type SeriesFormData = z.infer<typeof seriesSchema>;
type ProfileFormData = ReceiptProfileForm;
export function InstitutionalReceiptSettingsView({
  canEdit,
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
      receipt_number_color: '#b91c1c',
      active: true,
    },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(receiptProfileSchema),
    defaultValues: PROFILE_FORM_DEFAULTS,
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
  }, [selectedProfile, profileForm]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.institutionalReceipts() });

  const institutionMutation = useMutation({
    mutationFn: (payload: InstitutionFormData) => apiClient.updateReceiptInstitution(payload),
    onSuccess: async () => {
      await invalidate();
      onStatus('Datos institucionales del recibo guardados.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar la institución del recibo.')),
    onSettled: () => {
      institutionSavingRef.current = false;
    },
  });

  const seriesMutation = useMutation({
    mutationFn: (payload: SeriesFormData) =>
      activeSeries
        ? apiClient.updateReceiptSeries(activeSeries.id, payload)
        : apiClient.storeReceiptSeries({ ...payload, document_type: 'institutional_receipt' }),
    onSuccess: async () => {
      await invalidate();
      onStatus('Serie y correlativo del recibo guardados.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar la serie del recibo.')),
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
      });
    },
    onSuccess: async () => {
      await invalidate();
      onStatus('Perfil de impresión del recibo guardado.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar el perfil de impresión.')),
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
    onSuccess: (blob) => {
      downloadBlob(blob, 'recibo-institucional-prueba.pdf');
      onStatus('PDF de prueba generado sin reservar correlativo.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo generar la impresión de prueba.')),
  });

  if (settingsQuery.isLoading) {
    return <LoadingState label="Cargando ajustes de recibos..." />;
  }

  if (settingsQuery.isError) {
    return (
      <>
        <PageHeader
          title="Recibos institucionales"
          description="Configuración del recibo clásico, serie, papel y copias para impresora normal."
        />
        <Alert variant="destructive" title="No se pudieron cargar los ajustes de recibos">
          {userSafeErrorMessage(settingsQuery.error, 'Revise el servidor local y vuelva a intentar.')}
        </Alert>
        <Button type="button" variant="secondary" onClick={() => void settingsQuery.refetch()}>
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
        <Alert variant="warning" title="Modo solo lectura">
          Solo usuarios autorizados pueden cambiar serie, perfiles o textos institucionales.
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      )}

      <Tabs defaultValue="papel" className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-xl border border-operational-border bg-operational-surface p-2 shadow-operational lg:sticky lg:top-24 lg:overflow-visible">
          <p className="hidden px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:block">Configurar recibo</p>
          <TabsList className="min-w-max border-0 bg-transparent p-0 lg:flex lg:min-w-0 lg:flex-col lg:items-stretch lg:gap-1">
            <TabsTrigger value="institucion">Institución</TabsTrigger>
            <TabsTrigger value="serie">Serie</TabsTrigger>
            <TabsTrigger value="papel">Papel y copias</TabsTrigger>
            <TabsTrigger value="vista">Vista previa</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="institucion" className="mt-0 min-w-0 space-y-6">
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
                  <Input id="hospital_name" disabled={!canEdit} {...institutionForm.register('hospital_name')} />
                </Field>
                <Field label="RTN si aplica" id="rtn">
                  <Input id="rtn" disabled={!canEdit} {...institutionForm.register('rtn')} />
                </Field>
                <Field label="Dependencia superior" id="government_line" hint="Déjelo en blanco si no existe un encabezado oficial.">
                  <Input id="government_line" disabled={!canEdit} {...institutionForm.register('government_line')} />
                </Field>
                <Field label="Secretaría o unidad" id="secretariat_line">
                  <Input id="secretariat_line" disabled={!canEdit} {...institutionForm.register('secretariat_line')} />
                </Field>
                <Field label="Ciudad o lugar" id="receipt_location" hint="No se completa automáticamente desde la dirección.">
                  <Input id="receipt_location" disabled={!canEdit} {...institutionForm.register('receipt_location')} />
                </Field>
                <Field label="Dirección o referencia" id="address">
                  <Input id="address" disabled={!canEdit} {...institutionForm.register('address')} />
                </Field>
              </div>
              <Field label="Leyenda de copias o pie" id="receipt_footer_text">
                <Textarea id="receipt_footer_text" disabled={!canEdit} {...institutionForm.register('receipt_footer_text')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canEdit || institutionMutation.isPending}>
                  <Save className="size-4" data-icon aria-hidden="true" />
                  Guardar institución
                </Button>
              </div>
            </form>
          </SectionCard>
        </TabsContent>

        <TabsContent value="serie" className="space-y-6">
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
              <Alert variant="warning" title="Correlativo sensible">
                Cambie el correlativo solo con autorización documentada. No lo use para corregir recibos ya emitidos.
              </Alert>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Serie" id="series" error={seriesForm.formState.errors.series?.message}>
                  <Input id="series" disabled={!canEdit} {...seriesForm.register('series')} />
                </Field>
                <Field label="Prefijo" id="prefix" error={seriesForm.formState.errors.prefix?.message}>
                  <Input id="prefix" disabled={!canEdit} {...seriesForm.register('prefix')} />
                </Field>
                <Field label="Formato" id="number_format">
                  <Input id="number_format" disabled={!canEdit} {...seriesForm.register('number_format')} />
                </Field>
                <Field label="Número inicial" id="min_number">
                  <Input id="min_number" type="number" disabled={!canEdit} {...seriesForm.register('min_number', { valueAsNumber: true })} />
                </Field>
                <Field label="Número final" id="max_number" error={seriesForm.formState.errors.max_number?.message}>
                  <Input id="max_number" type="number" disabled={!canEdit} {...seriesForm.register('max_number', { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Correlativo actual"
                  id="current_number"
                  error={seriesForm.formState.errors.current_number?.message}
                  hint="El próximo recibo usará este valor + 1."
                >
                  <Input id="current_number" type="number" disabled={!canEdit} {...seriesForm.register('current_number', { valueAsNumber: true })} />
                </Field>
                <Field label="Color del número" id="receipt_number_color">
                  <Input id="receipt_number_color" type="color" disabled={!canEdit} {...seriesForm.register('receipt_number_color')} />
                </Field>
                <Field label="Rango autorizado" id="range_authorization">
                  <Input id="range_authorization" disabled={!canEdit} {...seriesForm.register('range_authorization')} />
                </Field>
                <div className="flex items-center gap-2 pt-7">
                  <Checkbox
                    id="active"
                    checked={seriesForm.watch('active')}
                    disabled={!canEdit}
                    onCheckedChange={(value) => seriesForm.setValue('active', value === true)}
                  />
                  <Label htmlFor="active">Serie activa</Label>
                </div>
              </div>
              <Field label="Texto legal del recibo" id="legal_text">
                <Textarea id="legal_text" disabled={!canEdit} {...seriesForm.register('legal_text')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canEdit || seriesMutation.isPending}>
                  <Save className="size-4" data-icon aria-hidden="true" />
                  Guardar serie
                </Button>
              </div>
            </form>
          </SectionCard>
        </TabsContent>

        <TabsContent value="papel" className="space-y-6">
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
            <SectionCard
              title="Papel del recibo"
              description="El sistema ajusta márgenes, fuente y escala automáticamente."
            >
              <fieldset disabled={profileControlsDisabled} className="min-w-0 space-y-3">
                <legend className="text-sm font-semibold text-foreground">Formatos institucionales</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PAPER_CHOICES.map((choice) => {
                    const selected = choice.value === paper;
                    return (
                      <label
                        key={choice.value}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-panel border p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                          selected
                            ? 'border-hospital-primary bg-hospital-primary/5 ring-1 ring-hospital-primary/40'
                            : 'border-operational-border bg-operational-surface'
                        } ${profileControlsDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name="institutional-receipt-paper"
                          value={choice.value}
                          checked={selected}
                          onChange={() => setPaper(choice.value)}
                          className="mt-0.5 size-5 shrink-0 accent-[var(--color-hospital-primary)]"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {choice.label}
                            {selected ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {choice.description}
                          </span>
                          {selected ? <span className="mt-1 block text-xs font-semibold">Seleccionado</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="mt-5 min-w-0 rounded-panel border border-dashed border-operational-border p-3">
                <legend className="px-1 text-sm font-semibold text-foreground">Compatibilidad térmica</legend>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Disponibles solo para compatibilidad secundaria; no reemplazan el recibo institucional.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {THERMAL_COMPATIBILITY_CHOICES.map((choice) => (
                    <li key={choice.value} className="min-h-11 rounded-md border border-operational-border bg-muted/40 p-3">
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
                onSubmit={profileForm.handleSubmit((data) =>
                  profileSavingRef.current
                    ? undefined
                    : (() => {
                        profileSavingRef.current = true;
                        profileMutation.mutate(data);
                      })(),
                )}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Copias" id="copies_mode">
                    <Select
                      value={profileForm.watch('copies_mode')}
                      onValueChange={(value) => profileForm.setValue('copies_mode', value as ProfileFormData['copies_mode'])}
                      disabled={profileControlsDisabled}
                    >
                      <SelectTrigger id="copies_mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original_only">Solo original</SelectItem>
                        <SelectItem value="original_first">Original + primera copia</SelectItem>
                        <SelectItem value="original_first_second">Original + dos copias</SelectItem>
                      </SelectContent>
                    </Select>
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

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={profileControlsDisabled || testPrintMutation.isPending} onClick={() => testPrintMutation.mutate()}>
                    <Printer className="size-4" data-icon aria-hidden="true" />
                    Imprimir prueba
                  </Button>
                  <Button type="submit" disabled={!canEdit || profileMutation.isPending || !selectedProfile}>
                    <Save className="size-4" data-icon aria-hidden="true" />
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
        </TabsContent>

        <TabsContent value="vista">
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
        </TabsContent>
      </Tabs>
    </>
  );
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
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  let control = children;

  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(child, {
      'aria-describedby': error || hint
        ? [child.props['aria-describedby'], hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')
        : child.props['aria-describedby'],
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
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
    <div className="flex items-center gap-2 rounded-md border border-operational-border bg-operational-panel p-3 text-sm">
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}
