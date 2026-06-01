import { useEffect, useState } from 'react';
import {
  type FiscalSequence,
  type FiscalSettings,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, type InstitutionalReceiptPaperOption, institutionalReceiptPaperSize } from '@/lib/institutionalReceiptPaper';
import { Palette, UploadCloud, Check, Sparkles, Building2 } from 'lucide-react';

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

export function FiscalSettingsView({ canEdit, onStatus }: FiscalSettingsViewProps) {
  const { colorTheme, setColorTheme } = useTheme();
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [hospitalForm, setHospitalForm] = useState<SettingsFormData>({
    hospital_name: '',
    rtn: '',
    primary_color: 'teal',
    address: '',
    slogan: '',
    scanner_enabled: false,
    partial_payments_enabled: false,
    receipt_paper_size: 'half_letter',
    government_line: 'Gobierno de Honduras',
    secretariat_line: 'Secretaria de Salud Publica',
    receipt_location: 'Tocoa, Colon',
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
    setUploadingLogo(true);
    onStatus('Subiendo logo institucional...');
    try {
      const url = await apiClient.uploadLogo(logoFile);
      setLogoUrl(url);
      onStatus('Logo de la clínica actualizado con éxito.');
      setLogoFile(null);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo subir el logo.');
      onStatus(msg);
      setError(msg);
    } finally {
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
          government_line: settingsData.government_line ?? 'Gobierno de Honduras',
          secretariat_line: settingsData.secretariat_line ?? 'Secretaria de Salud Publica',
          receipt_location: settingsData.receipt_location ?? settingsData.address ?? 'Tocoa, Colon',
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
      const message = userSafeErrorMessage(err, 'No se pudo cargar la configuración fiscal.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveHospital() {
    if (!hospitalForm.hospital_name.trim()) {
      onStatus('El nombre del hospital es requerido.');
      return;
    }

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
        government_line: hospitalForm.government_line,
        secretariat_line: hospitalForm.secretariat_line,
        receipt_location: hospitalForm.receipt_location,
        receipt_footer_text: hospitalForm.receipt_footer_text,
        default_tax_rate: settings?.default_tax_rate ?? '15.00',
      });
      setSettings(updated);
      onStatus('Información del hospital guardada.');
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la información.');
      setError(message);
      onStatus(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveColorTheme(newColor: ColorTheme) {
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
        government_line: hospitalForm.government_line || settings.government_line,
        secretariat_line: hospitalForm.secretariat_line || settings.secretariat_line,
        receipt_location: hospitalForm.receipt_location || settings.receipt_location,
        receipt_footer_text: hospitalForm.receipt_footer_text || settings.receipt_footer_text,
        default_tax_rate: settings.default_tax_rate ?? '15.00',
      });
      setSettings(updated);
      onStatus(`Color de marca cambiado a ${COLOR_THEMES[newColor].name}.`);
    } catch {
      onStatus('No se pudo persistir el color de marca.');
    }
  }

  async function handleSaveSequence() {
    if (!sequenceForm.prefix.trim() || !sequenceForm.cai.trim()) {
      onStatus('El prefijo y CAI son requeridos.');
      return;
    }

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
      onStatus('Secuencia fiscal guardada.');
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la secuencia fiscal.');
      setError(message);
      onStatus(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando configuración fiscal..." />;
  }

  return (
    <>
      <PageHeader
        title="Configuracion"
        description="Datos del hospital, numeracion, recibos y apariencia."
      />

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="hospital">Hospital</TabsTrigger>
          <TabsTrigger value="secuencia">Numeracion</TabsTrigger>
          <TabsTrigger value="branding">Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-0 space-y-6">
          <FiscalStatusCard settings={settings} sequence={sequence} />
          <FiscalSummary settings={settings} sequence={sequence} />
        </TabsContent>

        <TabsContent value="hospital" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Hospital y recibo</CardTitle>
              <CardDescription>
                Estos datos aparecen en recibos, facturas impresas y pantalla de ingreso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede modificar la configuración fiscal.
                </Alert>
              )}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hospital_name">Nombre del hospital *</Label>
                  <Input
                    id="hospital_name"
                    value={hospitalForm.hospital_name}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, hospital_name: e.target.value }))}
                    placeholder="Hospital Nacional de..."
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rtn">RTN</Label>
                  <Input
                    id="rtn"
                    value={hospitalForm.rtn}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, rtn: e.target.value }))}
                    placeholder="0801-XXXX-XXXXX"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Direccion del hospital</Label>
                  <Input
                    id="address"
                    value={hospitalForm.address}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Barrio Centro, Avenida Principal..."
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slogan">Frase institucional</Label>
                  <Input
                    id="slogan"
                    value={hospitalForm.slogan}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, slogan: e.target.value }))}
                    placeholder="Al servicio de tu salud..."
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_paper_size">Tamano del recibo institucional</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="government_line">Encabezado de gobierno</Label>
                  <Input
                    id="government_line"
                    value={hospitalForm.government_line}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, government_line: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secretariat_line">Secretaria o dependencia</Label>
                  <Input
                    id="secretariat_line"
                    value={hospitalForm.secretariat_line}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, secretariat_line: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receipt_location">Lugar del recibo</Label>
                  <Input
                    id="receipt_location"
                    value={hospitalForm.receipt_location}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, receipt_location: e.target.value }))}
                    placeholder="Tocoa, Colon"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receipt_footer_text">Texto al pie del recibo</Label>
                  <Input
                    id="receipt_footer_text"
                    value={hospitalForm.receipt_footer_text}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, receipt_footer_text: e.target.value }))}
                    placeholder="Texto autorizado por administracion"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={hospitalForm.scanner_enabled}
                    onCheckedChange={(checked) => setHospitalForm(prev => ({ ...prev, scanner_enabled: checked === true }))}
                    disabled={!canEdit}
                  />
                  <span>
                    <span className="block font-medium">Habilitar scanner/codigos en caja</span>
                    <span className="text-muted-foreground">Si esta apagado, la pantalla de nueva factura oculta controles de scanner y codigos internos.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={hospitalForm.partial_payments_enabled}
                    onCheckedChange={(checked) => setHospitalForm(prev => ({ ...prev, partial_payments_enabled: checked === true }))}
                    disabled={!canEdit}
                  />
                  <span>
                    <span className="block font-medium">Permitir abonos parciales</span>
                    <span className="text-muted-foreground">Si esta apagado, un monto menor al total no se registra como pago completo.</span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveHospital} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar hospital y recibo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secuencia" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Numeracion de facturas</CardTitle>
              <CardDescription>
                Configure el rango autorizado para emitir facturas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede modificar la secuencia fiscal.
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefijo *</Label>
                  <Input
                    id="prefix"
                    value={sequenceForm.prefix}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                    placeholder="A"
                    className="uppercase"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cai">CAI *</Label>
                  <Input
                    id="cai"
                    value={sequenceForm.cai}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, cai: e.target.value }))}
                    placeholder="CAI-XXXXX-XXXXX-XXXXX"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_number">Desde el numero *</Label>
                  <Input
                    id="min_number"
                    type="number"
                    value={sequenceForm.min_number}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, min_number: parseInt(e.target.value) || 1 }))}
                    placeholder="1"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_number">Hasta el numero *</Label>
                  <Input
                    id="max_number"
                    type="number"
                    value={sequenceForm.max_number}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, max_number: parseInt(e.target.value) || 99999999 }))}
                    placeholder="10000"
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valido hasta</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={sequenceForm.valid_until}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, valid_until: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSequence} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar numeracion'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-secondary" />
                  Logo institucional
                </CardTitle>
                <CardDescription>
                  Se mostrara en recibos, facturas impresas y pantalla de ingreso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
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
                      <UploadCloud className="size-10 mb-2 text-slate-400" />
                      <span className="text-xs">Sin logo cargado. Se usara el icono del sistema.</span>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="logo-input">Seleccionar logo (.png, .jpg, .jpeg - max. 2MB)</Label>
                      <Input
                        id="logo-input"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setLogoFile(file);
                        }}
                      />
                    </div>
                    {logoFile && (
                      <Button
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="size-5 text-secondary" />
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
                        className="h-auto justify-between p-3.5 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="size-5 rounded-full border border-black/10"
                            style={{ backgroundColor: themeObj.light.secondary }}
                          />
                          <span className="text-sm text-foreground">{themeObj.name}</span>
                        </div>
                        {active && (
                          <Check className="size-4 text-secondary shrink-0" />
                        )}
                      </Button>
                    );
                  })}
                </div>

                <div className="rounded-lg bg-teal-50 dark:bg-slate-900 border border-teal-100 p-3.5 flex gap-2">
                  <Sparkles className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-800 dark:text-teal-400">
                    <strong>Vista inmediata:</strong> al elegir un color, la pantalla se actualiza al momento.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
