import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutView } from './AboutView';
import { useBackups } from '../../hooks/useBackups';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { useServerStatus, useSystemStatusSnapshot } from '../../hooks/useServerStatus';
import type { SystemStatus } from '../../lib/api';

vi.mock('../../hooks/useBackups', () => ({
  useBackups: vi.fn(),
}));

vi.mock('../../hooks/useFiscalSettings', () => ({
  useFiscalSettings: vi.fn(),
}));

vi.mock('../../hooks/useServerStatus', () => ({
  useServerStatus: vi.fn(),
  useSystemStatusSnapshot: vi.fn(),
}));

describe('AboutView', () => {
  const cashierUser = {
    id: 2,
    name: 'Cajero Validacion',
    email: 'cajero.validacion@hospital-san-isidro.local',
    username: 'cajero.validacion',
    active: true,
    roles: ['cajero'],
    permissions: ['cash.view'],
    must_change_password: false,
  };
  const adminUser = {
    ...cashierUser,
    id: 1,
    name: 'Admin Hospital',
    username: 'admin.hospital',
    roles: ['admin'],
    permissions: ['backups.view'],
  };

  beforeEach(() => {
    vi.mocked(useFiscalSettings).mockReturnValue({
      data: { hospital_name: 'Hospital San Isidro' },
    } as ReturnType<typeof useFiscalSettings>);
    vi.mocked(useBackups).mockReturnValue({
      hasPending: false,
      pollIntervalMs: false,
      data: { data: [], meta: { current_page: 1, per_page: 1, total: 0 } },
      isError: false,
      error: null,
      isPending: false,
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useBackups>);
    vi.mocked(useSystemStatusSnapshot).mockReturnValue({
      data: mockSystemStatus(),
      isError: false,
      error: null,
      isPending: false,
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useSystemStatusSnapshot>);
  });

  it('shows the operational health summary in non-technical language', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Todo bien',
        level: 'ok',
      },
    });

    render(<AboutView user={cashierUser} onStatus={vi.fn()} />);

    expect(screen.getAllByText('Todo bien')).toHaveLength(2);
    expect(screen.getByText(/base de datos y respaldos responden/i)).toBeInTheDocument();
    await waitFor(() => expect(useBackups).toHaveBeenCalled());
    expect(useSystemStatusSnapshot).toHaveBeenCalledWith(false);
  });

  it('shows a review summary without exposing raw technical details', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Hay trabajos o respaldos con alerta. Revise Respaldos y pida soporte si el problema se repite.',
        label: 'Requiere revision',
        level: 'review',
      },
    });

    render(<AboutView user={cashierUser} onStatus={vi.fn()} />);

    expect(screen.getAllByText('Requiere revision')).toHaveLength(2);
    expect(screen.getByText(/pida soporte/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue:work|App\\\\|DB_PASSWORD|\.env|C:\\\\/i);
    await waitFor(() => expect(useBackups).toHaveBeenCalled());
  });

  it('shows protected administrative diagnostics with human-safe labels for admin users', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Todo bien',
        level: 'ok',
      },
    });

    render(<AboutView user={adminUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /diagnostico administrativo/i })).toBeInTheDocument();
    expect(screen.getByText('Servidor activo')).toBeInTheDocument();
    expect(screen.getByText('Conectada')).toBeInTheDocument();
    expect(screen.getByText('Compilada y disponible')).toBeInTheDocument();
    expect(screen.getByText('Sin fallas registradas')).toBeInTheDocument();
    expect(screen.getByText('Direccion LAN configurada')).toBeInTheDocument();
    expect(screen.getByText('Base actualizada')).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.1\.10:8000/i)).toBeInTheDocument();
    expect(screen.getByText(/America\/Tegucigalpa/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.0\.0-rc\.3/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue:work|APP_KEY|DB_PASSWORD|\.env|C:\\\\/i);
    expect(useSystemStatusSnapshot).toHaveBeenCalledWith(true);
  });
});

function mockSystemStatus(): SystemStatus {
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
      last_success_filename: 'hospital-backup.sql',
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
        worker_command: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
        scheduler_command: 'php artisan schedule:run',
      },
    },
    runtime: {
      logs_writable: true,
      cache_writable: true,
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000Z' },
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
      commands: {
        preflight: 'powershell.exe -ExecutionPolicy Bypass -File scripts\\production_readiness_preflight.ps1',
        backup_worker: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
        scheduler: 'php artisan schedule:run',
      },
    },
  };
}
