import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Result } from 'antd';
import { PageHeader } from '@/design-system/components/PageHeader';
import { type AuthUser, type SystemStatus, type SystemStatusSummary, apiClient, userSafeErrorMessage } from '../../lib/api';
import { safeClientMessage } from '../../lib/support/clientIssueLog';
import { OperationalStatusSummary } from './components/OperationalStatusSummary';
import { RoleChecklist } from './components/RoleChecklist';
import { SupportPlaybookList } from './components/SupportPlaybookList';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type Props = {
  user: AuthUser;
  onStatus: OperationalStatusReporter;
};

export function SupportCenterView({ user, onStatus }: Props) {
  const canViewAdvanced = user.permissions.includes('system.status.view');
  const [summary, setSummary] = useState<SystemStatusSummary | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryResponse, advancedStatus] = await Promise.all([
        apiClient.getSystemStatusSummary(),
        canViewAdvanced ? apiClient.getSystemStatus() : Promise.resolve(null),
      ]);
      setSummary(summaryResponse);
      setStatus(advancedStatus);

      onStatus({
        key: 'support:diagnostic:refresh',
        level: 'success',
        message: 'Diagnostico operativo actualizado.',
        toast: false,
      });
    } catch (error) {
      const fallback = 'No se pudo cargar el diagnostico operativo.';
      const safeMessage = safeClientMessage(userSafeErrorMessage(error, fallback));
      const message = safeMessage.includes('[redacted]') ? fallback : (safeMessage || fallback);
      setError(message);
      onStatus({
        key: 'support:diagnostic:refresh',
        level: 'error',
        message,
        toast: false,
      });
    } finally {
      setLoading(false);
    }
  }, [canViewAdvanced, onStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <section className="space-y-6" aria-label="Asistencia operativa">
      <PageHeader
        title="Asistencia operativa"
        description="Guías de turno, recuperación segura y diagnóstico del sistema hospitalario local."
      />

      {error ? (
        <div role="alert"><Result status="error" title="Diagnóstico no disponible" subTitle={error} extra={<Button onClick={loadStatus}>Reintentar diagnóstico</Button>} /></div>
      ) : null}

      <Alert type="info" showIcon title="Continuidad operativa" description="Si una incidencia afecta caja, recibos o red local, registre hora, pantalla y usuario antes de repetir una acción." />

      <OperationalStatusSummary
        canViewAdvanced={canViewAdvanced}
        loading={loading}
        summary={summary}
        status={status}
        onRefresh={loadStatus}
      />

      <RoleChecklist />
      <SupportPlaybookList />
    </section>
  );
}
