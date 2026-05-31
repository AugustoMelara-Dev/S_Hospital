import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { Alert } from '../../components/ui/alert';
import { type AuthUser, type SystemStatus, type SystemStatusSummary, apiClient, userSafeErrorMessage } from '../../lib/api';
import { OperationalStatusSummary } from './components/OperationalStatusSummary';
import { RoleChecklist } from './components/RoleChecklist';
import { SupportPlaybookList } from './components/SupportPlaybookList';

type Props = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function SupportCenterView({ user, onStatus }: Props) {
  const canViewAdvanced = user.permissions.includes('system.status.view');
  const [summary, setSummary] = useState<SystemStatusSummary | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, [canViewAdvanced]);

  async function loadStatus() {
    setLoading(true);
    setError('');

    try {
      const summaryResponse = await apiClient.getSystemStatusSummary();
      setSummary(summaryResponse);

      if (canViewAdvanced) {
        setStatus(await apiClient.getSystemStatus());
      } else {
        setStatus(null);
      }

      onStatus('Diagnostico operativo actualizado.');
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar el diagnostico operativo.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="support-title">
      <PageHeader
        title="Soporte"
        description="Guias de turno, recuperacion segura y diagnostico operativo."
      />

      {error ? (
        <Alert variant="destructive" title="Diagnostico no disponible">
          {error}
        </Alert>
      ) : null}

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
