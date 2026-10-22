import { useQuery } from '@tanstack/react-query';
import { ApiError, apiClient, type OperationalHealth, type SystemHealthLiveness, type SystemStatus } from '@/lib/api';
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
const SYSTEM_STATUS_VIEW_PERMISSION = 'system.status.view';

type OperationalHealthSnapshot = {
  database?: Partial<OperationalHealth['database']> | null;
  queue?: Partial<OperationalHealth['queue']> | null;
  backups?: Partial<OperationalHealth['backups']> | null;
  storage?: Partial<OperationalHealth['storage']> | null;
};

function nextRefreshInterval() {
  return getVisibleRefetchInterval(HEALTH_POLL_INTERVAL_MS);
}

/**
 * Authenticated operational snapshot (queues, backups, storage). Requires
 * `system.status.view` on the backend; callers must pass the user's
 * permission so anonymous or under-privileged sessions never trigger it.
 */
export function useOperationalHealth(canViewOperationalDetail = false) {
  return useQuery({
    queryKey: queryKeys.system.healthDetail(),
    queryFn: () => apiClient.getSystemHealth(),
    enabled: canViewOperationalDetail,
    staleTime: HEALTH_POLL_INTERVAL_MS / 2,
    retry: false,
    refetchInterval: () => (canViewOperationalDetail ? nextRefreshInterval() : false),
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

export function useServerStatus(userPermissions: readonly string[] = []) {
  const canViewOperationalDetail = userPermissions.includes(SYSTEM_STATUS_VIEW_PERMISSION);
  const livenessQuery = useQuery({
    queryKey: queryKeys.system.health(),
    queryFn: () => apiClient.getSystemHealthLiveness(),
    staleTime: HEALTH_POLL_INTERVAL_MS / 2,
    retry: false,
    refetchInterval: () => nextRefreshInterval(),
    refetchOnWindowFocus: true,
  });
  const detailQuery = useOperationalHealth(canViewOperationalDetail);
  const lastUpdatedAt = Math.max(livenessQuery.dataUpdatedAt, livenessQuery.errorUpdatedAt);
  const isOnline = !livenessQuery.isError || isAuthStatusError(livenessQuery.error);
  const operationalHealth = canViewOperationalDetail ? (detailQuery.data ?? null) : null;
  const healthSnapshot: OperationalHealthSnapshot | SystemHealthLiveness | null =
    operationalHealth ?? livenessQuery.data ?? null;

  return {
    isOnline,
    lastCheck: lastUpdatedAt > 0 ? new Date(lastUpdatedAt) : null,
    checking: livenessQuery.isFetching || (canViewOperationalDetail && detailQuery.isFetching),
    operationalHealth,
    refetch: async () => {
      const [livenessResult] = await Promise.all([
        livenessQuery.refetch(),
        canViewOperationalDetail ? detailQuery.refetch() : Promise.resolve(null),
      ]);

      return livenessResult;
    },
    summary: summarizeOperationalHealth(isOnline, healthSnapshot, livenessQuery.error),
  };
}

export function summarizeOperationalHealth(
  isOnline: boolean,
  health: OperationalHealthSnapshot | SystemHealthLiveness | null,
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

  const snapshot = health as OperationalHealthSnapshot;

  if (!hasOperationalDetail(snapshot)) {
    // Liveness-only payload (anonymous/permissionless session): do not
    // claim backup or queue status that was never requested.
    return {
      level: 'ok',
      label: 'Todo bien',
      description: 'El servidor local responde correctamente.',
    };
  }

  if (snapshot.database?.connected === false) {
    return {
      level: 'error',
      label: 'Error',
      description:
        'La base de datos local no responde. Detenga la facturacion y pida soporte antes de repetir cobros o facturas.',
    };
  }

  if (
    (snapshot.queue?.failed ?? 0) > 0 ||
    (snapshot.backups?.failed_last_24h ?? 0) > 0 ||
    Boolean(snapshot.queue?.error || snapshot.backups?.error || snapshot.storage?.error)
  ) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description:
        'Hay trabajos o respaldos con alerta. Revise Respaldos y pida soporte si el problema se repite.',
    };
  }

  if (
    snapshot.backups?.latest_success_file_exists === false ||
    snapshot.backups?.latest_success_checksum_matches === false
  ) {
    return {
      level: 'review',
      label: 'Requiere revision',
      description:
        'El ultimo respaldo exitoso no pudo validarse. Cree un respaldo manual y pida soporte antes del cierre diario.',
    };
  }

  if (
    (snapshot.queue?.pending ?? 0) > 0 ||
    (snapshot.backups?.pending ?? 0) > 0 ||
    snapshot.backups?.worker_recently_active === false ||
    (snapshot.backups?.success_last_24h ?? 0) === 0
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

function hasOperationalDetail(health: OperationalHealthSnapshot): boolean {
  return Boolean(health.database || health.queue || health.backups || health.storage);
}

function isAuthStatusError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 419);
}

export type { OperationalHealth, SystemStatus };
