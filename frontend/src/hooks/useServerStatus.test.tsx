import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useServerStatus } from './useServerStatus';
import { ApiError, apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  apiClient: {
    getSystemHealth: vi.fn(),
  },
}));

const mockedGetSystemHealth = vi.mocked(apiClient.getSystemHealth);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useServerStatus', () => {
  it('reads the public operational health query once the hook mounts', async () => {
    mockedGetSystemHealth.mockResolvedValue(healthySnapshot());

    render(<ServerStatusProbe />, { wrapper: createWrapper() });

    await waitFor(() => expect(mockedGetSystemHealth).toHaveBeenCalledTimes(1));
  });

  it('summarizes a healthy LAN server in cashier-safe language', async () => {
    mockedGetSystemHealth.mockResolvedValue(healthySnapshot());

    render(<ServerStatusProbe />, { wrapper: createWrapper() });

    expect(await screen.findByText('Todo bien')).toBeInTheDocument();
    expect(screen.getByText(/servidor local, base de datos y respaldos responden/i)).toBeInTheDocument();
  });

  it('turns database failures into an actionable operator summary', async () => {
    mockedGetSystemHealth.mockResolvedValue(
      healthySnapshot({ database: { connected: false, driver: 'sqlite' } }),
    );

    render(<ServerStatusProbe />, { wrapper: createWrapper() });

    expect(await screen.findByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/base de datos local no responde/i)).toBeInTheDocument();
  });

  it('does not describe 401 health responses as offline network failures', async () => {
    mockedGetSystemHealth.mockRejectedValue(new ApiError('Unauthenticated.', 401));

    render(<ServerStatusProbe />, { wrapper: createWrapper() });

    expect(await screen.findByText(/servidor local responde/i)).toBeInTheDocument();
    expect(screen.getByText('Requiere revision')).toBeInTheDocument();
    expect(screen.queryByText(/computadora servidor este encendida/i)).not.toBeInTheDocument();
  });
});

function ServerStatusProbe() {
  const { summary } = useServerStatus();

  return (
    <div>
      <p>{summary.label}</p>
      <p>{summary.description}</p>
    </div>
  );
}

function healthySnapshot(overrides: Partial<OperationalHealthFixture> = {}): OperationalHealthFixture {
  return {
    generated_at: '2026-06-02T08:00:00-06:00',
    database: {
      connected: true,
      driver: 'sqlite',
      ...overrides.database,
    },
    queue: {
      connection: 'database',
      failed: 0,
      pending: 0,
      ...overrides.queue,
    },
    backups: {
      failed_last_24h: 0,
      pending: 0,
      success_last_24h: 1,
      worker_recently_active: true,
      ...overrides.backups,
    },
    storage: {
      backup_bytes: 1024,
      backup_files: 2,
      ...overrides.storage,
    },
    recent_errors: [],
  };
}

type OperationalHealthFixture = {
  generated_at: string;
  database: {
    connected: boolean;
    driver: string;
  };
  queue: {
    connection: string;
    failed: number;
    pending: number;
  };
  backups: {
    failed_last_24h: number;
    pending: number;
    success_last_24h: number;
    worker_recently_active: boolean;
  };
  storage: {
    backup_bytes: number;
    backup_files: number;
  };
  recent_errors: Array<{ id: number; action: string; entity_type: string; created_at: string }>;
};
