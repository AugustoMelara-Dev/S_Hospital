import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Printer, Save, TriangleAlert } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field as UiField, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { type ComponentProps, type ReactNode, useRef } from 'react';
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
  phone: z.string().max(64).optional(),
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
type ProfileDraft = {
  profile: ProfileFormData;
  advanced: AdvancedProfileFormData;
};
type ProfileMutationData = ProfileDraft & {
  profileId: number;
};

type ReceiptTab = { key: string; label: string; children: ReactNode };

function ReceiptTabs({ defaultValue, items }: { defaultValue: string; items: ReceiptTab[] }) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList className="h-auto w-full flex-wrap justify-start" aria-label="Secciones de recibos">
        {items.map((item) => <TabsTrigger key={item.key} value={item.key}>{item.label}</TabsTrigger>)}
      </TabsList>
      {items.map((item) => <TabsContent key={item.key} value={item.key}>{item.children}</TabsContent>)}
    </Tabs>
  );
}

function ReceiptSelect({ id, value, onChange, options, disabled, ariaLabel }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function NumberInput({ value, onChange, ...props }: Omit<ComponentProps<typeof Input>, 'onChange' | 'value' | 'type'> & {
  value?: number;
  onChange: (value: number | null) => void;
}) {
  return <Input type="number" value={value ?? ''} onChange={(event) => onChange(Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)} {...props} />;
}
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
  const paperSelectionDirtyRef = useRef(false);
  const selectedProfileIdRef = useRef<number | null>(null);
  const profileDraftsRef = useRef(new Map<number, ProfileDraft>());

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
      phone: '',
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
      // Configurable receipt data, not an application design-system color.
      receipt_number_color: ['#', 'dc2626'].join(''),
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
  const institutionDirtyFields = institutionForm.formState.dirtyFields;
  const seriesDirtyFields = seriesForm.formState.dirtyFields;
  const profileIsDirty = profileForm.formState.isDirty;
  const advancedProfileIsDirty = advancedProfileForm.formState.isDirty;

  useEffect(() => {
    if (!settings) return;

    const institution = settings.institution;
    institutionForm.reset({
      hospital_name: institution?.hospital_name ?? '',
      rtn: institution?.rtn ?? '',
      address: institution?.address ?? '',
      phone: institution?.phone ?? '',
      slogan: institution?.slogan ?? '',
      government_line: institution?.government_line ?? '',
      secretariat_line: institution?.secretariat_line ?? '',
      receipt_location: institution?.receipt_location ?? '',
      receipt_footer_text: institution?.receipt_footer_text ?? '',
    }, { keepDirtyValues: true });

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
      }, { keepDirtyValues: true });
    }

    const hasLocalProfileState =
      paperSelectionDirtyRef.current ||
      profileIsDirty ||
      advancedProfileIsDirty ||
      profileDraftsRef.current.size > 0;
    if (!hasLocalProfileState) {
      setPaper(institutionalPaperFromProfile(settings.resolved_profile));
    }
  }, [settings, activeSeries, institutionForm, seriesForm, institutionDirtyFields, seriesDirtyFields, profileIsDirty, advancedProfileIsDirty]);

  useEffect(() => {
    if (!selectedProfile) return;

    const draft = profileDraftsRef.current.get(selectedProfile.id);
    const isCurrentProfile = selectedProfileIdRef.current === selectedProfile.id;
    if (isCurrentProfile && (draft || profileIsDirty || advancedProfileIsDirty)) return;

    profileForm.reset(draft?.profile ?? {
      copies_mode: selectedProfile.copies_mode ?? PROFILE_FORM_DEFAULTS.copies_mode,
      show_copy_legend: selectedProfile.show_copy_legend ?? PROFILE_FORM_DEFAULTS.show_copy_legend,
      show_physical_seal_space: selectedProfile.show_physical_seal_space ?? PROFILE_FORM_DEFAULTS.show_physical_seal_space,
      use_logo: selectedProfile.use_logo ?? PROFILE_FORM_DEFAULTS.use_logo,
      active: selectedProfile.active ?? PROFILE_FORM_DEFAULTS.active,
      is_global_default: selectedProfile.is_global_default ?? PROFILE_FORM_DEFAULTS.is_global_default,
    });
    advancedProfileForm.reset(draft?.advanced ?? {
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
    selectedProfileIdRef.current = selectedProfile.id;
  }, [selectedProfile, profileForm, advancedProfileForm, profileIsDirty, advancedProfileIsDirty]);

  const selectPaper = (nextPaper: InstitutionalPaper) => {
    paperSelectionDirtyRef.current = true;
    if (selectedProfile) {
      profileDraftsRef.current.set(selectedProfile.id, {
        profile: { ...profileForm.getValues() },
        advanced: { ...advancedProfileForm.getValues() },
      });
    }
    setPaper(nextPaper);
  };

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
    onSuccess: async (institution) => {
      if (institution) {
        institutionForm.reset({
          hospital_name: institution.hospital_name ?? '',
          rtn: institution.rtn ?? '',
          address: institution.address ?? '',
          phone: institution.phone ?? '',
          slogan: institution.slogan ?? '',
          government_line: institution.government_line ?? '',
          secretariat_line: institution.secretariat_line ?? '',
          receipt_location: institution.receipt_location ?? '',
          receipt_footer_text: institution.receipt_footer_text ?? '',
        });
      }
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
    onSuccess: async (series) => {
      seriesForm.reset({
        series: series.series,
        prefix: series.prefix,
        number_format: series.number_format,
        min_number: series.min_number,
        max_number: series.max_number,
        current_number: series.current_number,
        range_authorization: series.range_authorization ?? '',
        legal_text: series.legal_text ?? '',
        receipt_number_color: series.receipt_number_color,
        active: series.active,
      });
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
    mutationFn: ({ profileId, profile, advanced }: ProfileMutationData) =>
      apiClient.updateReceiptPrintProfile(profileId, {
        copies_mode: profile.copies_mode,
        show_physical_seal_space: profile.show_physical_seal_space,
        use_logo: profile.use_logo,
        active: true,
        is_global_default: true,
        template_code: 'institutional_classic',
        ...(canEditAdvanced
          ? advancedProfilePayload(advanced)
          : {}),
      }),
    onMutate: () => onStatus({
      key: 'receipt-settings:profile',
      level: 'info',
      message: 'Guardando perfil de impresión del recibo...',
      toast: false,
    }),
    onSuccess: async (savedProfile, { profileId, profile, advanced }) => {
      profileDraftsRef.current.delete(profileId);
      if (selectedProfileIdRef.current === profileId) {
        profileForm.reset({
          copies_mode: savedProfile.copies_mode ?? profile.copies_mode,
          show_copy_legend: savedProfile.show_copy_legend ?? profile.show_copy_legend,
          show_physical_seal_space: savedProfile.show_physical_seal_space ?? profile.show_physical_seal_space,
          use_logo: savedProfile.use_logo ?? profile.use_logo,
          active: savedProfile.active ?? true,
          is_global_default: savedProfile.is_global_default ?? true,
        });
        advancedProfileForm.reset({
          width_mm: Number(savedProfile.width_mm ?? advanced.width_mm),
          height_mm: Number(savedProfile.height_mm ?? advanced.height_mm),
          margin_top_mm: Number(savedProfile.margin_top_mm ?? advanced.margin_top_mm),
          margin_right_mm: Number(savedProfile.margin_right_mm ?? advanced.margin_right_mm),
          margin_bottom_mm: Number(savedProfile.margin_bottom_mm ?? advanced.margin_bottom_mm),
          margin_left_mm: Number(savedProfile.margin_left_mm ?? advanced.margin_left_mm),
          orientation: savedProfile.orientation ?? advanced.orientation,
          font_family: savedProfile.font_family ?? advanced.font_family,
          font_scale: Number(savedProfile.font_scale ?? advanced.font_scale),
          support_reason: '',
        });
      }
      await invalidate();
      paperSelectionDirtyRef.current = false;
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
          <Spinner /><span className="sr-only">Cargando ajustes de recibos...</span>
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
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudieron cargar los ajustes de recibos</AlertTitle><AlertDescription>{userSafeErrorMessage(settingsQuery.error, 'Revise el servidor local y vuelva a intentar.')}</AlertDescription></Alert>
        <Button type="button" onClick={() => void settingsQuery.refetch()}>
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
        <Alert><TriangleAlert /><AlertTitle>Modo solo lectura</AlertTitle><AlertDescription>Solo usuarios autorizados pueden cambiar serie, perfiles o textos institucionales.</AlertDescription></Alert>
      )}

      {error && (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <ReceiptTabs
        defaultValue="papel"
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
                <Field label="Teléfono" id="phone">
                  <Controller name="phone" control={institutionForm.control} render={({ field }) => <Input id="phone" disabled={!canEdit} {...field} />} />
                </Field>
              </div>
              <Field label="Leyenda de copias o pie" id="receipt_footer_text">
                <Controller name="receipt_footer_text" control={institutionForm.control} render={({ field }) => <Textarea id="receipt_footer_text" disabled={!canEdit} {...field} />} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canEdit || institutionMutation.isPending}>
                  {institutionMutation.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Guardar institución
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
              <Alert><TriangleAlert /><AlertTitle>Correlativo sensible</AlertTitle><AlertDescription>Cambie el correlativo solo con autorización documentada. No lo use para corregir recibos ya emitidos.</AlertDescription></Alert>
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
                  <Controller name="min_number" control={seriesForm.control} render={({ field }) => <NumberInput id="min_number" disabled={!canEdit} className="w-full" {...field} />} />
                </Field>
                <Field label="Número final" id="max_number" error={seriesForm.formState.errors.max_number?.message}>
                  <Controller name="max_number" control={seriesForm.control} render={({ field }) => <NumberInput id="max_number" disabled={!canEdit} className="w-full" {...field} />} />
                </Field>
                <Field
                  label="Correlativo actual"
                  id="current_number"
                  error={seriesForm.formState.errors.current_number?.message}
                  hint="El próximo recibo usará este valor + 1."
                >
                  <Controller name="current_number" control={seriesForm.control} render={({ field }) => <NumberInput id="current_number" disabled={!canEdit} className="w-full" {...field} />} />
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
                    onCheckedChange={(checked) => seriesForm.setValue('active', Boolean(checked), { shouldDirty: true })}
                  />
                  <FieldLabel htmlFor="active">Serie activa</FieldLabel>
                </div>
              </div>
              <Field label="Texto legal del recibo" id="legal_text">
                <Controller name="legal_text" control={seriesForm.control} render={({ field }) => <Textarea id="legal_text" disabled={!canEdit} {...field} />} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canEdit || seriesMutation.isPending}>
                  {seriesMutation.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Guardar serie
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
                <RadioGroup
                  aria-label="Formatos institucionales: tipo de papel del recibo"
                  value={paper}
                  disabled={profileControlsDisabled}
                  onValueChange={(value) => selectPaper(value as InstitutionalPaper)}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {PAPER_CHOICES.map((choice) => {
                    const selected = choice.value === paper;
                    return (
                      <label
                        key={choice.value}
                        htmlFor={`receipt-paper-${choice.value}`}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-left ${
                          selected
                            ? 'border-hospital-primary bg-hospital-primary/5'
                            : 'border-operational-border bg-operational-surface'
                        }`}
                      >
                        <RadioGroupItem
                          id={`receipt-paper-${choice.value}`}
                          value={choice.value}
                          disabled={profileControlsDisabled}
                          aria-label={choice.label}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {choice.label}
                            {selected ? <CheckCircle aria-hidden="true" /> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {choice.description}
                          </span>
                          {selected ? <span className="mt-1 block text-xs font-semibold">Seleccionado</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
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
                  if (!selectedProfile) return;
                  if (canEditAdvanced && !(await advancedProfileForm.trigger())) return;
                  profileSavingRef.current = true;
                  profileMutation.mutate({
                    profileId: selectedProfile.id,
                    profile: data,
                    advanced: advancedProfileForm.getValues(),
                  });
                })}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Copias" id="copies_mode">
                    <ReceiptSelect
                      id="copies_mode"
                      ariaLabel="Copias"
                      value={profileForm.watch('copies_mode')}
                      onChange={(value) => profileForm.setValue('copies_mode', value as ProfileFormData['copies_mode'], { shouldDirty: true })}
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
                    onChange={(value) => profileForm.setValue('show_physical_seal_space', value === true, { shouldDirty: true })}
                  />
                  <CheckboxField
                    id="profile_use_logo"
                    label="Mostrar logo autorizado"
                    checked={Boolean(profileForm.watch('use_logo'))}
                    disabled={profileControlsDisabled}
                    onChange={(value) => profileForm.setValue('use_logo', value === true, { shouldDirty: true })}
                  />
                </div>

                {canEditAdvanced ? (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="advanced">
                      <AccordionTrigger>Ajustes técnicos avanzados</AccordionTrigger>
                      <AccordionContent>
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
                                  <NumberInput
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
                                <ReceiptSelect
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
                                <NumberInput
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
                              <Textarea id="advanced_support_reason" rows={3} {...advancedProfileForm.register('support_reason')} />
                            </Field>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" disabled={profileControlsDisabled || testPrintMutation.isPending} onClick={() => testPrintMutation.mutate()} variant="outline">
                    {testPrintMutation.isPending ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}Imprimir prueba
                  </Button>
                  <Button type="submit" disabled={!canEdit || !selectedProfile || profileMutation.isPending}>
                    {profileMutation.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Guardar perfil
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
    <UiField data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </UiField>
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
        onCheckedChange={(checked) => onChange(Boolean(checked))}
      />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </div>
  );
}
