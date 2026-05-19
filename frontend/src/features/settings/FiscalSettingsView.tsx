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
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { Palette, UploadCloud, Check, Sparkles, Building2 } from 'lucide-react';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

type SettingsFormData = {
  hospital_name: string;
  rtn: string;
  receipt_width: '80mm' | '58mm';
};

type SequenceFormData = {
  prefix: string;
  cai: string;
  min_number: number;
  max_number: number;
  valid_until: string;
};

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
    receipt_width: '80mm',
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
        setHospitalForm({
          hospital_name: settingsData.hospital_name ?? '',
          rtn: settingsData.rtn ?? '',
          receipt_width: (settingsData.receipt_width as '80mm' | '58mm') ?? '80mm',
        });
      }

      if (sequenceData[0]) {
        setSequenceForm({
          prefix: sequenceData[0].prefix ?? '',
          cai: sequenceData[0].cai ?? '',
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
        receipt_width: hospitalForm.receipt_width,
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
        title="Configuración Fiscal"
        description="Configure los datos fiscales y la secuencia de facturación para emitir recibos."
      />

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="hospital">Datos del Hospital</TabsTrigger>
          <TabsTrigger value="secuencia">Secuencia Fiscal</TabsTrigger>
          <TabsTrigger value="receipt">Recibo térmico</TabsTrigger>
          <TabsTrigger value="branding">Identidad Visual</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-0 space-y-6">
          <FiscalStatusCard settings={settings} sequence={sequence} />
          <FiscalSummary settings={settings} sequence={sequence} />
        </TabsContent>

        <TabsContent value="hospital" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Datos del Hospital</CardTitle>
              <CardDescription>
                Estos datos aparecerán en los recibos térmicos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede modificar la configuracion fiscal.
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hospital_name">Nombre del Hospital *</Label>
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

              <div className="flex justify-end">
                <Button onClick={handleSaveHospital} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar Información'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secuencia" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Secuencia Fiscal</CardTitle>
              <CardDescription>
                Configure la secuencia de facturación autorizada por la autoridad fiscal.
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
                  <Label htmlFor="min_number">Desde el número *</Label>
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
                  <Label htmlFor="max_number">Hasta el número *</Label>
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
                  <Label htmlFor="valid_until">Válido hasta</Label>
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
                  {saving ? 'Guardando...' : 'Guardar Secuencia'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Recibo térmico</CardTitle>
              <CardDescription>
                Configure el ancho del papel para impresión térmica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canEdit && (
                <Alert variant="warning" title="Modo solo lectura">
                  Solo supervisor o administrador puede cambiar el ancho por defecto.
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="receipt_width">Ancho de Recibo</Label>
                <Select
                  value={hospitalForm.receipt_width}
                  onValueChange={(v: string) => setHospitalForm(prev => ({ ...prev, receipt_width: v as '80mm' | '58mm' }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="receipt_width" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm (Estándar)</SelectItem>
                    <SelectItem value="58mm">58mm (Angosto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveHospital} disabled={saving || !canEdit}>
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Logo upload card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-secondary" />
                  Logo Institucional
                </CardTitle>
                <CardDescription>
                  Suba el logo oficial de su clínica u hospital para encabezar recibos, facturas impresas y pantallas de inicio de sesión.
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
                      <span className="text-[10px] text-muted-foreground mt-2">Logo Cargado</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <UploadCloud className="size-10 mb-2 text-slate-400" />
                      <span className="text-xs">Ningún logo cargado (Se usará el logo por defecto)</span>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="logo-input">Seleccionar nuevo logo (.png, .jpg, .jpeg - máx. 2MB)</Label>
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
                        {uploadingLogo ? 'Subiendo...' : 'Actualizar Logo'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Colors theme selector card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="size-5 text-secondary" />
                  Color de Marca / Tema
                </CardTitle>
                <CardDescription>
                  Personalice el color primario de acento de la aplicación para adaptarlo a la identidad visual de su institución de salud.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3">
                  {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((themeKey) => {
                    const themeObj = COLOR_THEMES[themeKey];
                    const active = colorTheme === themeKey;
                    
                    return (
                      <button
                        key={themeKey}
                        onClick={() => setColorTheme(themeKey)}
                        className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                          active
                            ? 'border-secondary bg-secondary/5 shadow-sm font-semibold'
                            : 'border-border hover:bg-slate-50 dark:hover:bg-slate-900/50'
                        }`}
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
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-lg bg-teal-50 dark:bg-slate-900 border border-teal-100 p-3.5 flex gap-2">
                  <Sparkles className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-800 dark:text-teal-400">
                    <strong>Aplicación en tiempo real:</strong> Al seleccionar una paleta de color, los botones, bordes, estados activos y acentos visuales de toda la interfaz se actualizan al instante sin reiniciar sesión.
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
