import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutView } from './AboutView';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { useServerStatus } from '../../hooks/useServerStatus';
import { apiClient } from '../../lib/api';
import type { OperationalHealth, SystemStatus } from '../../lib/api';

vi.mock('../../hooks/useFiscalSettings', () => ({
  useFiscalSettings: vi.fn(),
}));

vi.mock('../../hooks/useServerStatus', () => ({
  useServerStatus: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: {
    getBackups: vi.fn(),
    getSystemStatus: vi.fn(),
  },
  userSafeErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

describe('AboutView', () => {
  const cashierUser = {
    id: 2,
    name: 'Cajero Validación',
    email: 'cajero.validación@hospital-san-isidro.local',
    username: 'cajero.validación',
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
    permissions: ['backups.view', 'system.status.view'],
  };
  const supportUser = {
    ...cashierUser,
    id: 3,
    name: 'Soporte Hospital',
    username: 'soporte.hospital',
    roles: ['soporte'],
    permissions: ['system.status.view'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFiscalSettings).mockReturnValue({
      data: { hospital_name: 'Hospital San Isidro' },
    } as ReturnType<typeof useFiscalSettings>);
    vi.mocked(apiClient.getBackups).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });
    vi.mocked(apiClient.getSystemStatus).mockResolvedValue(mockSystemStatus());
  });

  it('shows the operational health summary in non-technical language', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Protegido',
        level: 'ok',
      },
    });

    render(<AboutView user={cashierUser} onStatus={vi.fn()} />);

    expect(screen.getAllByText('Protegido').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/base de datos y respaldos responden/i)).toBeInTheDocument();
    await waitFor(() => expect(apiClient.getBackups).toHaveBeenCalled());
    expect(apiClient.getSystemStatus).not.toHaveBeenCalled();
  });

  it('shows a review summary without exposing raw technical details', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Hay respaldos en espera o con alerta. Revise Respaldos y pida soporte si el problema se repite.',
        label: 'Pendiente',
        level: 'review',
      },
    });

    render(<AboutView user={cashierUser} onStatus={vi.fn()} />);

    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/pida soporte/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Todo bien|Requiere revisi[oó]n|queue:work|App\\\\|DB_PASSWORD|\.env|C:\\\\/i);
    await waitFor(() => expect(apiClient.getBackups).toHaveBeenCalled());
  });

  it('shows protected administrative diagnostics with human-safe labels for admin users', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Protegido',
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
    expect(screen.getAllByText('Base actualizada').length).toBeGreaterThan(0);
    expect(screen.getByText(/192\.168\.1\.10:8000/i)).toBeInTheDocument();
    expect(screen.getByText(/America\/Tegucigalpa/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.0\.0-rc\.3/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue:work|APP_KEY|DB_PASSWORD|\.env|C:\\\\/i);
    expect(apiClient.getSystemStatus).toHaveBeenCalledOnce();
  });

  it('shows an admin operational pulse without raw commands or paths', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Protegido',
        level: 'ok',
      },
    });

    render(<AboutView user={adminUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /pulso operativo administrativo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /lectura para soporte/i })).toBeInTheDocument();
    expect(screen.getByText('Sin respaldos pendientes')).toBeInTheDocument();
    expect(screen.getByText('Sin respaldos con error')).toBeInTheDocument();
    expect(screen.getByText('Activo hace 2 min')).toBeInTheDocument();
    expect(screen.getByText('2.0 GB libres')).toBeInTheDocument();
    expect(screen.getAllByText('Base actualizada').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/queue:work|schedule:run|trabajo\(s\)|cola|APP_KEY|DB_PASSWORD|\.env|C:\\\\/i);
  });

  it('shows extended admin health metrics from the public health snapshot safely', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: mockOperationalHealth(),
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Protegido',
        level: 'ok',
      },
    });

    render(<AboutView user={adminUser} onStatus={vi.fn()} />);

    expect(await screen.findByText('Carga de respaldos')).toBeInTheDocument();
    expect(screen.getByText('Retardo DB')).toBeInTheDocument();
    expect(screen.getByText('Respuesta DB')).toBeInTheDocument();
    expect(screen.getByText('Conexiones DB')).toBeInTheDocument();
    expect(screen.getByText('Actividad')).toBeInTheDocument();
    expect(screen.getByText('Sin respaldos acumulados')).toBeInTheDocument();
    expect(screen.getByText('Base local sin replica')).toBeInTheDocument();
    expect(screen.getByText('P50 6.0 ms / P95 12.0 ms / P99 18.0 ms')).toBeInTheDocument();
    expect(screen.getByText('3 conexiones activas / pico 8')).toBeInTheDocument();
    expect(screen.getByText('Activo hace 2 h')).toBeInTheDocument();
    expect(screen.getByText('9.5 GB libres')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/storage_path|queue:work|SHOW STATUS|APP_KEY|DB_PASSWORD|\.env|C:\\\\/i);
  });

  it('allows support users with system status permission to see advanced diagnostics', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Protegido',
        level: 'ok',
      },
    });

    render(<AboutView user={supportUser} onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /diagnostico administrativo/i })).toBeInTheDocument();
    expect(screen.getByText('Servidor activo')).toBeInTheDocument();
    expect(apiClient.getSystemStatus).toHaveBeenCalledOnce();
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
        scheduler_heartbeat: {
          status: 'ok',
          last_tick_at: '2026-06-02T13:58:00.000Z',
          last_result: 'ok',
          last_message: '',
          age_seconds: 120,
          ticks_in_db: 1200,
          ticks_last_24h: 1200,
          expected: 'ticks_last_24h >= 1400',
        },
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

function mockOperationalHealth(): OperationalHealth {
  return {
    generated_at: '2026-06-02T14:00:00.000Z',
    database: {
      connected: true,
      driver: 'mysql',
    },
    database_lag: {
      status: 'standalone',
      seconds: null,
    },
    database_perf: {
      latency_ms: {
        status: 'ok',
        current_ms: 5.5,
        p50_ms: 6,
        p95_ms: 12,
        p99_ms: 18,
        sample_count: 12,
      },
      connections: {
        status: 'ok',
        active: 3,
        max_used: 8,
      },
    },
    queue: {
      connection: 'database',
      pending: 0,
      failed: 0,
    },
    queue_size: {
      backups: 0,
      failed_last_hour: 0,
    },
    backups: {
      worker_recently_active: true,
      pending: 0,
      success_last_24h: 1,
      failed_last_24h: 0,
    },
    storage: {
      backup_files: 2,
      backup_bytes: 2048,
    },
    disk_free_gb: {
      free_gb: 9.5,
      total_gb: 32,
      used_pct: 70.3,
    },
    app_uptime_s: {
      seconds: 7_200,
      started_at: '2026-06-02T12:00:00.000Z',
    },
    recent_errors: [],
  };
}
