import { useQuery } from '@tanstack/react-query';
import { ApiError, apiClient, type OperationalHealth, type SystemStatus } from '@/lib/api';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
import { queryKeys } from '@/lib/queryKeys';

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

const HEALTH_POLL_INTERVAL_MS = 30_000;
const STATUS_STALE_TIME_MS = 60_000;

function nextRefreshInterval() {
  return getVisibleRefetchInterval(HEALTH_POLL_INTERVAL_MS);
}

export function useOperationalHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.health(),
    queryFn: () => apiClient.getSystemHealth(),
    enabled,
    staleTime: HEALTH_POLL_INTERVAL_MS / 2,
    retry: false,
    refetchInterval: () => nextRefreshInterval(),
    refetchOnWindowFocus: true,
  });
}

export function useSystemStatusSnapshot(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.status(),
    queryFn: () => apiClient.getSystemStatus(),
    enabled,
    staleTime: STATUS_STALE_TIME_MS,
    retry: false,
  });
}

export function useServerStatus() {
  const query = useOperationalHealth();
  const lastUpdatedAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);

  return {
    isOnline: !query.isError || isAuthStatusError(query.error),
    lastCheck: lastUpdatedAt > 0 ? new Date(lastUpdatedAt) : null,
    checking: query.isFetching,
    operationalHealth: query.data ?? null,
    refetch: query.refetch,
    summary: summarizeOperationalHealth(!query.isError || isAuthStatusError(query.error), query.data ?? null, query.error),
  };
}

export function summarizeOperationalHealth(
  isOnline: boolean,
  health: OperationalHealth | null,
  error: unknown = null,
): ServerStatusSummary {
  if (isAuthStatusError(error)) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description: 'El servidor local responde, pero la sesion no esta autenticada. Inicie sesion para ver el diagnostico completo.',
    };
  }

  if (!isOnline) {
    return {
      level: 'error',
      label: 'Error',
      description:
        'No se pudo confirmar el servidor local. Revise que la computadora servidor este encendida y conectada a la red.',
    };
  }

  if (!health) {
    return WAITING_SUMMARY;
  }

  if (health.database?.connected === false) {
    return {
      level: 'error',
      label: 'Error',
      description:
        'La base de datos local no responde. Detenga la facturacion y pida soporte antes de repetir cobros o facturas.',
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
      description:
        'Hay trabajos o respaldos con alerta. Revise Respaldos y pida soporte si el problema se repite.',
    };
  }

  if (
    health.backups?.latest_success_file_exists === false ||
    health.backups?.latest_success_checksum_matches === false
  ) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description:
        'El ultimo respaldo exitoso no pudo validarse. Cree un respaldo manual y pida soporte antes del cierre diario.',
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
      description:
        'El sistema responde, pero conviene revisar respaldos y tareas automaticas antes del cierre diario.',
    };
  }

  return {
    level: 'ok',
    label: 'Todo bien',
    description:
      'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
  };
}

function isAuthStatusError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 419);
}

export type { OperationalHealth, SystemStatus };
