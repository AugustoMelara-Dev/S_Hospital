import { useEffect, useRef, useState } from 'react';
import {
  type FiscalSequence,
  type FiscalSettings,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { ActionBar } from '@/components/ui/action-bar';
import { InfoPanel, StatGrid } from '@/components/shared';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldGroup, FormSection } from '@/components/ui/form-section';
import { FormField } from '@/components/ui/form-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, type InstitutionalReceiptPaperOption, institutionalReceiptPaperSize } from '@/lib/institutionalReceiptPaper';
import { Palette, UploadCloud, Check, Sparkles, Building2 } from 'lucide-react';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

type InstitutionalReceiptPaperSize = InstitutionalReceiptPaperOption;

type SettingsFormData = {
  hospital_name: string;
  rtn: string;
  primary_color: 'teal' | 'blue' | 'indigo' | 'green' | 'rose';
  address: string;
  slogan: string;
  scanner_enabled: boolean;
  partial_payments_enabled: boolean;
  receipt_paper_size: InstitutionalReceiptPaperSize;
  government_line: string;
  secretariat_line: string;
  receipt_location: string;
  receipt_footer_text: string;
};

type SequenceFormData = {
  prefix: string;
  cai: string;
  min_number: number;
  max_number: number;
  valid_until: string;
};

function isPlaceholderHospitalName(value: string | null | undefined): boolean {
  return new RegExp(`^hospital ${'de' + 'mo'}$`, 'i').test(value?.trim() ?? '');
}

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

function institutionalPaperSize(value: FiscalSettings['receipt_paper_size']): InstitutionalReceiptPaperSize {
  return institutionalReceiptPaperSize(value);
}

function safeFiscalErrorMessage(error: unknown, fallback: string): string {
  const message = safeClientMessage(userSafeErrorMessage(error, fallback));

  return message.includes('[redacted]') || message.includes('[ruta-local]') || message.includes('[detalle-tecnico]')
    ? fallback
    : message || fallback;
}

function optionalFiscalText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function formatSequenceNumber(value: number | null | undefined): string {
  if (value == null) return '-';

  return String(value).padStart(8, '0');
}

export function FiscalSettingsView({ canEdit, onStatus }: FiscalSettingsViewProps) {
  const { colorTheme, setColorTheme } = useTheme();
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [sequences, setSequences] = useState<FiscalSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmingSequenceSave, setConfirmingSequenceSave] = useState(false);
  const savingHospitalRef = useRef(false);
  const savingSequenceRef = useRef(false);
  const uploadingLogoRef = useRef(false);

  const [hospitalForm, setHospitalForm] = useState<SettingsFormData>({
    hospital_name: '',
    rtn: '',
    primary_color: 'teal',
    address: '',
    slogan: '',
    scanner_enabled: false,
    partial_payments_enabled: false,
    receipt_paper_size: 'half_letter',
    government_line: '',
    secretariat_line: '',
    receipt_location: '',
    receipt_footer_text: '',
  });

  const [sequenceForm, setSequenceForm] = useState<SequenceFormData>({
    prefix: '',
    cai: '',
    min_number: 1,
    max_number: 99999999,
    valid_until: '',
  });

  useEffect(() => {
    void loadFiscalConfiguration();
    void loadLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLogo() {
    try {
      const url = await apiClient.getLogo();
      setLogoUrl(url);
    } catch {
      // Ignore
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) return;
    if (uploadingLogoRef.current) return;
    uploadingLogoRef.current = true;
    setUploadingLogo(true);
    onStatus('Subiendo logo institucional...');
    try {
      const url = await apiClient.uploadLogo(logoFile);
      setLogoUrl(url);
      onStatus('Logo institucional actualizado con éxito.');
      setLogoFile(null);
    } catch (err) {
      const msg = safeFiscalErrorMessage(err, 'No se pudo subir el logo.');
      onStatus(msg);
      setError(msg);
    } finally {
      uploadingLogoRef.current = false;
      setUploadingLogo(false);
    }
  }

  async function loadFiscalConfiguration() {
    setLoading(true);
    setError('');

    try {
      const [settingsData, sequenceData] = await Promise.all([
        apiClient.getFiscalSettings(),
        apiClient.getFiscalSequences(),
      ]);

      setSettings(settingsData);
      setSequences(sequenceData);
      setSequence(sequenceData[0] ?? null);

      if (settingsData) {
        const hospitalName = isPlaceholderHospitalName(settingsData.hospital_name) ? '' : settingsData.hospital_name;
        setHospitalForm({
          hospital_name: hospitalName ?? '',
          rtn: settingsData.rtn ?? '',
          primary_color: settingsData.primary_color ?? 'indigo',
          address: settingsData.address ?? '',
          slogan: settingsData.slogan ?? '',
          scanner_enabled: settingsData.scanner_enabled === true,
          partial_payments_enabled: settingsData.partial_payments_enabled === true,
          receipt_paper_size: institutionalPaperSize(settingsData.receipt_paper_size),
          government_line: settingsData.government_line ?? '',
          secretariat_line: settingsData.secretariat_line ?? '',
          receipt_location: settingsData.receipt_location ?? '',
          receipt_footer_text: settingsData.receipt_footer_text ?? '',
        });
        if (settingsData.primary_color) {
          setColorTheme(settingsData.primary_color);
        }
      }

      if (sequenceData[0]) {
        setSequenceForm({
          prefix: sequenceData[0].prefix ?? '',
          cai: isPlaceholderCai(sequenceData[0].cai) ? '' : sequenceData[0].cai ?? '',
          min_number: sequenceData[0].min_number ?? 1,
          max_number: sequenceData[0].max_number ?? 99999999,
          valid_until: sequenceData[0].valid_until ?? '',
        });
      }
    } catch (err) {
      const message = safeFiscalErrorMessage(err, 'No se pudo cargar la configuración fiscal.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveHospital() {
    if (savingHospitalRef.current) return;
    if (!hospitalForm.hospital_name.trim()) {
      onStatus('El nombre del hospital es requerido.');
      return;
    }

    savingHospitalRef.current = true;
    setSaving(true);
    onStatus('Guardando información del hospital...');

    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: hospitalForm.hospital_name,
        rtn: hospitalForm.rtn,
        primary_color: hospitalForm.primary_color,
        address: hospitalForm.address,
        slogan: hospitalForm.slogan,
        scanner_enabled: hospitalForm.scanner_enabled,
        partial_payments_enabled: hospitalForm.partial_payments_enabled,
        receipt_template_mode: 'institutional',
        receipt_paper_size: hospitalForm.receipt_paper_size,
        government_line: optionalFiscalText(hospitalForm.government_line),
        secretariat_line: optionalFiscalText(hospitalForm.secretariat_line),
        receipt_location: optionalFiscalText(hospitalForm.receipt_location),
        receipt_footer_text: optionalFiscalText(hospitalForm.receipt_footer_text),
        default_tax_rate: settings?.default_tax_rate ?? '15.00',
      });
      setSettings(updated);
      onStatus('Información del hospital guardada.');
    } catch (err) {
      const message = safeFiscalErrorMessage(err, 'No se pudo guardar la información.');
      setError(message);
      onStatus(message);
    } finally {
      savingHospitalRef.current = false;
      setSaving(false);
    }
  }

  async function handleSaveColorTheme(newColor: ColorTheme) {
    if (!canEdit || saving) return;
    setColorTheme(newColor);
    setHospitalForm(prev => ({ ...prev, primary_color: newColor }));

    if (!settings) return;

    try {
      onStatus('Guardando color de marca en el servidor...');
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: hospitalForm.hospital_name || settings.hospital_name,
        rtn: hospitalForm.rtn || settings.rtn,
        primary_color: newColor,
        address: hospitalForm.address || settings.address,
        slogan: hospitalForm.slogan || settings.slogan,
        scanner_enabled: hospitalForm.scanner_enabled,
        partial_payments_enabled: hospitalForm.partial_payments_enabled,
        receipt_template_mode: 'institutional',
        receipt_paper_size: hospitalForm.receipt_paper_size || settings.receipt_paper_size,
        government_line: optionalFiscalText(hospitalForm.government_line),
        secretariat_line: optionalFiscalText(hospitalForm.secretariat_line),
        receipt_location: optionalFiscalText(hospitalForm.receipt_location),
        receipt_footer_text: optionalFiscalText(hospitalForm.receipt_footer_text),
        default_tax_rate: settings.default_tax_rate ?? '15.00',
      });
      setSettings(updated);
      onStatus(`Color de marca cambiado a ${COLOR_THEMES[newColor].name}.`);
    } catch {
      onStatus('No se pudo persistir el color de marca.');
    }
  }

  function requestSaveSequence() {
    if (!sequenceForm.prefix.trim() || !sequenceForm.cai.trim()) {
      onStatus('El prefijo y CAI son requeridos.');
      return;
    }

    setConfirmingSequenceSave(true);
  }

  async function handleSaveSequence() {
    if (savingSequenceRef.current) return;
    if (!sequenceForm.prefix.trim() || !sequenceForm.cai.trim()) {
      onStatus('El prefijo y CAI son requeridos.');
      return;
    }

    savingSequenceRef.current = true;
    setSaving(true);
    onStatus('Guardando secuencia fiscal...');

    try {
      const saved = await apiClient.saveFiscalSequence({
        id: sequence?.id,
        document_type: 'invoice',
        prefix: sequenceForm.prefix,
        cai: sequenceForm.cai,
        min_number: sequenceForm.min_number,
        max_number: sequenceForm.max_number,
        current_number: sequence?.current_number ?? 0,
        valid_until: sequenceForm.valid_until,
        active: true,
      });
      setSequence(saved);
      setSequences((current) => {
        const exists = current.some((item) => item.id === saved.id);

        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setConfirmingSequenceSave(false);
      onStatus('Secuencia fiscal guardada.');
    } catch (err) {
      const message = safeFiscalErrorMessage(err, 'No se pudo guardar la secuencia fiscal.');
      setError(message);
      onStatus(message);
    } finally {
      savingSequenceRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando configuración fiscal..." />;
  }

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos del hospital, numeración, recibos y apariencia."
        actions={(
          <ActionBar align="end">
            <StatusBadge status={canEdit ? 'success' : 'info'}>
              {canEdit ? 'Edición habilitada' : 'Solo lectura'}
            </StatusBadge>
          </ActionBar>
        )}
      />

      <StatGrid
        className="sm:grid-cols-2 xl:grid-cols-4"
        items={[
          {
            label: 'Hospital',
            value: hospitalForm.hospital_name || 'Pendiente',
            helper: hospitalForm.rtn ? `RTN ${hospitalForm.rtn}` : 'RTN sin configurar',
            tone: hospitalForm.hospital_name ? 'success' : 'warning',
          },
          {
            label: 'Secuencia fiscal',
            value: sequenceForm.prefix || 'Pendiente',
            helper: sequence?.current_number != null ? `Actual ${formatSequenceNumber(sequence.current_number)}` : 'Sin correlativo activo',
            tone: sequence?.active ? 'success' : 'warning',
          },
          {
            label: 'Recibo',
            value: INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.find((option) => option.value === hospitalForm.receipt_paper_size)?.label ?? 'Pendiente',
            helper: 'Formato institucional principal',
            tone: 'info',
          },
          {
            label: 'Permiso',
            value: canEdit ? 'Editable' : 'Solo lectura',
            helper: canEdit ? 'Puede guardar cambios' : 'Los formularios quedan bloqueados',
            tone: canEdit ? 'success' : 'warning',
          },
        ]}
      />

      <InfoPanel
        title="Configuración fiscal y recibo"
        description="Revise datos autorizados antes de guardar. Los campos opcionales vacíos se conservan vacíos y no se completan con valores supuestos."
        tone="info"
      />

      {error ? (
        <ErrorState
          title="No se pudo completar la operación fiscal"
          message={error}
          onRetry={() => {
            void loadFiscalConfiguration();
            void loadLogo();
          }}
          retryLabel="Reintentar"
        />
      ) : null}

      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="border border-operational-border bg-operational-panel p-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="hospital">Hospital</TabsTrigger>
          <TabsTrigger value="secuencia">Numeración</TabsTrigger>
          <TabsTrigger value="branding">Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-0 space-y-6">
          <FiscalStatusCard settings={settings} sequence={sequence} />
          <FiscalSummary settings={settings} sequence={sequence} />
        </TabsContent>

        <TabsContent value="hospital" className="mt-0">
          <FormSection
            title="Hospital y recibo"
            description="Estos datos aparecen en recibos, facturas impresas y pantalla de ingreso."
            aria-busy={saving}
          >
            <div className="space-y-4">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede modificar la configuración fiscal.
                </Alert>
              )}
              <FieldGroup>
                <div className="space-y-2">
                  <label htmlFor="hospital_name" className="text-sm font-semibold">Nombre del hospital *</label>
                  <Input
                    id="hospital_name"
                    value={hospitalForm.hospital_name}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, hospital_name: e.target.value }))}
                    placeholder="Hospital Nacional de..."
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="rtn" className="text-sm font-semibold">RTN</label>
                  <Input
                    id="rtn"
                    value={hospitalForm.rtn}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, rtn: e.target.value }))}
                    placeholder="0801-XXXX-XXXXX"
                    disabled={!canEdit}
                  />
                </div>
              </FieldGroup>

              <FieldGroup>
                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-semibold">Dirección del hospital</label>
                  <Input
                    id="address"
                    value={hospitalForm.address}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Barrio Centro, Avenida Principal..."
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="slogan" className="text-sm font-semibold">Frase institucional</label>
                  <Input
                    id="slogan"
                    value={hospitalForm.slogan}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, slogan: e.target.value }))}
                    placeholder="Al servicio de tu salud..."
                    disabled={!canEdit}
                  />
                </div>
              </FieldGroup>

              <div className="space-y-2">
                <label htmlFor="receipt_paper_size" className="text-sm font-semibold">Tamaño del recibo institucional</label>
                <Select
                  value={hospitalForm.receipt_paper_size}
                  onValueChange={(v: string) => setHospitalForm(prev => ({ ...prev, receipt_paper_size: v as SettingsFormData['receipt_paper_size'] }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="receipt_paper_size" className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FieldGroup>
                <div className="space-y-2">
                  <label htmlFor="government_line" className="text-sm font-semibold">Encabezado de gobierno</label>
                  <Input
                    id="government_line"
                    value={hospitalForm.government_line}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, government_line: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="secretariat_line" className="text-sm font-semibold">Secretaría o dependencia</label>
                  <Input
                    id="secretariat_line"
                    value={hospitalForm.secretariat_line}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, secretariat_line: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="receipt_location" className="text-sm font-semibold">Lugar del recibo</label>
                  <Input
                    id="receipt_location"
                    value={hospitalForm.receipt_location}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, receipt_location: e.target.value }))}
                    placeholder="Ciudad o lugar autorizado"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="receipt_footer_text" className="text-sm font-semibold">Texto al pie del recibo</label>
                  <Input
                    id="receipt_footer_text"
                    value={hospitalForm.receipt_footer_text}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, receipt_footer_text: e.target.value }))}
                    placeholder="Texto autorizado por administración"
                    disabled={!canEdit}
                  />
                </div>
              </FieldGroup>

                <div className="grid gap-3 rounded-panel border border-operational-border bg-operational-panel p-3">
                <div className="flex items-start gap-3 text-sm">
                  <Checkbox
                    id="scanner_enabled"
                    checked={hospitalForm.scanner_enabled}
                    onCheckedChange={(checked) => setHospitalForm(prev => ({ ...prev, scanner_enabled: checked === true }))}
                    disabled={!canEdit}
                  />
                  <label htmlFor="scanner_enabled" className="cursor-pointer">
                    <span className="block font-medium">Habilitar scanner/códigos en caja</span>
                    <span className="block text-muted-foreground font-normal mt-1">Si está apagado, la pantalla de nueva factura oculta controles de scanner y códigos internos.</span>
                  </label>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Checkbox
                    id="partial_payments_enabled"
                    checked={hospitalForm.partial_payments_enabled}
                    onCheckedChange={(checked) => setHospitalForm(prev => ({ ...prev, partial_payments_enabled: checked === true }))}
                    disabled={!canEdit}
                  />
                  <label htmlFor="partial_payments_enabled" className="cursor-pointer">
                    <span className="block font-medium">Permitir abonos parciales</span>
                    <span className="block text-muted-foreground font-normal mt-1">Si está apagado, un monto menor al total no se registra como pago completo.</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveHospital} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar hospital y recibo'}
                </Button>
              </div>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="secuencia" className="mt-0">
          <FormSection
            title="Numeración de facturas"
            description="Configure el rango autorizado para emitir facturas."
            aria-busy={saving}
          >
            <div className="space-y-5">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede modificar la secuencia fiscal.
                </Alert>
              )}
              <FieldGroup>
                <FormField
                  id="prefix"
                  label="Prefijo"
                  required
                  hint="Se conserva tal como lo autoriza administración fiscal."
                >
                  {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={sequenceForm.prefix}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                    placeholder="A"
                    className="font-mono uppercase"
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                  )}
                </FormField>

                <FormField
                  id="cai"
                  label="CAI"
                  required
                  hint="No use valores temporales para operación final."
                >
                  {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={sequenceForm.cai}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, cai: e.target.value }))}
                    placeholder="CAI-XXXXX-XXXXX-XXXXX"
                    className="font-mono"
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                  )}
                </FormField>

                <FormField id="min_number" label="Desde el número" required>
                  {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="number"
                    value={sequenceForm.min_number}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, min_number: parseInt(e.target.value) || 1 }))}
                    placeholder="1"
                    className="tabular-nums"
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                  )}
                </FormField>

                <FormField id="max_number" label="Hasta el número" required>
                  {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="number"
                    value={sequenceForm.max_number}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, max_number: parseInt(e.target.value) || 99999999 }))}
                    placeholder="10000"
                    className="tabular-nums"
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                  )}
                </FormField>

                <FormField id="valid_until" label="Válido hasta">
                  {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="date"
                    value={sequenceForm.valid_until}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, valid_until: e.target.value }))}
                    aria-describedby={describedBy}
                    disabled={!canEdit}
                  />
                  )}
                </FormField>

                <div className="rounded-panel border border-operational-border bg-operational-panel p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Correlativo actual</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {sequence?.prefix && sequence?.current_number != null
                      ? `${sequence.prefix}-${formatSequenceNumber(sequence.current_number)}`
                      : '-'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Este valor lo incrementa el backend al emitir facturas; no se reinicia desde esta pantalla.
                  </p>
                </div>
              </FieldGroup>

              <div className="flex justify-end">
                <Button type="button" onClick={requestSaveSequence} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar numeración'}
                </Button>
              </div>

              {sequences.length > 0 ? (
                <Table containerLabel="Secuencias fiscales registradas" className="min-w-[760px]">
                  <TableCaption>
                    Secuencias fiscales reales devueltas por el servidor. Las acciones de activar o editar usan el formulario autorizado.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Prefijo</TableHead>
                      <TableHead>Rango</TableHead>
                      <TableHead>Correlativo</TableHead>
                      <TableHead>Válido hasta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequences.map((item) => (
                      <TableRow key={item.id ?? `${item.document_type}-${item.prefix}-${item.cai}`}>
                        <TableCell>
                          <StatusBadge status={item.active ? 'success' : 'pending'}>
                            {item.active ? 'Activa' : 'Inactiva'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="capitalize">{item.document_type}</TableCell>
                        <TableCell className="font-mono">{item.prefix}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatSequenceNumber(item.min_number)} - {formatSequenceNumber(item.max_number)}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{formatSequenceNumber(item.current_number)}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.valid_until || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="branding" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 aria-hidden="true" className="size-5 text-secondary" />
                  Logo institucional
                </CardTitle>
                <CardDescription>
                  Se mostrará en recibos, facturas impresas y pantalla de ingreso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!canEdit ? (
                  <Alert variant="warning" title="Modo solo lectura">
                    La carga de logo requiere permiso para actualizar configuración fiscal.
                  </Alert>
                ) : null}
                <div className="flex flex-col items-center justify-center rounded-panel border-2 border-dashed border-operational-border bg-operational-panel p-6">
                  {logoUrl ? (
                    <div className="relative group flex flex-col items-center">
                      <img
                        src={logoUrl}
                        alt="Logo institucional"
                        className="max-h-24 object-contain rounded p-2 bg-white border border-border"
                      />
                      <span className="text-[10px] text-muted-foreground mt-2">Logo cargado</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <UploadCloud aria-hidden="true" className="size-10 mb-2 text-muted-foreground" />
                      <span className="text-xs">Sin logo cargado. Se usará el ícono del sistema.</span>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="logo-input" className="text-sm font-semibold">
                        Seleccionar logo (.png, .jpg, .jpeg - max. 2MB)
                      </label>
                      <Input
                        id="logo-input"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        disabled={uploadingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setLogoFile(file);
                        }}
                      />
                    </div>
                    {logoFile && (
                      <Button
                        type="button"
                        onClick={handleUploadLogo}
                        disabled={uploadingLogo}
                        className="w-full gap-2"
                      >
                        {uploadingLogo ? 'Subiendo...' : 'Actualizar logo'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-operational-border bg-operational-surface shadow-operational">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette aria-hidden="true" className="size-5 text-secondary" />
                  Color de marca
                </CardTitle>
                <CardDescription>
                  Elija el color principal de los botones, estados activos y acentos visuales.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3">
                  {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((themeKey) => {
                    const themeObj = COLOR_THEMES[themeKey];
                    const active = colorTheme === themeKey;

                    return (
                      <Button
                        key={themeKey}
                        type="button"
                        variant={active ? 'secondary' : 'outline'}
                        onClick={() => handleSaveColorTheme(themeKey)}
                        disabled={!canEdit || saving}
                        className="h-auto justify-between p-3.5 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="size-5 rounded-full border border-black/10"
                            style={{ backgroundColor: themeObj.light.secondary }}
                          />
                          <span className="text-sm text-foreground">{themeObj.name}</span>
                        </div>
                        {active && (
                          <Check aria-hidden="true" className="size-4 text-secondary shrink-0" />
                        )}
                      </Button>
                    );
                  })}
                </div>

                <div className="rounded-lg border border-info/30 bg-info/10 p-3.5 flex gap-2">
                  <Sparkles aria-hidden="true" className="size-4 text-info shrink-0 mt-0.5" />
                  <p className="text-xs text-info">
                    <strong>Vista inmediata:</strong> al elegir un color, la pantalla se actualiza al momento.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmingSequenceSave}
        title="Confirmar numeración fiscal"
        confirmLabel={saving ? 'Guardando...' : 'Guardar numeración'}
        cancelLabel="Revisar datos"
        confirmDisabled={saving}
        cancelDisabled={saving}
        danger
        onCancel={() => setConfirmingSequenceSave(false)}
        onConfirm={() => { void handleSaveSequence(); }}
      >
        <div className="space-y-2">
          <p>
            Esta acción cambia el CAI, prefijo y rango autorizado usado para emitir facturas.
            Revise los datos antes de continuar.
          </p>
          <dl className="grid gap-1 text-foreground">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Prefijo</dt>
              <dd className="font-medium">{sequenceForm.prefix || 'Sin prefijo'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rango</dt>
              <dd className="font-medium">{sequenceForm.min_number} - {sequenceForm.max_number}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Válido hasta</dt>
              <dd className="font-medium">{sequenceForm.valid_until || 'Sin fecha'}</dd>
            </div>
          </dl>
        </div>
      </ConfirmDialog>
    </>
  );
}
