import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2Icon, PrinterIcon, SaveIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  AdminCallout,
  AdminPanel,
  AdminPanelHeader,
} from '@/design-system/admin/components';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import { ReceiptSeriesSection } from './components/ReceiptSeriesSection';
import { ReceiptPaperChoices } from './components/ReceiptPaperChoices';
import { ReceiptAdvancedSettingsSection } from './components/ReceiptAdvancedSettingsSection';
import { Field } from './components/ReceiptSettingsControls';
import {
  COPIES_MODE_OPTIONS,
  copiesModeLabel,
  describeUnknownCopiesMode,
  normalizeCopiesMode,
} from './copiesMode';
import {
  useReceiptEnginePreview,
  type ReceiptEngineDraft,
} from './useReceiptEnginePreview';
import { type InstitutionalReceiptSettings, type ReceiptPrintProfile, apiClient, userSafeErrorMessage } from '@/lib/api';
import type { InstitutionalReceiptTemplateCode } from '@/lib/api/types';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { downloadBlob } from '@/lib/download';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { queryKeys } from '@/lib/queryKeys';
import {
  institutionalPaperFromProfile,
  paperProfileCode,
  type InstitutionalPaper,
} from '@/modules/receipts/paperPolicy';
import {
  receiptProfileSchema,
  seriesSchema,
  advancedProfileSchema,
  type SeriesFormData,
  type AdvancedProfileFormData,
  type ReceiptProfileForm,
} from './receiptSettings.schema';
import {
  CHECKBOX_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SELECT_CLASS,
} from './receiptAdminUi';

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

type ProfileFormData = ReceiptProfileForm;
type ProfileDraft = {
  profile: ProfileFormData;
  advanced: AdvancedProfileFormData;
};
type ProfileMutationData = ProfileDraft & {
  profileId: number;
  includeAdvanced: boolean;
  /**
   * Plantilla vigente del perfil que se esta editando. Persistir el valor del
   * perfil (no un literal fijo) conserva `institutional_compact` y no degrada
   * a `institutional_classic` los perfiles del perfil de entrega nuevo.
   */
  templateCode: InstitutionalReceiptTemplateCode;
};

const DEFAULT_TEMPLATE_CODE: InstitutionalReceiptTemplateCode = 'institutional_classic';

export function InstitutionalReceiptSettingsView({
  canEdit,
  canEditAdvanced = false,
  onStatus,
}: InstitutionalReceiptSettingsViewProps) {
  const queryClient = useQueryClient();
  const [paper, setPaper] = useState<InstitutionalPaper>('half_letter');
  const [error, setError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const seriesSavingRef = useRef(false);
  const profileSavingRef = useRef(false);
  const paperSelectionDirtyRef = useRef(false);
  const selectedProfileIdRef = useRef<number | null>(null);
  const profileDraftsRef = useRef(new Map<number, ProfileDraft>());
  // Raw persisted `copies_mode` when it is not part of the known enum. Kept so
  // the control can show it explicitly and the operator gets a recoverable
  // error instead of an empty Select.
  const [unknownCopiesMode, setUnknownCopiesMode] = useState<unknown>(null);

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
  const seriesHasDirtyFields = Object.keys(seriesForm.formState.dirtyFields).length > 0;
  const profileIsDirty = profileForm.formState.isDirty;
  const advancedProfileIsDirty = advancedProfileForm.formState.isDirty;
  // Subscribe even while the advanced fields are collapsed and pristine, so
  // validation errors remain available when the support panel first opens.
  const advancedProfileErrors = advancedProfileForm.formState.errors;

  const watchedProfile = profileForm.watch();
  const watchedAdvancedProfile = advancedProfileForm.watch();
  const hasUnsavedChanges = profileIsDirty || advancedProfileIsDirty;
  useUnsavedChangesGuard(seriesForm.formState.isDirty || hasUnsavedChanges);
  const normalizedWatchedCopies = normalizeCopiesMode(watchedProfile.copies_mode);

  // The real engine preview consumes the validated draft. Advanced geometry is
  // only included when the advanced form changed AND is valid; otherwise the
  // engine keeps the stored values (identical to what the user sees).
  const advancedDraftIncluded =
    canEditAdvanced &&
    advancedProfileIsDirty &&
    Object.keys(advancedProfileErrors).length === 0;
  const advancedDraftBlocked =
    canEditAdvanced && advancedProfileIsDirty && !advancedDraftIncluded;
  const draftProfile: ReceiptEngineDraft | null = (() => {
    if (!selectedProfile || !hasUnsavedChanges || advancedDraftBlocked) return null;

    const decimal = (value: number) => value.toFixed(2);
    const draft: ReceiptEngineDraft = {
      show_copy_legend: watchedProfile.show_copy_legend,
      show_physical_seal_space: watchedProfile.show_physical_seal_space,
      use_logo: watchedProfile.use_logo,
      active: watchedProfile.active,
      is_global_default: watchedProfile.is_global_default,
    };

    if (normalizedWatchedCopies) {
      draft.copies_mode = normalizedWatchedCopies;
    }

    if (advancedDraftIncluded) {
      draft.orientation = watchedAdvancedProfile.orientation;
      draft.width_mm = decimal(watchedAdvancedProfile.width_mm);
      draft.height_mm = decimal(watchedAdvancedProfile.height_mm);
      draft.margin_top_mm = decimal(watchedAdvancedProfile.margin_top_mm);
      draft.margin_right_mm = decimal(watchedAdvancedProfile.margin_right_mm);
      draft.margin_bottom_mm = decimal(watchedAdvancedProfile.margin_bottom_mm);
      draft.margin_left_mm = decimal(watchedAdvancedProfile.margin_left_mm);
      draft.font_family = watchedAdvancedProfile.font_family;
      draft.font_scale = decimal(watchedAdvancedProfile.font_scale);
      draft.show_technical_fields = true;
    }

    return draft;
  })();

  // Single source of the copy count: the same engine query the preview consumes.
  // `—` while it is unknown; never a locally invented 1.
  const enginePreview = useReceiptEnginePreview({
    profileCode: selectedProfile?.code ?? null,
    draft: draftProfile,
  });
  const engineDocument = enginePreview.data?.document ?? null;

  useEffect(() => {
    if (!settings) return;

    if (activeSeries && !seriesHasDirtyFields) {
      seriesForm.reset({
        series: activeSeries.series,
        prefix: activeSeries.prefix,
        number_format: activeSeries.number_format,
        min_number: activeSeries.min_number,
        max_number: activeSeries.max_number,
        current_number: activeSeries.current_number,
        range_authorization: activeSeries.range_authorization ?? '',
        legal_text: activeSeries.legal_text ?? '',
        active: activeSeries.active,
      });
    }

    const hasLocalProfileState =
      paperSelectionDirtyRef.current ||
      profileIsDirty ||
      advancedProfileIsDirty ||
      profileDraftsRef.current.size > 0;
    if (!hasLocalProfileState) {
      setPaper(institutionalPaperFromProfile(settings.resolved_profile));
    }
  }, [settings, activeSeries, seriesForm, seriesHasDirtyFields, profileIsDirty, advancedProfileIsDirty]);

  useEffect(() => {
    if (!selectedProfile) return;

    const draft = profileDraftsRef.current.get(selectedProfile.id);
    const isCurrentProfile = selectedProfileIdRef.current === selectedProfile.id;
    if (isCurrentProfile && (draft || profileIsDirty || advancedProfileIsDirty)) return;

    const persistedCopiesMode = normalizeCopiesMode(selectedProfile.copies_mode);
    // A persisted value outside the enum must never reach the Select as an empty
    // control: surface it and fall back to a known value.
    setUnknownCopiesMode(persistedCopiesMode === null ? selectedProfile.copies_mode : null);

    profileForm.reset(draft?.profile ?? {
      copies_mode: persistedCopiesMode ?? PROFILE_FORM_DEFAULTS.copies_mode,
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings.institutionalReceipts() });
    await queryClient.invalidateQueries({ queryKey: ['receipt-settings-engine-preview'] });
  };

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
    mutationFn: ({ profileId, profile, advanced, includeAdvanced, templateCode }: ProfileMutationData) =>
      apiClient.updateReceiptPrintProfile(profileId, {
        copies_mode: profile.copies_mode,
        show_physical_seal_space: profile.show_physical_seal_space,
        use_logo: profile.use_logo,
        active: true,
        is_global_default: true,
        template_code: templateCode,
        ...(canEditAdvanced && includeAdvanced
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
      const savedCopiesMode = normalizeCopiesMode(savedProfile.copies_mode);
      setUnknownCopiesMode(savedCopiesMode === null && savedProfile.copies_mode != null ? savedProfile.copies_mode : null);
      if (selectedProfileIdRef.current === profileId) {
        profileForm.reset({
          copies_mode: savedCopiesMode ?? profile.copies_mode,
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
      <div className="flex flex-col gap-3">
        <AdminPanel as="section" aria-labelledby="receipt-settings-loading-title">
          <AdminPanelHeader
            id="receipt-settings-loading-title"
            headingLevel={2}
            title="Preparando ajustes de recibos"
            description="Papel, copias, logo y firma. El sistema prepara la impresión según el perfil seleccionado."
          />
          <div
            className="flex min-h-40 items-center justify-center gap-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink-soft)]"
            role="status"
            aria-label="Cargando ajustes de recibos..."
          >
            <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
            <span>Cargando ajustes de recibos...</span>
          </div>
        </AdminPanel>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="flex flex-col gap-3">
        <AdminPanel as="section" aria-labelledby="receipt-settings-error-title">
          <AdminPanelHeader
            id="receipt-settings-error-title"
            headingLevel={2}
            title="Recibos institucionales"
            description="Configuración del recibo clásico, serie, papel y copias para impresora normal."
          />
          <div className="p-4">
            <AdminCallout tone="error" title="No se pudieron cargar los ajustes de recibos">
              {userSafeErrorMessage(settingsQuery.error, 'Revise el servidor local y vuelva a intentar.')}
            </AdminCallout>
            <div className="mt-3">
              <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void settingsQuery.refetch()}>
                Reintentar
              </button>
            </div>
          </div>
        </AdminPanel>
      </div>
    );
  }

  const baseProfile = selectedProfile
    ? {
        ...selectedProfile,
        copies_mode: normalizedWatchedCopies ?? selectedProfile.copies_mode,
        show_copy_legend: watchedProfile.show_copy_legend,
        show_physical_seal_space: watchedProfile.show_physical_seal_space,
        use_logo: watchedProfile.use_logo,
        active: watchedProfile.active,
        is_global_default: watchedProfile.is_global_default,
      }
    : null;
  const previewProfile: ReceiptPrintProfile | null = baseProfile;

  // A persisted value outside the enum gets an explicit, selectable placeholder
  // so the control is never empty, plus a recoverable error below.
  const unknownCopiesModeValue = unknownCopiesMode === null ? null : String(unknownCopiesMode);
  const copiesSelectOptions = unknownCopiesModeValue === null
    ? COPIES_MODE_OPTIONS.map((option) => ({ value: option.value as string, label: option.label }))
    : [
        ...COPIES_MODE_OPTIONS.map((option) => ({ value: option.value as string, label: option.label })),
        { value: unknownCopiesModeValue, label: `No reconocido: ${unknownCopiesModeValue} (requiere corrección)` },
      ];
  const copiesSelectValue = unknownCopiesModeValue ?? normalizedWatchedCopies ?? PROFILE_FORM_DEFAULTS.copies_mode;

  const profileControlsDisabled = !canEdit || profileMutation.isPending;

  // C3-P2: the "before printing" text is the measured result of the generator, not
  // a page count derived from the number of copies. While the plan is not
  // available no figure is shown.
  const enginePrintSummary = engineDocument
    ? [engineDocument.headline, engineDocument.print_instruction, engineDocument.sheet_assumption]
        .filter((line): line is string => typeof line === 'string' && line !== '')
        .join(' ')
    : 'Preparando la vista previa del conjunto: el motor confirma las páginas del documento antes de imprimir.';

  return (
    <>
      <header className="border-b border-[var(--ui-line)] pb-3">
        <h2 className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">Recibos institucionales</h2>
        <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Prepare papel, copias y contenido para los próximos recibos.</p>
      </header>
      {!canEdit && (
        <AdminCallout tone="warn" title="Modo solo lectura">
          Solo usuarios autorizados pueden cambiar serie, perfiles o textos institucionales.
        </AdminCallout>
      )}

      {error && (
        <AdminCallout tone="error" title="Error">
          {error}
        </AdminCallout>
      )}

      <div className="flex flex-col gap-4">
          <ReceiptSeriesSection
            form={seriesForm}
            canEdit={canEdit}
            canEditAdvanced={canEditAdvanced}
            activeSeries={activeSeries}
            isSaving={seriesMutation.isPending}
            onSubmit={(data) => {
              if (seriesSavingRef.current) return;
              seriesSavingRef.current = true;
              seriesMutation.mutate(data);
            }}
          />
        <div>
          <div className="flex flex-col gap-4">
            <ReceiptProfileProvenance
              settings={settings}
              selectedProfile={selectedProfile}
              hasUnsavedChanges={hasUnsavedChanges}
              draftActive={draftProfile !== null}
            />
            <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-start">
              <AdminPanel as="section" aria-labelledby="receipt-paper-title">
                <AdminPanelHeader
                  headingLevel={2}
                  id="receipt-paper-title"
                  title="Papel del recibo"
                  description="El sistema ajusta márgenes, fuente y escala automáticamente."
                />
                <div className="p-4">
                  <ReceiptPaperChoices paper={paper} disabled={profileControlsDisabled} canEditAdvanced={canEditAdvanced} onSelectPaper={selectPaper} />

                  <form
                    className="mt-5 flex flex-col gap-4"
                    onSubmit={profileForm.handleSubmit(async (data) => {
                      if (profileSavingRef.current) return;
                      if (!selectedProfile) return;
                      // Activating the custom profile or making it the default is
                      // an advanced operation, even with unchanged geometry.
                      const requiresSupport = selectedProfile.code === paperProfileCode('custom');
                      if (requiresSupport && !canEditAdvanced) {
                        setError('El formato personalizado requiere autorización de soporte. Seleccione otro formato institucional.');
                        return;
                      }
                      const advanced = advancedProfileForm.getValues();
                      const includeAdvanced = canEditAdvanced && (requiresSupport || hasAdvancedProfileChanges(advanced, selectedProfile));
                      if (includeAdvanced && !(await advancedProfileForm.trigger())) {
                        setAdvancedOpen(true);
                        return;
                      }
                      profileSavingRef.current = true;
                      profileMutation.mutate({
                        profileId: selectedProfile.id,
                        profile: data,
                        advanced,
                        includeAdvanced,
                        templateCode: selectedProfile.template_code ?? DEFAULT_TEMPLATE_CODE,
                      });
                    })}
                  >
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Copias" id="copies_mode">
                        <select
                          id="copies_mode"
                          className={SELECT_CLASS}
                          value={copiesSelectValue}
                          disabled={profileControlsDisabled}
                          onChange={(event) => {
                            const value = event.target.value;
                            // The unknown placeholder is informational: it cannot be
                            // selected. A valid choice clears the recoverable error.
                            if (unknownCopiesModeValue !== null && value === unknownCopiesModeValue) return;
                            const normalized = normalizeCopiesMode(value);
                            if (!normalized) return;
                            setUnknownCopiesMode(null);
                            profileForm.setValue('copies_mode', normalized, { shouldDirty: true });
                          }}
                        >
                          {copiesSelectOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={unknownCopiesModeValue !== null && option.value === unknownCopiesModeValue}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
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

                    {unknownCopiesMode !== null ? (
                      <div data-testid="receipt-copies-mode-error">
                        <AdminCallout tone="error" title="Modo de copias no reconocido">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                              El perfil guardado {describeUnknownCopiesMode(unknownCopiesMode)}. El motor no puede
                              confirmar cuántas páginas generará. Elija un valor válido.
                            </span>
                            <button
                              type="button"
                              data-ui-press
                              className={SECONDARY_BUTTON}
                              disabled={profileControlsDisabled}
                              onClick={() => {
                                setUnknownCopiesMode(null);
                                profileForm.setValue('copies_mode', PROFILE_FORM_DEFAULTS.copies_mode, { shouldDirty: true });
                              }}
                            >
                              Usar «{copiesModeLabel('original_only')}»
                            </button>
                          </div>
                        </AdminCallout>
                      </div>
                    ) : null}

                    {advancedDraftBlocked ? (
                      <div data-receipt-draft-invalid>
                        <AdminCallout tone="warn" title="Borrador avanzado incompleto">
                          Corrija los ajustes técnicos avanzados para que la vista previa del borrador los aplique.
                          Mientras tanto se muestra el perfil guardado.
                        </AdminCallout>
                      </div>
                    ) : null}

                    {canEditAdvanced ? (
                      <ReceiptAdvancedSettingsSection
                        form={advancedProfileForm}
                        errors={advancedProfileErrors}
                        open={advancedOpen}
                        onToggle={() => setAdvancedOpen((current) => !current)}
                      />
                    ) : null}

                    <AdminCallout tone="info" title="Antes de imprimir">
                      {enginePrintSummary}
                    </AdminCallout>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        data-ui-press
                        className={SECONDARY_BUTTON}
                        disabled={profileControlsDisabled || testPrintMutation.isPending}
                        onClick={() => testPrintMutation.mutate()}
                      >
                        {testPrintMutation.isPending ? <Loader2Icon aria-hidden="true" className="size-4 animate-spin" /> : <PrinterIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />}Imprimir prueba
                      </button>
                      <button type="submit" data-ui-press className={PRIMARY_BUTTON} disabled={!canEdit || !selectedProfile || profileMutation.isPending}>
                        {profileMutation.isPending ? <Loader2Icon aria-hidden="true" className="size-4 animate-spin" /> : <SaveIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />}Guardar perfil
                      </button>
                    </div>
                  </form>
                </div>
              </AdminPanel>

              <div className="min-w-0">
                <ReceiptSettingsPreview
                  profile={previewProfile}
                  paper={paper}
                  draft
                  draftProfile={draftProfile}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function hasAdvancedProfileChanges(values: AdvancedProfileFormData, profile: ReceiptPrintProfile) {
  // Compare against persisted values: restoring a paper draft resets RHF's dirty
  // baseline, but must still require an audited reason for technical changes.
  const persisted = {
    width_mm: Number(profile.width_mm ?? 215.9),
    height_mm: Number(profile.height_mm ?? 139.7),
    margin_top_mm: Number(profile.margin_top_mm ?? 6),
    margin_right_mm: Number(profile.margin_right_mm ?? 6),
    margin_bottom_mm: Number(profile.margin_bottom_mm ?? 6),
    margin_left_mm: Number(profile.margin_left_mm ?? 6),
    orientation: profile.orientation ?? 'landscape',
    font_family: profile.font_family ?? 'Arial, sans-serif',
    font_scale: Number(profile.font_scale ?? 1),
  };
  return (Object.keys(persisted) as (keyof typeof persisted)[])
    .some((key) => values[key] !== persisted[key]);
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

/**
 * Explains which profile the engine will use for a NEW receipt and why. The
 * precedence is resolved by the server (session -> user -> global assignment ->
 * declared global default); this panel renders that decision instead of letting
 * two different client renderers guess it.
 */
function ReceiptProfileProvenance({
  settings,
  selectedProfile,
  hasUnsavedChanges,
  draftActive,
}: {
  settings: InstitutionalReceiptSettings | undefined;
  selectedProfile: ReceiptPrintProfile | null;
  hasUnsavedChanges: boolean;
  draftActive: boolean;
}) {
  const effective = settings?.resolved_profile ?? null;
  const effectiveCode = effective?.code ?? null;
  const matchingAssignment = (settings?.assignments ?? []).find(
    (assignment) => assignment.active && (assignment.print_profile?.code ?? '') === effectiveCode,
  ) ?? null;

  let reason: string;
  if (matchingAssignment) {
    reason = matchingAssignment.scope_type === 'cash_session'
      ? 'Asignación por sesión de caja'
      : matchingAssignment.scope_type === 'user'
        ? 'Asignación por usuario'
        : 'Asignación global';
  } else if (effective?.is_global_default) {
    reason = 'Predeterminado global';
  } else if (effective) {
    reason = 'Resolución del sistema (sin predeterminado declarado)';
  } else {
    reason = 'Sin perfil resuelto';
  }

  const editingDifferent = Boolean(selectedProfile && effective && selectedProfile.code !== effectiveCode);
  const editingState = draftActive
    ? 'Borrador sin guardar (vista previa real)'
    : hasUnsavedChanges
      ? 'Cambios sin validar'
      : 'Sin cambios';

  return (
    <section aria-labelledby="receipt-provenance-title" className="border-y border-[var(--ui-line)] py-3">
      <h3 id="receipt-provenance-title" className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">Perfil activo</h3>
      <div className="mt-3">
        <dl data-testid="receipt-profile-provenance" className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProvenanceItem label="Recibos nuevos" value={effective?.name ?? 'Sin perfil resuelto'} />
          <ProvenanceItem label="Origen" value={reason} />
          <ProvenanceItem label="Editando" value={selectedProfile?.name ?? 'Ningún perfil'} />
          <ProvenanceItem label="Estado de la edición" value={editingState} />
        </dl>
        <p className="mt-3 text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]">
          Al guardar, este perfil se aplica a los próximos recibos. Los documentos ya emitidos no cambian:
          cambiar el perfil no reescribe su documento ni su numeración.
        </p>
        {editingDifferent ? (
          <p className="mt-2 text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]" data-receipt-provenance-diff>
            Está editando un perfil distinto del efectivo para recibos nuevos. Guardar lo marcará como
            predeterminado global y cambiará la salida de papel de los próximos recibos.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProvenanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--ui-line-strong)] pl-3">
      <dt className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">{label}</dt>
      <dd className="mt-1 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">{value}</dd>
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
    <div className="flex items-center gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3">
      <input
        id={id}
        type="checkbox"
        className={CHECKBOX_CLASS}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">{label}</label>
    </div>
  );
}
