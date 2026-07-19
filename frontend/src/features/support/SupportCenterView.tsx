import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
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
    <section className="flex flex-col gap-6" aria-label="Asistencia operativa">
      <PageHeader
        title="Asistencia operativa"
        description="Guías de turno, recuperación segura y diagnóstico del sistema hospitalario local."
      />

      {error ? (
        <Empty role="alert"><EmptyHeader><EmptyTitle>Diagnóstico no disponible</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader><EmptyContent><Button type="button" onClick={loadStatus}>Reintentar diagnóstico</Button></EmptyContent></Empty>
      ) : null}

      <Alert><AlertTitle>Continuidad operativa</AlertTitle><AlertDescription>Si una incidencia afecta caja, recibos o red local, registre hora, pantalla y usuario antes de repetir una acción.</AlertDescription></Alert>

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
