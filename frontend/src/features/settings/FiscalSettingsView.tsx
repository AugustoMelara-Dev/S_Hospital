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
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
  }, []);

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
          <TabsTrigger value="receipt">Configuración de Receipt</TabsTrigger>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hospital_name">Nombre del Hospital *</Label>
                  <Input
                    id="hospital_name"
                    value={hospitalForm.hospital_name}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, hospital_name: e.target.value }))}
                    placeholder="Hospital Nacional de..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rtn">RTN</Label>
                  <Input
                    id="rtn"
                    value={hospitalForm.rtn}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, rtn: e.target.value }))}
                    placeholder="0801-XXXX-XXXXX"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefijo *</Label>
                  <Input
                    id="prefix"
                    value={sequenceForm.prefix}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                    placeholder="A"
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cai">CAI *</Label>
                  <Input
                    id="cai"
                    value={sequenceForm.cai}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, cai: e.target.value }))}
                    placeholder="CAI-XXXXX-XXXXX-XXXXX"
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">Válido hasta</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={sequenceForm.valid_until}
                    onChange={(e) => setSequenceForm(prev => ({ ...prev, valid_until: e.target.value }))}
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
              <CardTitle>Configuración de Receipt</CardTitle>
              <CardDescription>
                Configure el ancho del papel para impresión térmica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_width">Ancho de Recibo</Label>
                <Select
                  value={hospitalForm.receipt_width}
                  onValueChange={(v: string) => setHospitalForm(prev => ({ ...prev, receipt_width: v as '80mm' | '58mm' }))}
                >
                  <SelectTrigger className="w-[200px]">
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
      </Tabs>
    </>
  );
}