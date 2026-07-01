import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type OperationalRulesViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

export function OperationalRulesView({ canEdit, onStatus }: OperationalRulesViewProps) {
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [partialPaymentsEnabled, setPartialPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient.getFiscalSettings();
      setSettings(data);
      setScannerEnabled(data?.scanner_enabled === true);
      setPartialPaymentsEnabled(data?.partial_payments_enabled === true);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar reglas operativas.'));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (savingRef.current || !settings) return;
    savingRef.current = true;
    setError('');
    onStatus('Guardando reglas operativas...');
    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: settings.hospital_name ?? '',
        rtn: settings.rtn ?? '',
        default_tax_rate: settings.default_tax_rate ?? '15.00',
        primary_color: settings.primary_color ?? 'indigo',
        address: settings.address ?? '',
        slogan: settings.slogan ?? '',
        scanner_enabled: scannerEnabled,
        partial_payments_enabled: partialPaymentsEnabled,
        receipt_template_mode: 'institutional',
      });
      setSettings(updated);
      onStatus('Reglas operativas guardadas.');
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar reglas operativas.'));
      setError(message);
      onStatus(message);
    } finally {
      savingRef.current = false;
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Cargando reglas operativas...
      </div>
    );
  }

  return (
    <FormSection
      title="Reglas operativas"
      description="Ajustes que afectan el flujo diario del POS. Cambios quedan auditados."
    >
      {error ? (
        <Alert variant="destructive" title="No se pudo guardar">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Punto de venta</CardTitle>
          <CardDescription>Activa o desactiva funciones del flujo de facturación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-operational-border bg-operational-panel p-4">
            <Checkbox
              id="scanner_enabled"
              checked={scannerEnabled}
              onCheckedChange={(value) => setScannerEnabled(value === true)}
              disabled={!canEdit}
            />
            <Label htmlFor="scanner_enabled" className="cursor-pointer">
              <span className="block font-medium">Habilitar scanner/códigos en caja</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Si está desactivado, el POS oculta los controles de scanner y códigos internos.
              </span>
            </Label>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-operational-border bg-operational-panel p-4">
            <Checkbox
              id="partial_payments_enabled"
              checked={partialPaymentsEnabled}
              onCheckedChange={(value) => setPartialPaymentsEnabled(value === true)}
              disabled={!canEdit}
            />
            <Label htmlFor="partial_payments_enabled" className="cursor-pointer">
              <span className="block font-medium">Permitir abonos parciales</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Si está desactivado, un monto menor al total no se registra como pago completo.
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit} disabled={!canEdit}>
          <Save data-icon aria-hidden="true" />
          Guardar reglas operativas
        </Button>
      </div>
    </FormSection>
  );
}