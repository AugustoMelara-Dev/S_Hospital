import { useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient, type BackupLog } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
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

function backupRows(result: unknown): BackupLog[] {
  if (!result || typeof result !== 'object' || !('data' in result)) {
    return [];
  }

  const data = (result as { data?: unknown }).data;
  return Array.isArray(data) ? data as BackupLog[] : [];
}

export function useBackups(filters: BackupsFilters = {}) {
  const { enabled = true, ...apiFilters } = filters;
  const query = useQuery({
    queryKey: queryKeys.backups.list(apiFilters),
    queryFn: () => apiClient.getBackups(apiFilters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
    refetchInterval: (currentQuery) => {
      const backups = backupRows(currentQuery.state.data);
      return backups.some((backup: BackupLog) => backup.status === 'pending')
        ? getVisibleRefetchInterval(PENDING_POLL_INTERVAL_MS)
        : false;
    },
  });

  const hasPending = useMemo(
    () => backupRows(query.data).some((backup) => backup.status === 'pending'),
    [query.data],
  );

  return {
    ...query,
    hasPending,
    pollIntervalMs: hasPending ? getVisibleRefetchInterval(PENDING_POLL_INTERVAL_MS) : false,
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
    queryKey: queryKeys.system.health(),
    queryFn: () => apiClient.getSystemHealth(),
    select: (health): BackupWorkerHealth => {
      const backups = health.backups ?? {};
      return {
        recent: Boolean(backups.worker_recently_active),
        pending: Number(backups.pending ?? 0),
        successLast24h: Number(backups.success_last_24h ?? 0),
        failedLast24h: Number(backups.failed_last_24h ?? 0),
      };
    },
    enabled,
    refetchInterval: () => getVisibleRefetchInterval(HEALTH_POLL_INTERVAL_MS),
    staleTime: HEALTH_POLL_INTERVAL_MS / 2,
  });
}
