import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportCenterView } from './SupportCenterView';
import { apiClient, type AuthUser, type SystemStatus, type SystemStatusSummary } from '../../lib/api';

describe('SupportCenterView', () => {
  const cashierUser: AuthUser = {
    id: 2,
    name: 'Cajero Validacion',
    email: 'cajero.validacion@hospital-san-isidro.local',
    username: 'cajero.validacion',
    active: true,
    roles: ['cajero'],
    permissions: ['cash.view'],
    must_change_password: false,
  };

  const supportUser: AuthUser = {
    ...cashierUser,
    id: 3,
    name: 'Soporte Local',
    roles: ['admin'],
    permissions: ['system.status.view'],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading and successful cashier-safe status without advanced diagnostics', async () => {
    const getSummary = vi.spyOn(apiClient, 'getSystemStatusSummary').mockResolvedValue(systemStatusSummary());
    const getStatus = vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatus());
    const onStatus = vi.fn();

    render(<SupportCenterView user={cashierUser} onStatus={onStatus} />);

    expect(screen.getByRole('status', { name: /cargando diagnóstico operativo/i })).toBeInTheDocument();
    expect((await screen.findAllByText('Todo bien')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/servidor local disponible/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/diagnostico tecnico detallado se mantiene reservado/i)).toBeInTheDocument();
    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getStatus).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith({
      key: 'support:diagnostic:refresh',
      level: 'success',
      message: 'Diagnostico operativo actualizado.',
      toast: false,
    });
    expect(document.body.textContent).not.toMatch(/DB_PASSWORD|APP_KEY|\.env|queue:work/i);
  });

  it('renders advanced operational metrics only for authorized users', async () => {
    vi.spyOn(apiClient, 'getSystemStatusSummary').mockResolvedValue(systemStatusSummary());
    const getStatus = vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatus());

    render(<SupportCenterView user={supportUser} onStatus={vi.fn()} />);

    expect((await screen.findAllByText(/2\/6\/2026/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/fecha protegida mas reciente/i)).toBeInTheDocument();
    expect(screen.queryByText('hospital-backup.sql')).not.toBeInTheDocument();
    expect(screen.getByText('MySQL/MariaDB')).toBeInTheDocument();
    expect(screen.getByText(/hora servidor/i)).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('starts independent summary and advanced diagnostics concurrently', async () => {
    let resolveSummary!: (summary: SystemStatusSummary) => void;
    const summaryRequest = new Promise<SystemStatusSummary>((resolve) => {
      resolveSummary = resolve;
    });
    const getSummary = vi.spyOn(apiClient, 'getSystemStatusSummary').mockReturnValue(summaryRequest);
    const getStatus = vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatus());

    render(<SupportCenterView user={supportUser} onStatus={vi.fn()} />);

    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(1));
    const advancedCallsBeforeSummaryResolved = getStatus.mock.calls.length;

    await act(async () => {
      resolveSummary(systemStatusSummary());
      await summaryRequest;
    });
    await screen.findByText('MySQL/MariaDB');

    expect(advancedCallsBeforeSummaryResolved).toBe(1);
  });

  it('does not show an unconfirmed backup as protected in advanced metrics', async () => {
    vi.spyOn(apiClient, 'getSystemStatusSummary').mockResolvedValue(systemStatusSummary({ label: 'Requiere revision', severity: 'warning', problem_count: 1 }));
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue({
      ...systemStatus(),
      backups: {
        ...systemStatus().backups,
        last_success_file_exists: false,
        last_success_checksum_matches: false,
      },
    });

    render(<SupportCenterView user={supportUser} onStatus={vi.fn()} />);

    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/cree un respaldo nuevo/i)).toBeInTheDocument();
    expect(screen.queryByText(/fecha protegida mas reciente/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hospital-backup|checksum|sha/i);
  });

  it('renders an accessible error with retry and keeps support playbooks visible', async () => {
    const getSummary = vi
      .spyOn(apiClient, 'getSystemStatusSummary')
      .mockRejectedValueOnce(new Error('DB_PASSWORD=secret internal failure'))
      .mockResolvedValueOnce(systemStatusSummary({ label: 'Requiere revision', severity: 'warning', problem_count: 1 }));
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatus());
    const onStatus = vi.fn();

    render(<SupportCenterView user={cashierUser} onStatus={onStatus} />);

    expect(await screen.findByText(/no se pudo cargar el diagnostico operativo/i)).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'support:diagnostic:refresh',
      level: 'error',
      toast: false,
    }));
    expect(document.body.textContent).not.toMatch(/DB_PASSWORD=secret/i);
    expect(screen.getByRole('heading', { name: /cajero/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reintentar diagnóstico/i }));

    expect((await screen.findAllByText('Requiere revision')).length).toBeGreaterThan(0);
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'support:diagnostic:refresh',
      level: 'success',
    }));
  });

  it('keeps icon buttons and state controls accessible by name', async () => {
    vi.spyOn(apiClient, 'getSystemStatusSummary').mockResolvedValue(systemStatusSummary());
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatus());

    render(<SupportCenterView user={cashierUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /actualizar diagnostico operativo/i })).toBeInTheDocument();
    expect(screen.getAllByText(/validado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/todo bien/i).length).toBeGreaterThan(0);
  });
});

function systemStatusSummary(
  summary: Partial<SystemStatusSummary['summary']> = {},
): SystemStatusSummary {
  return {
    summary: {
      severity: 'ok',
      problem_count: 0,
      label: 'Todo bien',
      action: 'Servidor local disponible para operar.',
      ...summary,
    },
    checks: [
      {
        code: 'backend',
        label: 'Backend',
        status: 'validated',
        detail: 'Servidor local disponible.',
      },
      {
        code: 'lan',
        label: 'Red local',
        status: summary.severity === 'warning' ? 'warning' : 'validated',
        detail: 'Clientes pueden acceder por la direccion LAN configurada.',
      },
    ],
    advanced_available: true,
  };
}

function systemStatus(): SystemStatus {
  return {
    environment: {
      app_env: 'production',
      app_debug: false,
      app_url: 'http://192.168.1.10:8000',
      queue_connection: 'database',
      filesystem_disk: 'local',
      app_version: '1.0.0-rc.3',
      php_version: '8.3.0',
      server_time: '2026-06-02T14:00:00.000Z',
      timezone: 'America/Tegucigalpa',
    },
    database: {
      connection: 'mysql',
      driver: 'mysql',
      is_mysql_family: true,
      connected: true,
    },
    frontend: {
      dist_index_exists: true,
      assets_present: true,
      assets_count: 8,
      entry_label: 'frontend/dist/index.html',
    },
    network: {
      configured_host: '192.168.1.10',
      host_type: 'lan',
      lan_ready: true,
      client_url: 'http://192.168.1.10:8000',
      guidance: 'Clientes deben entrar por esta direccion LAN.',
    },
    backups: {
      pending_count: 0,
      worker_recently_active: true,
      last_success_at: '2026-06-02T13:00:00.000Z',
      last_failure_at: null,
      last_failure_message: null,
      dump_binary: { configured: true, available: true, name: 'mariadb-dump' },
      storage: { writable: true, free_bytes: 2_147_483_648 },
      queue: {
        connection: 'database',
        jobs_table_available: true,
        failed_jobs_table_available: true,
        failed_jobs_count: 0,
        pending_backup_jobs: 0,
      },
    },
    runtime: {
      logs_writable: true,
      cache_writable: true,
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000Z' },
      frontend_build: { available: true, modified_at: '2026-06-02T13:00:00.000Z' },
      installed_version: '0.1.0',
      latest_migration: '2026_06_02_000001_test',
      migration_count: 42,
      pending_migration_count: 0,
      pending_migrations: [],
    },
    readiness: {
      state: 'PRODUCTION_CANDIDATE',
      production_ready: false,
      blockers: [],
    },
    preflight: {
      production_checks: [],
      public_routes: [],
      physical_proofs: [],
    },
  };
}
