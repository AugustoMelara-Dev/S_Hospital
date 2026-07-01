import { useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient, type BackupLog } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { invalidateBackupQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export interface BackupsFilters {
  page?: number;
  perPage?: number;
  status?: 'pending' | 'success' | 'failed' | 'all';
  enabled?: boolean;
}

const PENDING_POLL_INTERVAL_MS = 5_000;
const STALE_TIME_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 60_000;

export function useBackups(filters: BackupsFilters = {}) {
  const { enabled = true, ...apiFilters } = filters;
  const query = useQuery({
    queryKey: queryKeys.backups.list(apiFilters),
    queryFn: () => apiClient.getBackups(apiFilters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
    refetchInterval: (currentQuery) => {
      const backups = currentQuery.state.data?.data ?? [];
      return backups.some((backup: BackupLog) => backup.status === 'pending')
        ? PENDING_POLL_INTERVAL_MS
        : false;
    },
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
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: () => {
      idempotencyKeyRef.current ??= createClientIdempotencyKey();

      return apiClient.createBackup({
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      return invalidateBackupQueries(queryClient);
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
    queryKey: queryKeys.backups.workerHealth(),
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
