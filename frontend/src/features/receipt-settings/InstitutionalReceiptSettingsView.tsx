import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Printer, Save, Settings2 } from 'lucide-react';
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
import { PaperProfileSelector, SectionCard, StatCard, PermissionState } from '@/components/shared';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import { type InstitutionalReceiptSeries, type ReceiptPrintProfile, apiClient, userSafeErrorMessage } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { queryKeys } from '@/lib/queryKeys';

type InstitutionalReceiptSettingsViewProps = {
  canAdvancedPrintSettings: boolean;
  canEdit: boolean;
  onStatus: (message: string) => void;
};

type PaperProfileCode = 'carta' | 'media_carta' | 'a5' | '80mm' | '58mm';

const PAPER_LABELS: Record<PaperProfileCode, string> = {
  carta: 'Carta',
  media_carta: 'Media carta',
  a5: 'A5',
  '80mm': 'Ticket 80 mm',
  '58mm': 'Ticket 58 mm',
};

const RECEIPT_PROFILE_TO_PAPER: Record<string, PaperProfileCode> = {
  carta_horizontal: 'carta',
  media_carta_horizontal: 'media_carta',
  a5_horizontal: 'a5',
  thermal_80mm: '80mm',
  thermal_58mm: '58mm',
};

const PAPER_TO_RECEIPT_CODE: Record<PaperProfileCode, ReceiptPrintProfile['code']> = {
  carta: 'carta_horizontal',
  media_carta: 'media_carta_horizontal',
  a5: 'a5_horizontal',
  '80mm': 'thermal_80mm',
  '58mm': 'thermal_58mm',
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
  hospital_name: z.string().min(1, 'Requerido'),
  rtn: z.string().max(64).optional(),
  address: z.string().max(255).optional(),
  slogan: z.string().max(255).optional(),
  government_line: z.string().max(120).optional(),
  secretariat_line: z.string().max(160).optional(),
  receipt_location: z.string().max(160).optional(),
  receipt_footer_text: z.string().max(255).optional(),
});

const seriesSchema = z.object({
  series: z.string().min(1, 'Requerido'),
  prefix: z.string().min(1, 'Requerido'),
  number_format: z.string().min(1, 'Requerido'),
  min_number: z.number().int().min(1),
  max_number: z.number().int().min(1),
  current_number: z.number().int().min(0),
  range_authorization: z.string().max(120).optional(),
  legal_text: z.string().max(255).optional(),
  receipt_number_color: z.string().max(16),
  active: z.boolean(),
});

const profileSchema = z.object({
  copies_mode: z.enum(['original_only', 'original_first', 'original_first_second']),
  show_copy_legend: z.boolean(),
  show_physical_seal_space: z.boolean(),
  use_logo: z.boolean(),
  active: z.boolean(),
  is_global_default: z.boolean(),
});

const advancedSchema = z.object({
  width_mm: z.number().min(80).max(300),
  height_mm: z.number().min(50).max(220),
  margin_top_mm: z.number().min(0).max(50),
  margin_right_mm: z.number().min(0).max(50),
  margin_bottom_mm: z.number().min(0).max(50),
  margin_left_mm: z.number().min(0).max(50),
  font_family: z.string().max(120).nullable(),
  font_scale: z.number().min(0.7).max(1.3),
});

type InstitutionFormData = z.infer<typeof institutionSchema>;
type SeriesFormData = z.infer<typeof seriesSchema>;
type ProfileFormData = z.infer<typeof profileSchema>;
type AdvancedFormData = z.infer<typeof advancedSchema>;

function asMoney(value: string | number): string {
  return Number(value).toFixed(2);
}

export function InstitutionalReceiptSettingsView({
  canAdvancedPrintSettings,
  canEdit,
  onStatus,
}: InstitutionalReceiptSettingsViewProps) {
  const queryClient = useQueryClient();
  const [paper, setPaper] = useState<PaperProfileCode>('media_carta');
  const [selectedCode, setSelectedCode] = useState<string>('media_carta_horizontal');
  const [error, setError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSupported, setAdvancedSupported] = useState(false);
  const institutionSavingRef = useRef(false);
  const seriesSavingRef = useRef(false);
  const profileSavingRef = useRef(false);
  const advancedSavingRef = useRef(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.institutionalReceipts(),
    queryFn: () => apiClient.getInstitutionalReceiptSettings(),
  });

  const settings = settingsQuery.data;
  const activeSeries = settings?.active_series ?? settings?.series[0] ?? null;
  const selectedProfile = useMemo(
    () =>
      settings?.print_profiles.find((candidate) => candidate.code === selectedCode)
      ?? settings?.resolved_profile
      ?? null,
    [selectedCode, settings],
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
    resolver: zodResolver(profileSchema),
    defaultValues: PROFILE_FORM_DEFAULTS,
  });

  const advancedForm = useForm<AdvancedFormData>({
    resolver: zodResolver(advancedSchema),
    defaultValues: {
      width_mm: 215.9,
      height_mm: 139.7,
      margin_top_mm: 6,
      margin_right_mm: 6,
      margin_bottom_mm: 6,
      margin_left_mm: 6,
      font_family: 'Arial, sans-serif',
      font_scale: 1,
    },
  });

  useEffect(() => {
    if (!settings) return;

    const institution = settings.institution;
    institutionForm.reset({
      hospital_name: institution?.hospital_name ?? '',
      rtn: institution?.rtn ?? '',
      address: '',
      slogan: '',
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

    const resolvedCode = settings.resolved_profile?.code ?? 'media_carta_horizontal';
    const initialPaper = RECEIPT_PROFILE_TO_PAPER[resolvedCode] ?? 'media_carta';
    setPaper(initialPaper);
    setSelectedCode(resolvedCode);
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
    advancedForm.reset({
      width_mm: Number(selectedProfile.width_mm ?? 215.9),
      height_mm: Number(selectedProfile.height_mm ?? 139.7),
      margin_top_mm: Number(selectedProfile.margin_top_mm ?? 6),
      margin_right_mm: Number(selectedProfile.margin_right_mm ?? 6),
      margin_bottom_mm: Number(selectedProfile.margin_bottom_mm ?? 6),
      margin_left_mm: Number(selectedProfile.margin_left_mm ?? 6),
      font_family: selectedProfile.font_family ?? 'Arial, sans-serif',
      font_scale: Number(selectedProfile.font_scale ?? 1),
    });
    setAdvancedSupported(selectedProfile.code === 'recibo_pequeno_personalizado');
  }, [selectedProfile, profileForm, advancedForm]);

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
        ...payload,
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

  const advancedMutation = useMutation({
    mutationFn: (payload: AdvancedFormData) => {
      if (!selectedProfile) throw new Error('Seleccione un perfil de impresión.');
      return apiClient.updateReceiptPrintProfile(selectedProfile.id, {
        ...profileForm.watch(),
        width_mm: asMoney(payload.width_mm),
        height_mm: asMoney(payload.height_mm),
        margin_top_mm: asMoney(payload.margin_top_mm),
        margin_right_mm: asMoney(payload.margin_right_mm),
        margin_bottom_mm: asMoney(payload.margin_bottom_mm),
        margin_left_mm: asMoney(payload.margin_left_mm),
        font_family: payload.font_family,
        font_scale: asMoney(payload.font_scale),
        template_code: 'institutional_classic',
      });
    },
    onSuccess: async () => {
      await invalidate();
      onStatus('Ajustes avanzados del perfil guardados.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar el perfil avanzado.')),
    onSettled: () => {
      advancedSavingRef.current = false;
    },
  });

  const testPrintMutation = useMutation({
    mutationFn: () =>
      apiClient.testPrintInstitutionalReceipt({
        profile_code: PAPER_TO_RECEIPT_CODE[paper],
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
  const watchedAdvanced = advancedForm.watch();
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
  const previewProfile = ((): ReceiptPrintProfile | null => {
    if (!baseProfile) return null;
    if (!canAdvancedPrintSettings || !advancedOpen) return baseProfile;
    return {
      ...baseProfile,
      width_mm: asMoney(watchedAdvanced.width_mm),
      height_mm: asMoney(watchedAdvanced.height_mm),
      margin_top_mm: asMoney(watchedAdvanced.margin_top_mm),
      margin_right_mm: asMoney(watchedAdvanced.margin_right_mm),
      margin_bottom_mm: asMoney(watchedAdvanced.margin_bottom_mm),
      margin_left_mm: asMoney(watchedAdvanced.margin_left_mm),
      font_family: watchedAdvanced.font_family ?? null,
      font_scale: asMoney(watchedAdvanced.font_scale),
    };
  })();

  const copiesCount =
    watchedProfile.copies_mode === 'original_first_second'
      ? '3'
      : watchedProfile.copies_mode === 'original_first'
        ? '2'
        : '1';

  return (
    <>
      <PageHeader
        title="Recibos institucionales"
        description="Papel, copias, logo y firma. El sistema resuelve márgenes, CSS de impresión y fuente."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Papel"
          value={PAPER_LABELS[paper]}
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

      <Tabs defaultValue="papel" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max border border-operational-border bg-operational-panel p-1">
            <TabsTrigger value="institucion">Institución</TabsTrigger>
            <TabsTrigger value="serie">Serie</TabsTrigger>
            <TabsTrigger value="papel">Papel y copias</TabsTrigger>
            <TabsTrigger value="vista">Vista previa</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="institucion" className="space-y-6">
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
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <SectionCard
              title="Perfiles disponibles"
              description="Carta, media carta y A5 son los perfiles institucionales principales."
            >
              <div className="space-y-3">
                {(settings?.print_profiles ?? []).map((profile) => {
                  const paperCode = RECEIPT_PROFILE_TO_PAPER[profile.code];
                  const isActive = selectedCode === profile.code;
                  return (
                    <Button
                      key={profile.code}
                      type="button"
                      aria-pressed={isActive}
                      variant={isActive ? 'secondary' : 'outline'}
                      className="h-auto w-full justify-between gap-3 p-3 text-left"
                      onClick={() => {
                        setSelectedCode(profile.code);
                        if (paperCode) setPaper(paperCode);
                      }}
                    >
                      <span>{profile.code === 'recibo_pequeno_personalizado' ? 'Recibo pequeño personalizado' : PAPER_LABELS[paperCode as PaperProfileCode] ?? profile.code}</span>
                      <span className="text-xs font-normal">{profile.active ? 'Activo' : 'Disponible'}</span>
                    </Button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="Tipo de papel institucional"
              description="El hospital elige el papel. El sistema resuelve márgenes y CSS de impresión."
            >
              <PaperProfileSelector
                value={paper}
                onChange={(code) => {
                  setPaper(code);
                  const mapped = PAPER_TO_RECEIPT_CODE[code];
                  if (mapped) setSelectedCode(mapped);
                }}
                disabled={!canEdit}
                helperText="Los márgenes, la fuente y el layout se calculan automáticamente según el perfil seleccionado."
              />

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
                      disabled={!canEdit}
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
                    id="profile_show_copy_legend"
                    label="Leyenda de copias"
                    checked={Boolean(profileForm.watch('show_copy_legend'))}
                    disabled={!canEdit}
                    onChange={(value) => profileForm.setValue('show_copy_legend', value === true)}
                  />
                  <CheckboxField
                    id="profile_show_seal_space"
                    label="Espacio para sello/firma"
                    checked={Boolean(profileForm.watch('show_physical_seal_space'))}
                    disabled={!canEdit}
                    onChange={(value) => profileForm.setValue('show_physical_seal_space', value === true)}
                  />
                  <CheckboxField
                    id="profile_use_logo"
                    label="Mostrar logo autorizado"
                    checked={Boolean(profileForm.watch('use_logo'))}
                    disabled={!canEdit}
                    onChange={(value) => profileForm.setValue('use_logo', value === true)}
                  />
                  <CheckboxField
                    id="profile_active"
                    label="Perfil activo"
                    checked={Boolean(profileForm.watch('active'))}
                    disabled={!canEdit}
                    onChange={(value) => profileForm.setValue('active', value === true)}
                  />
                  <CheckboxField
                    id="profile_is_global_default"
                    label="Predeterminado global"
                    checked={Boolean(profileForm.watch('is_global_default'))}
                    disabled={!canEdit}
                    onChange={(value) => profileForm.setValue('is_global_default', value === true)}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={testPrintMutation.isPending} onClick={() => testPrintMutation.mutate()}>
                    <Printer className="size-4" data-icon aria-hidden="true" />
                    Imprimir prueba
                  </Button>
                  <Button type="submit" disabled={!canEdit || profileMutation.isPending}>
                    <Save className="size-4" data-icon aria-hidden="true" />
                    Guardar perfil
                  </Button>
                </div>
              </form>

              {canAdvancedPrintSettings && advancedSupported && (
                <details
                  id="receipt-advanced-panel"
                  className="mt-5 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer font-semibold text-warning-foreground">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      Modo soporte técnico
                    </span>
                  </summary>
                  <p className="mt-2 text-current/85">
                    Estos ajustes modifican medidas manuales del recibo pequeño personalizado. Documente el motivo antes de continuar; el cambio queda auditado.
                  </p>
                  {advancedOpen && (
                    <form
                      className="mt-4 space-y-4"
                      onSubmit={advancedForm.handleSubmit((data) =>
                        advancedSavingRef.current
                          ? undefined
                          : (() => {
                              advancedSavingRef.current = true;
                              advancedMutation.mutate(data);
                            })(),
                      )}
                    >
                      <div className="grid gap-4 md:grid-cols-4">
                        <Field label="Ancho mm" id="adv_width" hint="Solo recibo pequeño personalizado.">
                          <Input id="adv_width" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('width_mm', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Alto mm" id="adv_height" hint="Solo recibo pequeño personalizado.">
                          <Input id="adv_height" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('height_mm', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Fuente" id="adv_font_family">
                          <Input id="adv_font_family" disabled={!canEdit} {...advancedForm.register('font_family')} />
                        </Field>
                        <Field label="Escala" id="adv_font_scale">
                          <Input id="adv_font_scale" type="number" step="0.05" disabled={!canEdit} {...advancedForm.register('font_scale', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Margen sup. (mm)" id="adv_margin_top">
                          <Input id="adv_margin_top" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('margin_top_mm', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Margen der. (mm)" id="adv_margin_right">
                          <Input id="adv_margin_right" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('margin_right_mm', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Margen inf. (mm)" id="adv_margin_bottom">
                          <Input id="adv_margin_bottom" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('margin_bottom_mm', { valueAsNumber: true })} />
                        </Field>
                        <Field label="Margen izq. (mm)" id="adv_margin_left">
                          <Input id="adv_margin_left" type="number" step="0.01" disabled={!canEdit} {...advancedForm.register('margin_left_mm', { valueAsNumber: true })} />
                        </Field>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" variant="danger" disabled={!canEdit || advancedMutation.isPending}>
                          <Settings2 className="size-4" data-icon aria-hidden="true" />
                          Guardar ajustes avanzados
                        </Button>
                      </div>
                    </form>
                  )}
                </details>
              )}

              {canAdvancedPrintSettings && !advancedSupported && (
                <Alert title="Modo soporte no aplica aquí">
                  Los ajustes avanzados solo aplican al perfil personalizado de recibo pequeño.
                </Alert>
              )}

              {!canAdvancedPrintSettings && (
                <div className="mt-5">
                  <PermissionState
                    state="denied"
                    title="Ajustes avanzados restringidos"
                    description="Ajustes avanzados requieren permiso de soporte técnico."
                  />
                </div>
              )}

            </SectionCard>
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
