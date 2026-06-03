import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { DashboardView } from './DashboardView';
import { apiClient, type DashboardReport, type SystemStatus } from '../../lib/api';

function withQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe('DashboardView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue(mockDashboard());
    vi.spyOn(apiClient, 'request').mockResolvedValue(mockSetupStatus());
    const { container } = withQueryClient(
      <DashboardView
        canCreateInvoices
        canViewBackups
        canViewCash
        canViewCatalog
        canViewFiscalSettings
        canViewInvoices
        canViewManagerialReports
        canViewReports
        cashSession={null}
        onQuickCash={vi.fn()}
        onQuickInvoice={vi.fn()}
        onStatus={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('h1, [role="heading"]')).not.toBeNull();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

function mockDashboard(): DashboardReport {
  return {
    current_month: {
      total_billed: '275.50',
      total_collected: '125.25',
      invoice_count: 3,
      payment_count: 2,
    },
    last_7_days: [
      {
        date: '2026-05-30',
        total_billed: '275.50',
        total_collected: '125.25',
        invoice_count: 3,
        payment_count: 2,
      },
    ],
    payments_by_method: {
      cash: '125.25',
      transfer: '0.00',
      card: '0.00',
      other: '0.00',
    },
    top_services: [],
    cashiers_summary: [],
  };
}

function mockSetupStatus(): SystemStatus {
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
      last_success_at: null,
      last_success_filename: null,
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
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-06-02T13:00:00.000000Z' },
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
