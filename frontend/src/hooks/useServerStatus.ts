import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/base';

type OperationalHealth = {
  generated_at: string;
  database?: {
    connected?: boolean;
    driver?: string;
  };
  queue?: {
    connection?: string;
    failed?: number;
    pending?: number;
    error?: string;
  };
  backups?: {
    failed_last_24h?: number;
    pending?: number;
    success_last_24h?: number;
    worker_recently_active?: boolean;
    error?: string;
  };
  storage?: {
    backup_bytes?: number;
    backup_files?: number;
    error?: string;
  };
  recent_errors?: Array<{ action: string; created_at: string }>;
};

export type ServerStatusSummary = {
  level: 'ok' | 'review' | 'error';
  label: 'Todo bien' | 'Requiere revision' | 'Error';
  description: string;
};

const WAITING_SUMMARY: ServerStatusSummary = {
  level: 'review',
  label: 'Requiere revision',
  description: 'Esperando diagnostico del servidor local.',
};

export function useServerStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [operationalHealth, setOperationalHealth] = useState<OperationalHealth | null>(null);
  const [summary, setSummary] = useState<ServerStatusSummary>(WAITING_SUMMARY);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      if (!active) return;
      setChecking(true);
      try {
        const response = await fetch(apiClient.url('/api/system/health'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (response.ok) {
          const payload = (await response.json().catch(() => null)) as { data?: OperationalHealth } | null;
          const health = payload?.data ?? null;

          setOperationalHealth(health);
          setSummary(summarizeOperationalHealth(true, health));
          setIsOnline(true);
        } else {
          setOperationalHealth(null);
          setSummary(summarizeOperationalHealth(false, null));
          setIsOnline(false);
        }
      } catch {
        setOperationalHealth(null);
        setSummary(summarizeOperationalHealth(false, null));
        setIsOnline(false);
      } finally {
        if (active) {
          setChecking(false);
          setLastCheck(new Date());
        }
      }
    };

    // Initial check
    checkStatus();

    // Set interval to check every 30 seconds
    const interval = setInterval(checkStatus, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline, lastCheck, checking, operationalHealth, summary };
}

export function summarizeOperationalHealth(isOnline: boolean, health: OperationalHealth | null): ServerStatusSummary {
  if (!isOnline) {
    return {
      level: 'error',
      label: 'Error',
      description: 'No se pudo confirmar el servidor local. Revise que la computadora servidor este encendida y conectada a la red.',
    };
  }

  if (!health) {
    return WAITING_SUMMARY;
  }

  if (health.database?.connected === false) {
    return {
      level: 'error',
      label: 'Error',
      description: 'La base de datos local no responde. Detenga la facturacion y pida soporte antes de repetir cobros o facturas.',
    };
  }

  if (
    (health.queue?.failed ?? 0) > 0 ||
    (health.backups?.failed_last_24h ?? 0) > 0 ||
    Boolean(health.queue?.error || health.backups?.error || health.storage?.error)
  ) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description: 'Hay trabajos o respaldos con alerta. Revise Respaldos y pida soporte si el problema se repite.',
    };
  }

  if (
    (health.queue?.pending ?? 0) > 0 ||
    (health.backups?.pending ?? 0) > 0 ||
    health.backups?.worker_recently_active === false ||
    (health.backups?.success_last_24h ?? 0) === 0
  ) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description: 'El sistema responde, pero conviene revisar respaldos y tareas automaticas antes del cierre diario.',
    };
  }

  return {
    level: 'ok',
    label: 'Todo bien',
    description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
  };
}
