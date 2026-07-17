import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useBackups, useBackupWorkerHealth, useCreateBackup } from './useBackups';
import { useOperationalHealth } from './useServerStatus';
import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBackups: vi.fn(),
    createBackup: vi.fn(),
    getSystemHealth: vi.fn(),
  },
}));

vi.mock('@/lib/api/base', () => ({
  createClientIdempotencyKey: vi.fn(),
}));

const mockedGetBackups = vi.mocked(apiClient.getBackups);
const mockedCreateBackup = vi.mocked(apiClient.createBackup);
const mockedGetSystemHealth = vi.mocked(apiClient.getSystemHealth);
const mockedCreateClientIdempotencyKey = vi.mocked(createClientIdempotencyKey);

beforeEach(() => {
  stubVisibilityState('visible');
  mockedGetBackups.mockReset();
  mockedCreateBackup.mockReset();
  mockedGetSystemHealth.mockReset();
  mockedCreateClientIdempotencyKey.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function stubVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('useBackups', () => {
  it('exposes the api result and computes hasPending from the data', async () => {
    mockedGetBackups.mockResolvedValue({
      data: [
        {
          id: 1,
          size_bytes: 1024,
          status: 'pending',
          type: 'manual',
          created_by: 1,
          completed_at: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
          checksum_sha256: null,
        },
        {
          id: 2,
          size_bytes: 2048,
          status: 'success',
          type: 'manual',
          created_by: 1,
          completed_at: '2026-06-01T00:00:00Z',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
          checksum_sha256: 'abc123',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 2 },
    });

    const { result } = renderHook(() => useBackups({ page: 1, perPage: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasPending).toBe(true);
    expect(result.current.pollIntervalMs).toBe(5_000);
    expect(result.current.data?.data).toHaveLength(2);
  });

  it('returns hasPending=false and disables polling when no pending backup exists', async () => {
    mockedGetBackups.mockResolvedValue({
      data: [
        {
          id: 1,
          size_bytes: 1024,
          status: 'success',
          type: 'manual',
          created_by: 1,
          completed_at: '2026-06-01T00:00:00Z',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
          checksum_sha256: 'abc123',
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1 },
    });

    const { result } = renderHook(() => useBackups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasPending).toBe(false);
    expect(result.current.pollIntervalMs).toBe(false);
  });

  it('fails closed instead of crashing when the backup collection is malformed', async () => {
    mockedGetBackups.mockResolvedValue({
      data: { unexpected: 'payload' },
      meta: { current_page: 1, per_page: 25, total: 0 },
    } as never);

    const { result } = renderHook(() => useBackups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasPending).toBe(false);
    expect(result.current.pollIntervalMs).toBe(false);
  });

  it('does not poll pending backups while the tab is hidden', async () => {
    stubVisibilityState('hidden');
    mockedGetBackups.mockResolvedValue({
      data: [
        {
          id: 1,
          size_bytes: 1024,
          status: 'pending',
          type: 'manual',
          created_by: 1,
          completed_at: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
          checksum_sha256: null,
        },
      ],
      meta: { current_page: 1, per_page: 25, total: 1 },
    });

    const { result } = renderHook(() => useBackups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasPending).toBe(true);
    expect(result.current.pollIntervalMs).toBe(false);
  });
});

describe('useBackupWorkerHealth polling', () => {
  beforeEach(() => {
    mockedGetSystemHealth.mockReset();
  });

  it('maps a healthy snapshot with the projected shape', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      generated_at: '2026-06-02T08:00:00Z',
      database: { driver: 'mysql', connected: true },
      queue: { connection: 'database', pending: 0, failed: 0 },
      backups: {
        worker_recently_active: true,
        pending: 0,
        success_last_24h: 6,
        failed_last_24h: 0,
      },
      storage: { backup_files: 14, backup_bytes: 4_194_304 },
      recent_errors: [],
    });

    const { result } = renderHook(() => useBackupWorkerHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      recent: true,
      pending: 0,
      successLast24h: 6,
      failedLast24h: 0,
    });
  });

  it('shares the operational health request with the global status hook', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      generated_at: '2026-06-02T08:00:00Z',
      database: { driver: 'mysql', connected: true },
      queue: { connection: 'database', pending: 0, failed: 0 },
      backups: {
        worker_recently_active: true,
        pending: 0,
        success_last_24h: 6,
        failed_last_24h: 0,
      },
      storage: { backup_files: 14, backup_bytes: 4_194_304 },
      recent_errors: [],
    });

    const { result } = renderHook(() => ({
      operational: useOperationalHealth(),
      worker: useBackupWorkerHealth(),
    }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.operational.isSuccess).toBe(true);
      expect(result.current.worker.isSuccess).toBe(true);
    });

    expect(mockedGetSystemHealth).toHaveBeenCalledTimes(1);
  });

  it('flips the recent flag to false when the worker heartbeat is stale', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      generated_at: '2026-06-02T08:00:00Z',
      database: { driver: 'mysql', connected: true },
      queue: { connection: 'database', pending: 0, failed: 0 },
      backups: {
        worker_recently_active: false,
        pending: 0,
        success_last_24h: 0,
        failed_last_24h: 3,
      },
      storage: { backup_files: 10, backup_bytes: 1_048_576 },
      recent_errors: [],
    });

    const { result } = renderHook(() => useBackupWorkerHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.recent).toBe(false);
    expect(result.current.data?.failedLast24h).toBe(3);
  });

  it('skips the network round-trip when the hook is disabled', () => {
    const { result } = renderHook(() => useBackupWorkerHealth(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetSystemHealth).not.toHaveBeenCalled();
  });
});

describe('useCreateBackup', () => {
  it('invalidates the backups query key on success', async () => {
    mockedCreateClientIdempotencyKey.mockReturnValue('manual-backup-attempt-1');
    mockedCreateBackup.mockResolvedValue({
      id: 99,
      size_bytes: 0,
      status: 'pending',
      type: 'manual',
      created_by: 1,
      completed_at: null,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      checksum_sha256: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({
        create: useCreateBackup(),
      }),
      { wrapper },
    );

    await result.current.create.mutateAsync();

    expect(mockedCreateBackup).toHaveBeenCalledWith({
      idempotencyKey: 'manual-backup-attempt-1',
    });
  });

  it('reuses the idempotency key while retrying the same failed manual backup attempt', async () => {
    mockedCreateClientIdempotencyKey.mockReturnValue('manual-backup-attempt-1');
    mockedCreateBackup
      .mockRejectedValueOnce(new Error('LAN timeout'))
      .mockResolvedValueOnce({
        id: 99,
        size_bytes: 0,
        status: 'pending',
        type: 'manual',
        created_by: 1,
        completed_at: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
        checksum_sha256: null,
      });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateBackup(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow('LAN timeout');
    await result.current.mutateAsync();

    expect(mockedCreateBackup).toHaveBeenNthCalledWith(1, {
      idempotencyKey: 'manual-backup-attempt-1',
    });
    expect(mockedCreateBackup).toHaveBeenNthCalledWith(2, {
      idempotencyKey: 'manual-backup-attempt-1',
    });
    expect(mockedCreateClientIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('renews the idempotency key after a confirmed manual backup request', async () => {
    mockedCreateClientIdempotencyKey
      .mockReturnValueOnce('manual-backup-attempt-1')
      .mockReturnValueOnce('manual-backup-attempt-2');
    mockedCreateBackup
      .mockResolvedValueOnce({
        id: 99,
        size_bytes: 0,
        status: 'pending',
        type: 'manual',
        created_by: 1,
        completed_at: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
        checksum_sha256: null,
      })
      .mockResolvedValueOnce({
        id: 100,
        size_bytes: 0,
        status: 'pending',
        type: 'manual',
        created_by: 1,
        completed_at: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
        checksum_sha256: null,
      });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateBackup(), { wrapper });

    await result.current.mutateAsync();
    await result.current.mutateAsync();

    expect(mockedCreateBackup).toHaveBeenNthCalledWith(1, {
      idempotencyKey: 'manual-backup-attempt-1',
    });
    expect(mockedCreateBackup).toHaveBeenNthCalledWith(2, {
      idempotencyKey: 'manual-backup-attempt-2',
    });
  });
});

describe('useBackupWorkerHealth', () => {
  it('maps the operational health snapshot onto the worker shape', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      generated_at: '2026-06-02T08:00:00Z',
      database: { driver: 'mysql', connected: true },
      queue: { connection: 'database', pending: 0, failed: 0 },
      backups: {
        worker_recently_active: true,
        pending: 0,
        success_last_24h: 3,
        failed_last_24h: 1,
      },
      storage: { backup_files: 12, backup_bytes: 123_456 },
      recent_errors: [],
    });

    const { result } = renderHook(() => useBackupWorkerHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      recent: true,
      pending: 0,
      successLast24h: 3,
      failedLast24h: 1,
    });
  });

  it('falls back to zero counters when the backend returns no backups section', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      generated_at: '2026-06-02T08:00:00Z',
      database: { driver: 'sqlite', connected: true },
      queue: { connection: 'sync', pending: 0, failed: 0 },
      backups: {
        worker_recently_active: false,
        pending: 0,
        success_last_24h: 0,
        failed_last_24h: 0,
      },
      storage: { backup_files: 0, backup_bytes: 0 },
      recent_errors: [],
    });

    const { result } = renderHook(() => useBackupWorkerHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      recent: false,
      pending: 0,
      successLast24h: 0,
      failedLast24h: 0,
    });
  });
});
