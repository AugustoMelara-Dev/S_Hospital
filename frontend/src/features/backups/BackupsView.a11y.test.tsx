import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BackupsView } from './BackupsView';
import {
  apiClient,
  type AuthUser,
  type BackupLog,
  type SystemStatus,
} from '../../lib/api';

describe('BackupsView accessibility', () => {
  it('has no axe-core violations and hides technical filenames on the view', async () => {
    vi.spyOn(apiClient, 'getBackups').mockResolvedValue({
      data: [backupFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(mockSystemStatus());

    const { container } = render(
      <BackupsView user={backupsUser()} onStatus={vi.fn()} />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Respaldo manual');
    });

    expect(screen.getByLabelText(/respaldos autom/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bworker\b/i);
    expect(container.textContent).not.toContain('hospital-backup-2026-06-01.sql');
    expect(container.textContent).not.toMatch(/\.sql\b/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps advanced backup diagnostics in non-technical language', async () => {
    vi.spyOn(apiClient, 'getBackups').mockResolvedValue({
      data: [backupFixture({ status: 'failed', error_message: 'SQLSTATE hidden from UI' })],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(mockSystemStatus({ failedJobs: 1 }));

    const { container } = render(
      <BackupsView user={backupsUser()} onStatus={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /ver detalle avanzado/i }));

    expect(await screen.findByText('Respaldos con error')).toBeInTheDocument();
    expect(screen.getByText('No se completo. Revise con soporte local.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\btareas\b|\btrabajos\b|\bcola\b|\bqueue\b|\bworker\b|SQLSTATE/i);
  });

  it('keeps backup filenames out of normal download messaging', async () => {
    vi.spyOn(apiClient, 'getBackups').mockResolvedValue({
      data: [backupFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(mockSystemStatus());
    vi.spyOn(apiClient, 'downloadBackup').mockResolvedValue(new Blob(['ok']));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const onStatus = vi.fn();

    const { container } = render(
      <BackupsView user={backupsUser()} onStatus={onStatus} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /descargar respaldo manual/i }));
    expect(screen.getByText(/descargar.*respaldo manual/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\.sql\b/i);

    fireEvent.click(screen.getByRole('button', { name: /^descargar$/i }));

    await waitFor(() => {
      expect(apiClient.downloadBackup).toHaveBeenCalledWith(1);
    });
    expect(onStatus).toHaveBeenLastCalledWith(expect.stringMatching(/^Respaldo manual .* descargado\.$/));
    expect(onStatus.mock.calls.flat().join(' ')).not.toMatch(/hospital-backup|\.sql/i);
  });
});

function backupsUser(): AuthUser {
  return {
    id: 1,
    name: 'Respaldos Hospital',
    email: 'respaldos@hospital-san-isidro.local',
    username: 'respaldos',
    active: true,
    roles: ['admin'],
    permissions: ['backups.create', 'backups.download'],
    must_change_password: false,
  };
}

function backupFixture(overrides: Partial<BackupLog> = {}): BackupLog {
  return {
    id: 1,
    filename: 'hospital-backup-2026-06-01.sql',
    size_bytes: 2_048,
    checksum_sha256: null,
    status: 'success',
    type: 'manual',
    created_by: 1,
    completed_at: '2026-06-01T08:00:00.000000Z',
    created_at: '2026-06-01T08:00:00.000000Z',
    updated_at: '2026-06-01T08:00:00.000000Z',
    error_message: null,
    creator: { id: 1, name: 'Admin Hospital', username: 'admin' },
    ...overrides,
  };
}

function mockSystemStatus(options: { failedJobs?: number } = {}): SystemStatus {
  return {
    environment: {
      app_env: 'production',
      app_debug: false,
      app_url: 'http://192.168.1.10:8000',
      queue_connection: 'database',
      filesystem_disk: 'local',
      app_version: '1.0.0-rc.3',
      php_version: '8.3.0',
      server_time: '2026-06-02T14:00:00.000000Z',
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
      last_success_at: '2026-06-01T08:00:00.000000Z',
      last_success_filename: 'hospital-backup-2026-06-01.sql',
      last_failure_at: null,
      last_failure_message: null,
      dump_binary: { configured: true, available: true, name: 'mariadb-dump' },
      storage: { writable: true, free_bytes: 2_147_483_648 },
      queue: {
        connection: 'database',
        jobs_table_available: true,
        failed_jobs_table_available: true,
        failed_jobs_count: options.failedJobs ?? 0,
        pending_backup_jobs: 0,
        worker_command: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
        scheduler_command: 'php artisan schedule:run',
        scheduler_heartbeat: {
          status: 'ok',
          last_tick_at: '2026-06-01T07:59:00.000000Z',
          last_result: 'ok',
          last_message: '',
          age_seconds: 60,
          ticks_in_db: 1200,
          ticks_last_24h: 1200,
          expected: 'ticks_last_24h >= 1400',
        },
      },
    },
    runtime: {
      logs_writable: true,
      cache_writable: true,
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-01T08:00:00.000000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-01T08:00:00.000000Z' },
      latest_migration: '2026_06_01_000001_test',
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
