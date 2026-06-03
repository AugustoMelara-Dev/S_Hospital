import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient, type BackupLog } from '@/lib/api';

export interface BackupsFilters {
  page?: number;
  perPage?: number;
  status?: 'pending' | 'success' | 'failed' | 'all';
}

const PENDING_POLL_INTERVAL_MS = 5_000;
const STALE_TIME_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 60_000;

export function useBackups(filters: BackupsFilters = {}) {
  const query = useQuery({
    queryKey: ['backups', filters],
    queryFn: () => apiClient.getBackups(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });

  const hasPending = useMemo(
    () => (query.data?.data ?? []).some((backup: BackupLog) => backup.status === 'pending'),
    [query.data],
  );

  return {
    ...query,
    hasPending,
    pollIntervalMs: hasPending ? PENDING_POLL_INTERVAL_MS : false,
  };
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.createBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export interface BackupWorkerHealth {
  recent: boolean;
  pending: number;
  successLast24h: number;
  failedLast24h: number;
}

export function useBackupWorkerHealth(enabled = true) {
  return useQuery({
    queryKey: ['backups', 'worker-health'],
    queryFn: async (): Promise<BackupWorkerHealth> => {
      const health = await apiClient.getSystemHealth();
      const backups = health.backups ?? {};
      return {
        recent: Boolean(backups.worker_recently_active),
        pending: Number(backups.pending ?? 0),
        successLast24h: Number(backups.success_last_24h ?? 0),
        failedLast24h: Number(backups.failed_last_24h ?? 0),
      };
    },
    enabled,
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    staleTime: HEALTH_POLL_INTERVAL_MS / 2,
  });
}
