import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Printer, Save, Settings2 } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { InfoPanel, StatGrid } from '@/components/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import {
  type ReceiptInstitutionForm,
  type ReceiptProfileForm,
  type ReceiptSeriesForm,
  receiptInstitutionSchema,
  receiptProfileSchema,
  receiptSeriesSchema,
} from './receiptSettings.schema';
import {
  type ReceiptPrintProfile,
  type ReceiptProfileAssignment,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { queryKeys } from '@/lib/queryKeys';

type InstitutionalReceiptSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

const REQUIRED_PROFILE_CODES = [
  'recibo_pequeno_personalizado',
  'media_carta_horizontal',
  'a5_horizontal',
  'carta_horizontal',
] as const;

const PAPER_LABELS: Record<ReceiptPrintProfile['code'], string> = {
  recibo_pequeno_personalizado: 'Recibo pequeño personalizado',
  media_carta_horizontal: 'Media carta horizontal',
  a5_horizontal: 'A5 horizontal',
  carta_horizontal: 'Carta horizontal',
  thermal_80mm: 'Térmico 80 mm',
  thermal_58mm: 'Térmico 58 mm',
};

function asMoney(value: string | number): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function assignmentScopeLabel(scope: ReceiptProfileAssignment['scope_type']): string {
  if (scope === 'global') return 'Global';
  if (scope === 'user') return 'Usuario/cajero';
  return 'Sesión de caja';
}

function assignmentLabel(assignment: ReceiptProfileAssignment): string {
  const profileCode = assignment.print_profile?.code;
  const profileLabel = profileCode ? PAPER_LABELS[profileCode] : `Perfil #${assignment.receipt_print_profile_id}`;

  if (assignment.scope_type === 'global') {
    return `${assignmentScopeLabel(assignment.scope_type)} - ${profileLabel}`;
  }

  return `${assignmentScopeLabel(assignment.scope_type)} #${assignment.scope_id ?? '-'} - ${profileLabel}`;
}

function profileDefaults(profile: ReceiptPrintProfile | null): ReceiptProfileForm {
  return {
    width_mm: Number(profile?.width_mm ?? 215.9),
    height_mm: Number(profile?.height_mm ?? 139.7),
    margin_top_mm: Number(profile?.margin_top_mm ?? 6),
    margin_right_mm: Number(profile?.margin_right_mm ?? 6),
    margin_bottom_mm: Number(profile?.margin_bottom_mm ?? 6),
    margin_left_mm: Number(profile?.margin_left_mm ?? 6),
    font_family: profile?.font_family ?? 'Arial, sans-serif',
    font_scale: Number(profile?.font_scale ?? 1),
    copies_mode: profile?.copies_mode ?? 'original_only',
    show_copy_legend: profile?.show_copy_legend ?? true,
    show_physical_seal_space: profile?.show_physical_seal_space ?? true,
    use_logo: profile?.use_logo ?? false,
    active: profile?.active ?? false,
    is_global_default: profile?.is_global_default ?? false,
  };
}

export function InstitutionalReceiptSettingsView({ canEdit, onStatus }: InstitutionalReceiptSettingsViewProps) {
  const queryClient = useQueryClient();
  const [selectedProfileCode, setSelectedProfileCode] = useState<ReceiptPrintProfile['code']>('media_carta_horizontal');
  const [assignmentScope, setAssignmentScope] = useState<ReceiptProfileAssignment['scope_type']>('global');
  const [assignmentScopeId, setAssignmentScopeId] = useState('');
  const [assignmentProfileCode, setAssignmentProfileCode] = useState<ReceiptPrintProfile['code']>('media_carta_horizontal');
  const [error, setError] = useState('');

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.institutionalReceipts(),
    queryFn: () => apiClient.getInstitutionalReceiptSettings(),
  });

  const settings = settingsQuery.data;
  const selectedProfile = useMemo(
    () => settings?.print_profiles.find((profile) => profile.code === selectedProfileCode) ?? settings?.resolved_profile ?? null,
    [selectedProfileCode, settings],
  );
  const activeSeries = settings?.active_series ?? settings?.series[0] ?? null;

  const institutionForm = useForm<ReceiptInstitutionForm>({
    resolver: zodResolver(receiptInstitutionSchema),
    defaultValues: {
      hospital_name: '',
      rtn: '',
      address: '',
      slogan: '',
      government_line: '',
      secretariat_line: '',
      receipt_location: '',
      receipt_footer_text: '',
      receipt_template_mode: 'institutional',
    },
  });

  const seriesForm = useForm<ReceiptSeriesForm>({
    resolver: zodResolver(receiptSeriesSchema),
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
      reprint_behavior: 'audit_only',
      void_behavior: 'permission_reason_audit',
    },
  });

  const profileForm = useForm<ReceiptProfileForm>({
    resolver: zodResolver(receiptProfileSchema),
    defaultValues: profileDefaults(null),
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
      receipt_template_mode: 'institutional',
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
        reprint_behavior: activeSeries.reprint_behavior,
        void_behavior: activeSeries.void_behavior,
      });
    }

    const resolvedCode = settings.resolved_profile?.code ?? 'media_carta_horizontal';
    setSelectedProfileCode(resolvedCode);
    setAssignmentProfileCode(resolvedCode);
  }, [settings, activeSeries, institutionForm, seriesForm]);

  useEffect(() => {
    profileForm.reset(profileDefaults(selectedProfile));
  }, [selectedProfile, profileForm]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.settings.institutionalReceipts() });

  const institutionMutation = useMutation({
    mutationFn: (payload: ReceiptInstitutionForm) => apiClient.updateReceiptInstitution(payload),
    onSuccess: async () => {
      await invalidate();
      onStatus('Datos institucionales del recibo guardados.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar la institucion del recibo.')),
  });

  const seriesMutation = useMutation({
    mutationFn: (payload: ReceiptSeriesForm) => activeSeries
      ? apiClient.updateReceiptSeries(activeSeries.id, payload)
      : apiClient.storeReceiptSeries({ ...payload, document_type: 'institutional_receipt' }),
    onSuccess: async () => {
      await invalidate();
      onStatus('Serie y correlativo del recibo guardados.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar la serie del recibo.')),
  });

  const profileMutation = useMutation({
    mutationFn: (payload: ReceiptProfileForm) => {
      if (!selectedProfile) throw new Error('Seleccione un perfil de impresion.');
      return apiClient.updateReceiptPrintProfile(selectedProfile.id, {
        ...payload,
        width_mm: asMoney(payload.width_mm),
        height_mm: asMoney(payload.height_mm),
        margin_top_mm: asMoney(payload.margin_top_mm),
        margin_right_mm: asMoney(payload.margin_right_mm),
        margin_bottom_mm: asMoney(payload.margin_bottom_mm),
        margin_left_mm: asMoney(payload.margin_left_mm),
        font_scale: payload.font_scale.toFixed(2),
        template_code: 'institutional_classic',
      });
    },
    onSuccess: async () => {
      await invalidate();
      onStatus('Perfil de impresion del recibo guardado.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar el perfil de impresion.')),
  });

  const assignmentMutation = useMutation({
    mutationFn: () => apiClient.upsertReceiptProfileAssignment({
      profile_code: assignmentProfileCode,
      scope_type: assignmentScope,
      scope_id: assignmentScope === 'global' ? null : Number(assignmentScopeId),
      active: true,
    }),
    onSuccess: async () => {
      await invalidate();
      onStatus('Asignacion de perfil guardada.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo guardar la asignacion de perfil.')),
  });

  const testPrintMutation = useMutation({
    mutationFn: () => apiClient.testPrintInstitutionalReceipt({
      profile_code: selectedProfileCode,
      payer_name: 'Paciente de prueba',
      concept: 'Servicios hospitalarios de prueba',
      amount: '25.00',
    }),
    onSuccess: (blob) => {
      downloadBlob(blob, 'recibo-institucional-prueba.pdf');
      onStatus('PDF de prueba generado sin reservar correlativo.');
    },
    onError: (err) => setError(userSafeErrorMessage(err, 'No se pudo generar la impresion de prueba.')),
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

  const requiredProfiles = settings?.print_profiles.filter((profile) => REQUIRED_PROFILE_CODES.includes(profile.code as (typeof REQUIRED_PROFILE_CODES)[number])) ?? [];
  const institutionValues = institutionForm.watch();
  const seriesValues = seriesForm.watch();
  const previewSeries = activeSeries ? { ...activeSeries, ...seriesValues } : null;
  const watchedProfile = profileForm.watch();
  const previewProfile = selectedProfile ? {
    ...selectedProfile,
    width_mm: asMoney(watchedProfile.width_mm),
    height_mm: asMoney(watchedProfile.height_mm),
    margin_top_mm: asMoney(watchedProfile.margin_top_mm),
    margin_right_mm: asMoney(watchedProfile.margin_right_mm),
    margin_bottom_mm: asMoney(watchedProfile.margin_bottom_mm),
    margin_left_mm: asMoney(watchedProfile.margin_left_mm),
    font_family: watchedProfile.font_family ?? null,
    font_scale: watchedProfile.font_scale.toFixed(2),
    copies_mode: watchedProfile.copies_mode,
    show_copy_legend: watchedProfile.show_copy_legend,
    show_physical_seal_space: watchedProfile.show_physical_seal_space,
    use_logo: watchedProfile.use_logo,
    active: watchedProfile.active,
    is_global_default: watchedProfile.is_global_default,
  } : null;

  return (
    <>
      <PageHeader
        title="Recibos institucionales"
        description="Configuración del recibo clásico, serie, papel y copias para impresora normal."
      />

      <StatGrid
        className="sm:grid-cols-2 xl:grid-cols-4"
        items={[
          {
            label: 'Perfil resuelto',
            value: selectedProfile ? PAPER_LABELS[selectedProfile.code] : 'Pendiente',
            helper: selectedProfile ? `${selectedProfile.width_mm} x ${selectedProfile.height_mm} mm` : 'Sin perfil activo',
            tone: selectedProfile?.active ? 'success' : 'warning',
          },
          {
            label: 'Serie recibo',
            value: activeSeries?.series ?? 'Pendiente',
            helper: activeSeries ? `Próximo ${activeSeries.current_number + 1}` : 'Configure una serie institucional',
            tone: activeSeries?.active ? 'success' : 'warning',
          },
          {
            label: 'Copias',
            value: watchedProfile.copies_mode === 'original_first_second' ? '3' : watchedProfile.copies_mode === 'original_first' ? '2' : '1',
            helper: watchedProfile.show_copy_legend ? 'Leyenda visible' : 'Leyenda oculta',
            tone: 'info',
          },
          {
            label: 'Modo',
            value: canEdit ? 'Editable' : 'Lectura',
            helper: canEdit ? 'Cambios permitidos por permiso' : 'Sin permiso para guardar',
            tone: canEdit ? 'success' : 'warning',
          },
        ]}
      />

      <InfoPanel
        title="Documento principal en papel"
        description="Carta, media carta y A5 son los perfiles institucionales principales. Los formatos compactos quedan como compatibilidad secundaria."
        tone="info"
      />

      {!canEdit ? (
        <Alert variant="warning" title="Modo solo lectura">
          Solo usuarios autorizados pueden cambiar serie, perfiles o textos institucionales.
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs defaultValue="institucion" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max border border-operational-border bg-operational-panel p-1">
            <TabsTrigger value="institucion">Institución</TabsTrigger>
            <TabsTrigger value="serie">Serie</TabsTrigger>
            <TabsTrigger value="papel">Papel y copias</TabsTrigger>
            <TabsTrigger value="vista">Vista previa</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="institucion" className="space-y-6">
          <Card className="border-operational-border bg-operational-surface shadow-operational">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" data-icon aria-hidden="true" />
                Datos del recibo
              </CardTitle>
              <CardDescription>Encabezado, ubicación y leyenda configurable del documento institucional.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={institutionForm.handleSubmit((data) => institutionMutation.mutate(data))}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre del hospital" id="hospital_name" error={institutionForm.formState.errors.hospital_name?.message}>
                    <Input id="hospital_name" disabled={!canEdit} {...institutionForm.register('hospital_name')} />
                  </Field>
                  <Field label="RTN si aplica" id="rtn">
                    <Input id="rtn" disabled={!canEdit} {...institutionForm.register('rtn')} />
                  </Field>
                  <Field
                    label="Dependencia superior"
                    id="government_line"
                    hint="Déjelo en blanco si no existe un encabezado oficial configurado."
                  >
                    <Input id="government_line" disabled={!canEdit} {...institutionForm.register('government_line')} />
                  </Field>
                  <Field
                    label="Secretaría o unidad"
                    id="secretariat_line"
                    hint="Use solo el texto autorizado por administración."
                  >
                    <Input id="secretariat_line" disabled={!canEdit} {...institutionForm.register('secretariat_line')} />
                  </Field>
                  <Field
                    label="Ciudad o lugar"
                    id="receipt_location"
                    hint="No se completa automáticamente desde la dirección; configure el lugar real del recibo."
                  >
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
                    Guardar institucion
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="serie" className="space-y-6">
          <Card className="border-operational-border bg-operational-surface shadow-operational">
            <CardHeader>
              <CardTitle>Serie y control fiscal</CardTitle>
              <CardDescription>Rango, formato y correlativo actual del recibo institucional.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={seriesForm.handleSubmit((data) => seriesMutation.mutate(data))}>
                <Alert variant="warning" title="Correlativo sensible">
                  Cambie el correlativo actual solo con autorización documentada. No lo use para corregir recibos ya emitidos; anule o reimprima con auditoría.
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="papel" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardHeader>
                <CardTitle>Perfiles disponibles</CardTitle>
                <CardDescription>El principal recomendado es media carta horizontal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {requiredProfiles.map((profile) => (
                  <Button
                    key={profile.code}
                    type="button"
                    aria-pressed={selectedProfileCode === profile.code}
                    variant={selectedProfileCode === profile.code ? 'secondary' : 'outline'}
                    className="h-auto w-full justify-between gap-3 p-3 text-left"
                    onClick={() => setSelectedProfileCode(profile.code)}
                  >
                    <span>{PAPER_LABELS[profile.code]}</span>
                    <span className="text-xs font-normal">{profile.width_mm} x {profile.height_mm} mm</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="size-5" data-icon aria-hidden="true" />
                  Papel, margenes y copias
                </CardTitle>
                <CardDescription>{selectedProfile ? PAPER_LABELS[selectedProfile.code] : 'Seleccione un perfil'}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Field
                      label="Ancho mm"
                      id="width_mm"
                      hint={selectedProfile?.paper_kind === 'custom_mm'
                        ? 'Editable para recibo personalizado.'
                        : 'Los perfiles institucionales fijos usan medidas sembradas.'}
                    >
                      <Input id="width_mm" type="number" step="0.01" disabled={!canEdit || selectedProfile?.paper_kind !== 'custom_mm'} {...profileForm.register('width_mm', { valueAsNumber: true })} />
                    </Field>
                    <Field
                      label="Alto mm"
                      id="height_mm"
                      hint={selectedProfile?.paper_kind === 'custom_mm'
                        ? 'Editable para recibo personalizado.'
                        : 'Solo el perfil personalizado permite cambiar esta medida.'}
                    >
                      <Input id="height_mm" type="number" step="0.01" disabled={!canEdit || selectedProfile?.paper_kind !== 'custom_mm'} {...profileForm.register('height_mm', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Fuente" id="font_family">
                      <Input id="font_family" disabled={!canEdit} {...profileForm.register('font_family')} />
                    </Field>
                    <Field label="Escala" id="font_scale">
                      <Input id="font_scale" type="number" step="0.05" disabled={!canEdit} {...profileForm.register('font_scale', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Margen sup." id="margin_top_mm">
                      <Input id="margin_top_mm" type="number" step="0.01" disabled={!canEdit} {...profileForm.register('margin_top_mm', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Margen der." id="margin_right_mm">
                      <Input id="margin_right_mm" type="number" step="0.01" disabled={!canEdit} {...profileForm.register('margin_right_mm', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Margen inf." id="margin_bottom_mm">
                      <Input id="margin_bottom_mm" type="number" step="0.01" disabled={!canEdit} {...profileForm.register('margin_bottom_mm', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Margen izq." id="margin_left_mm">
                      <Input id="margin_left_mm" type="number" step="0.01" disabled={!canEdit} {...profileForm.register('margin_left_mm', { valueAsNumber: true })} />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Copias" id="copies_mode">
                      <Select
                        value={profileForm.watch('copies_mode')}
                        onValueChange={(value) => profileForm.setValue('copies_mode', value as ReceiptProfileForm['copies_mode'])}
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
                    {[
                      ['show_copy_legend', 'Leyenda de copias'],
                      ['show_physical_seal_space', 'Espacio para sello físico'],
                      ['use_logo', 'Usar logo autorizado'],
                      ['active', 'Perfil activo'],
                      ['is_global_default', 'Predeterminado global'],
                    ].map(([name, label]) => (
                      <label key={name} className="flex items-center gap-2 rounded-md border border-operational-border bg-operational-panel p-3 text-sm">
                        <Checkbox
                          checked={Boolean(profileForm.watch(name as keyof ReceiptProfileForm))}
                          disabled={!canEdit}
                          onCheckedChange={(value) => profileForm.setValue(name as keyof ReceiptProfileForm, value === true)}
                        />
                        {label}
                      </label>
                    ))}
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
              </CardContent>
            </Card>
          </div>

          <Card className="border-operational-border bg-operational-surface shadow-operational">
            <CardHeader>
              <CardTitle>Perfil por caja o usuario</CardTitle>
              <CardDescription>Si no hay asignación específica, se usa el perfil global institucional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="default" title="Asignación avanzada">
                Use asignaciones por usuario o sesión solo cuando operaciones haya identificado el ID correcto. Para la mayoría de cajas, el perfil global es suficiente.
              </Alert>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <Field label="Perfil" id="assignment_profile">
                  <Select value={assignmentProfileCode} onValueChange={(value) => setAssignmentProfileCode(value as ReceiptPrintProfile['code'])} disabled={!canEdit}>
                    <SelectTrigger id="assignment_profile"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {settings?.print_profiles.filter((profile) => profile.active).map((profile) => (
                        <SelectItem key={profile.code} value={profile.code}>{PAPER_LABELS[profile.code]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Alcance" id="assignment_scope">
                  <Select value={assignmentScope} onValueChange={(value) => setAssignmentScope(value as ReceiptProfileAssignment['scope_type'])} disabled={!canEdit}>
                    <SelectTrigger id="assignment_scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="user">Usuario/cajero</SelectItem>
                      <SelectItem value="cash_session">Sesión de caja</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="ID de alcance"
                  id="assignment_scope_id"
                  hint={assignmentScope === 'global' ? 'Global no requiere ID.' : 'Use el ID confirmado por administración; no adivine este valor.'}
                >
                  <Input
                    id="assignment_scope_id"
                    type="number"
                    value={assignmentScope === 'global' ? '' : assignmentScopeId}
                    onChange={(event) => setAssignmentScopeId(event.target.value)}
                    disabled={!canEdit || assignmentScope === 'global'}
                  />
                </Field>
                <Button
                  type="button"
                  disabled={!canEdit || assignmentMutation.isPending || (assignmentScope !== 'global' && !assignmentScopeId)}
                  onClick={() => assignmentMutation.mutate()}
                >
                  Guardar asignación
                </Button>
              </div>
              {settings?.assignments.length ? (
                <div className="rounded-panel border border-operational-border bg-operational-panel p-3">
                  <p className="text-sm font-semibold text-foreground">Asignaciones activas</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {settings.assignments.map((assignment) => (
                      <li key={assignment.id} className="break-words">
                        {assignmentLabel(assignment)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-panel border border-operational-border bg-operational-panel p-3 text-sm text-muted-foreground">
                  No hay asignaciones específicas. Se usará el perfil global activo.
                </p>
              )}
            </CardContent>
          </Card>
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
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
