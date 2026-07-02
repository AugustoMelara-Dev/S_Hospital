import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
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

  it('renders concise backup guidance without restore or delete actions', async () => {
    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    expect(await screen.findByRole('heading', { level: 1, name: /respaldos/i })).toBeInTheDocument();
    expect(screen.getByText(/restauraci.n no disponible desde la app/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite soporte/i)).toBeInTheDocument();
    expect(screen.queryByText(/^1\. crear$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^2\. verificar$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^3\. restaurar con prueba$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restaurar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).not.toBeInTheDocument();
  });

  it('describes restore validation blockers as support recovery work in the normal view', async () => {
    const status = systemStatusFixture();
    vi.mocked(apiClient.getSystemStatus).mockResolvedValue({
      ...status,
      readiness: {
        ...status.readiness,
        blockers: [
          {
            code: 'PENDING_RESTORE_VALIDATION',
            label: 'Validar restauracion segura',
            status: 'pending',
          },
        ],
      },
    });

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const pendingTitle = await screen.findByText(/pendientes antes de operar/i);
    const pendingAlert = pendingTitle.closest('[data-slot="alert"]');

    expect(pendingAlert).not.toBeNull();
    expect(pendingAlert).toHaveTextContent(/recuperacion con soporte/i);
    expect(pendingAlert).not.toHaveTextContent(/restaur/i);
  });

  it('keeps the primary backup KPIs limited to last success, pending and failed backups', async () => {
    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const kpis = await screen.findByRole('region', { name: /indicadores principales de respaldos/i });

    expect(within(kpis).getByText(/^ultimo exitoso$/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/^pendientes$/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/^fallidos$/i)).toBeInTheDocument();
    expect(within(kpis).queryByText(/worker/i)).not.toBeInTheDocument();
    expect(within(kpis).getAllByText(/^ultimo exitoso$|^pendientes$|^fallidos$/i)).toHaveLength(3);
  });

  it('does not render a second visible status card row below the backup KPIs', async () => {
    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    await screen.findByRole('region', { name: /indicadores principales de respaldos/i });

    expect(screen.queryByText(/^Sin pendientes$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Sin fallos$/i)).not.toBeInTheDocument();
  });

  it('keeps support diagnostics collapsed behind a human support label', async () => {
    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const diagnosticsButton = await screen.findByRole('button', { name: /ver detalle de soporte/i });

    expect(diagnosticsButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/checklist operativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pruebas de campo obligatorias/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /detalle avanzado/i })).not.toBeInTheDocument();

    fireEvent.click(diagnosticsButton);

    expect(await screen.findByText(/checklist operativo/i)).toBeInTheDocument();
    expect(screen.getByText(/pruebas de campo obligatorias/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocultar detalle de soporte/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders an accessible loading state while backups are loading', async () => {
    vi.mocked(apiClient.getBackups).mockReturnValue(new Promise<never>(() => undefined));
    vi.mocked(apiClient.getSystemStatus).mockReturnValue(new Promise<never>(() => undefined));

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    expect(await screen.findByText(/cargando respaldos locales/i)).toBeInTheDocument();
  });

  it('renders the table with caption, numeric size column and text status descriptions', async () => {
    vi.mocked(apiClient.getBackups).mockResolvedValue({
      data: [
        backupFixture({ id: 1, status: 'pending', filename: 'hospital-backup-pending.sql.enc', checksum_sha256: null, completed_at: null }),
        backupFixture({ id: 2, status: 'success', filename: 'hospital-backup-success.sql.enc' }),
        backupFixture({ id: 3, status: 'failed', filename: 'hospital-backup-failed.sql.enc', error_message: 'SQLSTATE secret path' }),
      ],
      meta: { current_page: 1, per_page: 15, total: 3 },
    });

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    expect(await screen.findByRole('table', { name: /historial de respaldos locales/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /historial de respaldos locales/i })).toBeInTheDocument();
    const headerLabels = screen.getAllByRole('columnheader').map((header) => normalizeLabel(header.textContent ?? ''));
    expect(headerLabels).toEqual([
      'Fecha',
      'Estado',
      'Tamano',
      'Usuario',
      'Acciones',
    ]);
    expect(screen.getByRole('columnheader', { name: /fecha/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /tamaño/i })).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('columnheader', { name: /usuario/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /acciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /nombre/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/hospital-backup-.*\.sql\.enc/i)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /historial de respaldos locales/i })).not.toHaveTextContent(/restaur/i);
    expect(screen.getAllByRole('cell').some((cell) => cell.getAttribute('data-numeric') === 'true')).toBe(true);
    expect(screen.getByText(/respaldo en proceso/i)).toBeInTheDocument();
    expect(screen.getByText(/archivo creado correctamente/i)).toBeInTheDocument();
    expect(screen.getByText(/no se pudo completar\. revise con soporte/i)).toBeInTheDocument();
    expect(screen.queryByText(/worker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sha256/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/abc12345/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sqlstate|secret|path/i)).not.toBeInTheDocument();
  });

  it('renders a sanitized error and retries without exposing local secrets', async () => {
    const getBackups = vi.mocked(apiClient.getBackups);
    getBackups
      .mockRejectedValueOnce(new Error('DB_PASSWORD=secret C:\\Users\\admin\\hospital\\.env'))
      .mockResolvedValueOnce({
        data: [backupFixture()],
        meta: { current_page: 1, per_page: 15, total: 1 },
      });

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudieron cargar los respaldos/i);
    expect(alert).not.toHaveTextContent(/db_password|secret|users|\.env/i);

    fireEvent.click(screen.getByRole('button', { name: /reintentar carga/i }));

    await screen.findByRole('table', { name: /historial de respaldos locales/i });
    expect(getBackups).toHaveBeenLastCalledWith({ page: 1, status: 'all' });
  });

  it('preserves permission gating for create and download actions', async () => {
    const readonlyUser = {
      ...adminUser,
      permissions: ['backups.view'],
    };
    vi.spyOn(apiClient, 'downloadBackup').mockResolvedValue(new Blob(['backup-data']));

    renderWithQueryClient(<BackupsView user={readonlyUser} onStatus={() => undefined} />);

    await screen.findByRole('table', { name: /historial de respaldos locales/i });
    expect(screen.queryByRole('button', { name: /^crear respaldo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descargar respaldo/i })).not.toBeInTheDocument();
    expect(apiClient.downloadBackup).not.toHaveBeenCalled();
  });

  it('keeps status filters controlled by the view without changing query params', async () => {
    const getBackups = vi.mocked(apiClient.getBackups);

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    await screen.findByRole('table', { name: /historial de respaldos locales/i });
    fireEvent.click(screen.getByRole('button', { name: /completados/i }));

    await waitFor(() => {
      expect(getBackups).toHaveBeenLastCalledWith({ page: 1, status: 'success' });
    });
    expect(screen.getByRole('button', { name: /completados/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the current backup history visible while a status filter refetch is pending', async () => {
    let resolveFilteredBackups!: (response: Awaited<ReturnType<typeof apiClient.getBackups>>) => void;
    const getBackups = vi.mocked(apiClient.getBackups);
    getBackups
      .mockResolvedValueOnce({
        data: [backupFixture({
          filename: 'hospital-backup-visible-during-refetch.sql.enc',
          creator: { id: 9, name: 'Operador Visible', username: 'operador.visible' },
        })],
        meta: { current_page: 1, per_page: 15, total: 1 },
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFilteredBackups = resolve;
      }));

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    expect(await screen.findByText(/operador visible/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /completados/i }));

    await waitFor(() => {
      expect(getBackups).toHaveBeenLastCalledWith({ page: 1, status: 'success' });
    });
    expect(screen.getByText(/operador visible/i)).toBeInTheDocument();

    act(() => {
      resolveFilteredBackups({
        data: [backupFixture({ id: 2, filename: 'hospital-backup-filtered.sql.enc' })],
        meta: { current_page: 1, per_page: 15, total: 1 },
      });
    });
  });

  it('prevents duplicate manual backup creation while the request is pending', async () => {
    let resolveCreate!: (backup: BackupLog) => void;
    const pendingCreate = new Promise<BackupLog>((resolve) => {
      resolveCreate = resolve;
    });
    const createBackup = vi.spyOn(apiClient, 'createBackup').mockReturnValue(pendingCreate);

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /^crear respaldo$/i }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /^crear respaldo$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(createBackup).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    });

    await act(async () => {
      resolveCreate(backupFixture({ id: 2, filename: 'hospital-backup-new.sql.enc' }));
      await pendingCreate;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^crear respaldo$/i })).toBeEnabled();
    });
  });

  it('reports manual backup completion without exposing checksum terminology', async () => {
    const onStatus = vi.fn();
    vi.spyOn(apiClient, 'createBackup').mockResolvedValue(backupFixture({ id: 7, filename: 'hospital-backup-created.sql.enc' }));

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={onStatus} />);

    fireEvent.click(await screen.findByRole('button', { name: /^crear respaldo$/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^crear respaldo$/i }));

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith('Respaldo completado correctamente.');
    });
    expect(onStatus.mock.calls.flat().join(' ')).not.toMatch(/sha256|checksum|huella/i);
  });

  it('describes stale pending backups without worker or scheduler jargon', async () => {
    const status = systemStatusFixture();
    vi.mocked(apiClient.getSystemStatus).mockResolvedValue({
      ...status,
      backups: {
        ...status.backups,
        pending_count: 2,
        stale_pending_count: 2,
        stale_pending_threshold_minutes: 15,
        worker_recently_active: false,
      },
    });

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    expect(await screen.findByText(/respaldos pendientes por demasiado tiempo/i)).toBeInTheDocument();
    expect(screen.getByText(/revise el estado del servidor local/i)).toBeInTheDocument();
    expect(screen.queryByText(/worker|scheduler/i)).not.toBeInTheDocument();
  });

  it('prevents duplicate backup downloads while the file request is pending', async () => {
    let resolveDownload!: (blob: Blob) => void;
    const pendingDownload = new Promise<Blob>((resolve) => {
      resolveDownload = resolve;
    });
    const downloadBackup = vi.spyOn(apiClient, 'downloadBackup').mockReturnValue(pendingDownload);

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={() => undefined} />);

    const downloadButton = await screen.findByRole('button', {
      name: /descargar respaldo del/i,
    });
    fireEvent.click(downloadButton);
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /^descargar$/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(downloadBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: /descargar respaldo del/i,
      })).toBeDisabled();
    });

    await act(async () => {
      resolveDownload(new Blob(['backup-data'], { type: 'application/octet-stream' }));
      await pendingDownload;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: /descargar respaldo del/i,
      })).toBeEnabled();
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup-download');
  });

  it('confirms and reports backup downloads without exposing the technical filename', async () => {
    const onStatus = vi.fn();
    vi.spyOn(apiClient, 'downloadBackup').mockResolvedValue(new Blob(['backup-data'], { type: 'application/octet-stream' }));

    renderWithQueryClient(<BackupsView user={adminUser} onStatus={onStatus} />);

    fireEvent.click(await screen.findByRole('button', { name: /descargar respaldo del/i }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/descargara el respaldo seleccionado/i);
    expect(dialog).not.toHaveTextContent(/hospital-backup-.*\.sql\.enc/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /^descargar$/i }));

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith('Respaldo descargado correctamente.');
    });
    expect(onStatus.mock.calls.flat().join(' ')).not.toMatch(/hospital-backup-.*\.sql\.enc/i);
  });
});

function renderWithQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

function normalizeLabel(value: string): string {
  return value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function backupFixture(overrides: Partial<BackupLog> = {}): BackupLog {
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
    ...overrides,
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
