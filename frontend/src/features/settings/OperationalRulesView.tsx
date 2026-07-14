import { useEffect, useRef, useState } from 'react';
import { SaveOutlined as Save } from '@ant-design/icons';
import { Alert, Button, Card, Switch, Typography } from 'antd';
import { type OperationalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type OperationalRulesViewProps = {
  canEdit: boolean;
  onStatus: OperationalStatusReporter;
};

export function OperationalRulesView({ canEdit, onStatus }: OperationalRulesViewProps) {
  const [settings, setSettings] = useState<OperationalSettings | null>(null);
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
      const data = await apiClient.getOperationalSettings();
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
    onStatus({
      key: 'settings:operational-rules:save',
      level: 'info',
      message: 'Guardando reglas operativas...',
      toast: false,
    });
    try {
      const updated = await apiClient.updateOperationalSettings({
        scanner_enabled: scannerEnabled,
        partial_payments_enabled: partialPaymentsEnabled,
      });
      setSettings((current) => (current ? { ...current, ...updated } : current));
      onStatus({
        key: 'settings:operational-rules:save',
        level: 'success',
        message: 'Reglas operativas guardadas.',
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar reglas operativas.'));
      setError(message);
      onStatus({ key: 'settings:operational-rules:save', level: 'error', message });
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
    <section>
      <Typography.Title level={3}>Reglas operativas</Typography.Title>
      <Typography.Paragraph type="secondary">Ajustes que afectan el flujo diario del POS. Cambios quedan auditados.</Typography.Paragraph>
      {error ? (
        <Alert type="error" showIcon title="No se pudo guardar" description={error} />
      ) : null}

      <Card title="Punto de venta" extra={<Typography.Text type="secondary">Activa o desactiva funciones del flujo de facturación.</Typography.Text>}>
        <div className="space-y-4">
          <div className="flex items-start gap-4 border border-operational-border bg-muted/40 p-4">
            <Switch
              id="scanner_enabled"
              checked={scannerEnabled}
              onChange={setScannerEnabled}
              disabled={!canEdit}
            />
            <label htmlFor="scanner_enabled" className="cursor-pointer">
              <span className="block font-medium">Habilitar scanner/códigos en caja</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Si está desactivado, el POS oculta los controles de scanner y códigos internos.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-4 border border-operational-border bg-muted/40 p-4">
            <Switch
              id="partial_payments_enabled"
              checked={partialPaymentsEnabled}
              onChange={setPartialPaymentsEnabled}
              disabled={!canEdit}
            />
            <label htmlFor="partial_payments_enabled" className="cursor-pointer">
              <span className="block font-medium">Permitir abonos parciales</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Si está desactivado, un monto menor al total no se registra como pago completo.
              </span>
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button htmlType="button" type="primary" icon={<Save aria-hidden="true" />} onClick={onSubmit} disabled={!canEdit}>
          Guardar reglas operativas
        </Button>
      </div>
    </section>
  );
}
