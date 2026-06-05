import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useServerStatus } from './useServerStatus';

describe('useServerStatus', () => {
  it('reads the public operational health endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: healthySnapshot() }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ServerStatusProbe />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/system/health');
  });

  it('summarizes a healthy LAN server in cashier-safe language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: healthySnapshot() }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );

    render(<ServerStatusProbe />);

    expect(await screen.findByText('Todo bien')).toBeInTheDocument();
    expect(screen.getByText(/servidor local, base de datos y respaldos responden/i)).toBeInTheDocument();
  });

  it('turns database failures into an actionable operator summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: healthySnapshot({ database: { connected: false, driver: 'sqlite' } }) }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );

    render(<ServerStatusProbe />);

    expect(await screen.findByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/base de datos local no responde/i)).toBeInTheDocument();
  });

  it('summarizes backup alerts without exposing queue terminology', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: healthySnapshot({ queue: { connection: 'database', failed: 1, pending: 0 } }) }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );

    render(<ServerStatusProbe />);

    expect(await screen.findByText('Requiere revision')).toBeInTheDocument();
    expect(screen.getByText(/respaldos en espera o con alerta/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/trabajos|cola|queue/i);
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
  recent_errors: Array<{ action: string; created_at: string }>;
};
