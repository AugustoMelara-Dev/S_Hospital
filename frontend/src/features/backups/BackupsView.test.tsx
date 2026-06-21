import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupsView } from './BackupsView';
import { apiClient, type AuthUser, type BackupLog, type SystemStatus } from '../../lib/api';

const adminUser: AuthUser = {
  id: 1,
  name: 'Administradora Hospital',
  email: 'admin.hospital@local.test',
  username: 'admin.hospital',
  active: true,
  roles: ['admin'],
  permissions: ['backups.view', 'backups.create', 'backups.download'],
  must_change_password: false,
};

describe('BackupsView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getBackups').mockResolvedValue({
      data: [backupFixture()],
      meta: { current_page: 1, per_page: 15, total: 1 },
    });
    vi.spyOn(apiClient, 'getSystemStatus').mockResolvedValue(systemStatusFixture());
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:backup-download'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('prevents duplicate manual backup creation while the request is pending', async () => {
    let resolveCreate!: (backup: BackupLog) => void;
    const pendingCreate = new Promise<BackupLog>((resolve) => {
      resolveCreate = resolve;
    });
    const createBackup = vi.spyOn(apiClient, 'createBackup').mockReturnValue(pendingCreate);

    render(<BackupsView user={adminUser} onStatus={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /^crear respaldo$/i }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /^crear respaldo$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(createBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    });

    await act(async () => {
      resolveCreate({ ...backupFixture(), id: 2, filename: 'hospital-backup-new.sql.enc' });
      await pendingCreate;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^crear respaldo$/i })).toBeEnabled();
    });
  });

  it('prevents duplicate backup downloads while the file request is pending', async () => {
    let resolveDownload!: (blob: Blob) => void;
    const pendingDownload = new Promise<Blob>((resolve) => {
      resolveDownload = resolve;
    });
    const downloadBackup = vi.spyOn(apiClient, 'downloadBackup').mockReturnValue(pendingDownload);

    render(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const downloadButton = await screen.findByRole('button', {
      name: /descargar respaldo hospital-backup-20260618-120000-test\.sql\.enc/i,
    });
    fireEvent.click(downloadButton);
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /^descargar$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(downloadBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: /descargar respaldo hospital-backup-20260618-120000-test\.sql\.enc/i,
      })).toBeDisabled();
    });

    await act(async () => {
      resolveDownload(new Blob(['backup-data'], { type: 'application/octet-stream' }));
      await pendingDownload;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: /descargar respaldo hospital-backup-20260618-120000-test\.sql\.enc/i,
      })).toBeEnabled();
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup-download');
  });
});

function backupFixture(): BackupLog {
  return {
    id: 1,
    filename: 'hospital-backup-20260618-120000-test.sql.enc',
    size_bytes: 3_145_728,
    checksum_sha256: 'abc1234567890defabc1234567890defabc1234567890defabc1234567890def',
    status: 'success',
    type: 'manual',
    created_by: 1,
    completed_at: '2026-06-18T12:01:00.000Z',
    created_at: '2026-06-18T12:00:00.000Z',
    updated_at: '2026-06-18T12:01:00.000Z',
    error_message: null,
    creator: { id: 1, name: 'Administradora Hospital', username: 'admin.hospital' },
  };
}

function systemStatusFixture(): SystemStatus {
  return {
    environment: {
      app_env: 'production',
      app_debug: false,
      app_url: 'http://192.168.1.7:8081',
      queue_connection: 'database',
      filesystem_disk: 'local',
      app_version: '1.0.0-rc.4',
      php_version: '8.3.0',
      server_time: '2026-06-18T12:02:00.000Z',
      timezone: 'America/Tegucigalpa',
    },
    database: {
      connection: 'mysql',
      driver: 'mysql',
      connected: true,
      is_mysql_family: true,
    },
    frontend: {
      dist_index_exists: true,
      assets_present: true,
      assets_count: 8,
      entry_label: 'frontend/dist/index.html',
    },
    network: {
      configured_host: '192.168.1.7',
      host_type: 'lan',
      lan_ready: true,
      client_url: 'http://192.168.1.7:8081',
      guidance: 'Clientes deben entrar por esta direccion LAN.',
    },
    backups: {
      pending_count: 0,
      worker_recently_active: true,
      stale_pending_count: 0,
      stale_pending_threshold_minutes: 15,
      last_success_at: '2026-06-18T12:01:00.000Z',
      last_success_filename: 'hospital-backup-20260618-120000-test.sql.enc',
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
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-18T12:01:00.000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-18T12:01:00.000Z' },
      frontend_build: { available: true, modified_at: '2026-06-18T12:01:00.000Z' },
      installed_version: '1.0.0-rc.4',
      latest_migration: '2026_06_16_000001_allow_zero_cash_closing_movement_constraint',
      migration_count: 55,
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
