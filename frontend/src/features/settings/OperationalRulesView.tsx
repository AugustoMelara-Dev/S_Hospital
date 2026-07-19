import { useEffect, useRef, useState } from 'react';
import { Save, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { type OperationalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type OperationalRulesViewProps = { canEdit: boolean; onStatus: OperationalStatusReporter };

export function OperationalRulesView({ canEdit, onStatus }: OperationalRulesViewProps) {
  const [settings, setSettings] = useState<OperationalSettings | null>(null);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [partialPaymentsEnabled, setPartialPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient.getOperationalSettings();
      setSettings(data);
      setScannerEnabled(data?.scanner_enabled === true);
      setPartialPaymentsEnabled(data?.partial_payments_enabled === true);
    } catch (err) {
      setError(safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar reglas operativas.')));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (savingRef.current || !settings) return;
    savingRef.current = true;
    setError('');
    onStatus({ key: 'settings:operational-rules:save', level: 'info', message: 'Guardando reglas operativas...', toast: false });
    try {
      const updated = await apiClient.updateOperationalSettings({ scanner_enabled: scannerEnabled, partial_payments_enabled: partialPaymentsEnabled });
      setSettings((current) => (current ? { ...current, ...updated } : current));
      onStatus({ key: 'settings:operational-rules:save', level: 'success', message: 'Reglas operativas guardadas.' });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar reglas operativas.'));
      setError(message);
      onStatus({ key: 'settings:operational-rules:save', level: 'error', message });
    } finally {
      savingRef.current = false;
    }
  }

  if (loading) return <div role="status" aria-live="polite" className="text-sm text-muted-foreground">Cargando reglas operativas...</div>;

  return (
    <section className="grid gap-4">
      <header>
        <h2 className="text-lg font-semibold">Reglas operativas</h2>
        <p className="text-sm text-muted-foreground">Ajustes que afectan el flujo diario del POS. Los cambios quedan auditados.</p>
      </header>

      {error ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Punto de venta</CardTitle>
          <CardDescription>Active o desactive funciones del flujo de facturación.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field orientation="horizontal" className="rounded-xl border bg-muted/30 p-4" data-disabled={!canEdit}>
            <FieldContent>
              <FieldLabel htmlFor="scanner_enabled"><FieldTitle>Habilitar scanner/códigos en caja</FieldTitle></FieldLabel>
              <FieldDescription>Si está desactivado, el POS oculta los controles de scanner y códigos internos.</FieldDescription>
            </FieldContent>
            <Switch id="scanner_enabled" checked={scannerEnabled} onCheckedChange={setScannerEnabled} disabled={!canEdit} />
          </Field>

          <Field orientation="horizontal" className="rounded-xl border bg-muted/30 p-4" data-disabled={!canEdit}>
            <FieldContent>
              <FieldLabel htmlFor="partial_payments_enabled"><FieldTitle>Permitir abonos parciales</FieldTitle></FieldLabel>
              <FieldDescription>Si está desactivado, un monto menor al total no se registra como pago completo.</FieldDescription>
            </FieldContent>
            <Switch id="partial_payments_enabled" checked={partialPaymentsEnabled} onCheckedChange={setPartialPaymentsEnabled} disabled={!canEdit} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit} disabled={!canEdit}><Save data-icon="inline-start" />Guardar reglas operativas</Button>
      </div>
    </section>
  );
}
