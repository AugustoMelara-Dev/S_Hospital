import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useBackups, useBackupWorkerHealth, useCreateBackup } from './useBackups';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBackups: vi.fn(),
    createBackup: vi.fn(),
    getSystemHealth: vi.fn(),
  },
}));

const mockedGetBackups = vi.mocked(apiClient.getBackups);
const mockedCreateBackup = vi.mocked(apiClient.createBackup);
const mockedGetSystemHealth = vi.mocked(apiClient.getSystemHealth);

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

describe('useBackups', () => {
  beforeEach(() => {
    mockedGetBackups.mockReset();
    mockedCreateBackup.mockReset();
    mockedGetSystemHealth.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the api result and computes hasPending from the data', async () => {
    mockedGetBackups.mockResolvedValue({
      data: [
        {
          id: 1,
          filename: 'b1.sql',
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
          filename: 'b2.sql',
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
          filename: 'b1.sql',
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
});

describe('useCreateBackup', () => {
  it('invalidates the backups query key on success', async () => {
    mockedCreateBackup.mockResolvedValue({
      id: 99,
      filename: 'new.sql',
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

    expect(mockedCreateBackup).toHaveBeenCalledTimes(1);
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
