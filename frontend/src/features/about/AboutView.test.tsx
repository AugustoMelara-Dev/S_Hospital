import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutView } from './AboutView';
import { useBackups } from '../../hooks/useBackups';
import { usePublicBranding } from '../../hooks/useFiscalSettings';
import { useServerStatus, useSystemStatusSnapshot } from '../../hooks/useServerStatus';
import type { SystemStatus } from '../../lib/api';

vi.mock('../../hooks/useBackups', () => ({
  useBackups: vi.fn(),
}));

vi.mock('../../hooks/useFiscalSettings', () => ({
  usePublicBranding: vi.fn(),
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
    vi.mocked(usePublicBranding).mockReturnValue({
      data: { hospital_name: 'Hospital San Isidro' },
    } as ReturnType<typeof usePublicBranding>);
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

  afterEach(() => {
    vi.useRealTimers();
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

    expect(screen.getByRole('heading', { level: 1, name: /informacion del sistema/i })).toBeInTheDocument();
    expect(screen.getAllByText('Todo bien')).toHaveLength(2);
    expect(screen.getByText(/base de datos y respaldos responden/i)).toBeInTheDocument();
    await waitFor(() => expect(useBackups).toHaveBeenCalledWith({ page: 1, perPage: 1, enabled: false }));
    expect(screen.getByText('Sin permiso')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /diagnostico administrativo/i })).not.toBeInTheDocument();
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
    await waitFor(() => expect(useBackups).toHaveBeenCalledWith({ page: 1, perPage: 1, enabled: false }));
  });

  it('keeps the institutional fallback when branding data has no hospital name', async () => {
    vi.mocked(usePublicBranding).mockReturnValue({
      data: { hospital_name: '' },
    } as ReturnType<typeof usePublicBranding>);
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: null,
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden.',
        label: 'Todo bien',
        level: 'ok',
      },
    });

    render(<AboutView user={cashierUser} onStatus={vi.fn()} />);

    expect(screen.getByText('Hospital San Isidro')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tel[eÃ©]fono|correo|RTN|licencia/i);
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
    expect(screen.queryByText(/frontend disponible/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue:work|APP_KEY|DB_PASSWORD|\.env|C:\\\\/i);
    expect(useBackups).toHaveBeenCalledWith({ page: 1, perPage: 1, enabled: true });
    expect(useSystemStatusSnapshot).toHaveBeenCalledWith(true);
  });

  it('labels loopback diagnostics as single-machine local mode instead of missing LAN', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden.',
        label: 'Todo bien',
        level: 'ok',
      },
    });
    const baseStatus = mockSystemStatus();
    vi.mocked(useSystemStatusSnapshot).mockReturnValue({
      data: {
        ...baseStatus,
        environment: {
          ...baseStatus.environment,
          app_url: 'http://127.0.0.1:8000',
        },
        network: {
          configured_host: '127.0.0.1',
          host_type: 'loopback',
          lan_ready: false,
          client_url: 'http://127.0.0.1:8000',
          guidance: 'Modo monocomputadora: valide desde el navegador local del servidor.',
        },
      },
      isError: false,
      error: null,
      isPending: false,
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useSystemStatusSnapshot>);

    render(<AboutView user={adminUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /diagnostico administrativo/i })).toBeInTheDocument();
    expect(screen.getByText('Modo monocomputadora')).toBeInTheDocument();
    expect(screen.getByText('Direccion local configurada')).toBeInTheDocument();
    expect(screen.getByText(/Acceso local:/i)).toBeInTheDocument();
    expect(screen.getByText(/127\.0\.0\.1:8000/i)).toBeInTheDocument();
    expect(screen.queryByText('Falta direcciÃ³n LAN')).not.toBeInTheDocument();
    expect(screen.queryByText(/Acceso LAN:/i)).not.toBeInTheDocument();
  });

  it('marks the latest backup diagnostic for review when the file is not confirmed', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Hay trabajos o respaldos con alerta.',
        label: 'Requiere revision',
        level: 'review',
      },
    });
    vi.mocked(useSystemStatusSnapshot).mockReturnValue({
      data: {
        ...mockSystemStatus(),
        backups: {
          ...mockSystemStatus().backups,
          last_success_file_exists: false,
          last_success_checksum_matches: false,
        },
      },
      isError: false,
      error: null,
      isPending: false,
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useSystemStatusSnapshot>);

    render(<AboutView user={adminUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /diagnostico administrativo/i })).toBeInTheDocument();
    expect(screen.getByText('Respaldo no confirmado')).toBeInTheDocument();
    expect(screen.getByText('Revisar')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hospital-backup|checksum|sha/i);
  });

  it('keeps the local diagnostic action callback without changing hooks', async () => {
    vi.useFakeTimers();
    const onStatus = vi.fn();
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden.',
        label: 'Todo bien',
        level: 'ok',
      },
    });

    render(<AboutView user={cashierUser} onStatus={onStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /revisar conexion local/i }));

    expect(onStatus).toHaveBeenCalledWith('Revisando conexion local...');
    vi.advanceTimersByTime(1000);
    expect(onStatus).toHaveBeenCalledWith('Todo bien: Servidor local, base de datos y respaldos responden.');
    vi.useRealTimers();
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
