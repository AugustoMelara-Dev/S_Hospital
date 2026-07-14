import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 12,
  name: 'Administradora Hospital',
  email: 'admin@hospital.local',
  username: 'admin.hospital',
  active: true,
  roles: ['admin'],
  permissions: ['backups.view', 'backups.create', 'backups.download', 'system.status.view'],
  must_change_password: false,
};

const completedBackup = {
  id: 41,
  size_bytes: 3_145_728,
  status: 'success',
  type: 'manual',
  created_by: 12,
  completed_at: '2026-07-02T14:05:00.000Z',
  created_at: '2026-07-02T14:00:00.000Z',
  updated_at: '2026-07-02T14:05:00.000Z',
  error_message: null,
  creator: { id: 12, name: 'Administradora Hospital', username: 'admin.hospital' },
};

test('backups screen (admin) via direct mock', async ({ page, context }, testInfo) => {
  await context.clearCookies();
  await installBackupsMocks(page);

  await page.goto('/backups');

  await expect(page.getByRole('heading', { name: /respaldos/i })).toBeVisible();
  await expect(page.getByRole('cell', { name: /administradora hospital/i })).toBeVisible();
  await expect(page.getByText(/hospital-2026-06-08-2300\.sql\.gz/i)).toHaveCount(0);
  await expect(page.getByText(/sha256|checksum|storage\/|\.env|sqlstate/i)).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath('backups-light.png'), fullPage: true });
});

async function installBackupsMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: adminUser }));
  await page.route('**/api/settings/branding', (route) => json(route, {
    data: {
      hospital_name: 'Hospital San Isidro',
      primary_color: 'indigo',
      slogan: 'Sistema LAN',
      government_line: null,
      secretariat_line: null,
      receipt_location: 'Tocoa',
    },
  }));
  await page.route('**/api/settings/logo', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: {
      enabled: false,
      broadcaster: 'log',
      key: null,
      ws_host: null,
      ws_port: null,
      force_tls: false,
    },
  }));
  await page.route('**/api/system/status-summary', (route) => json(route, {
    data: {
      app: { env: 'local', debug: false },
      database: { connected: true },
      queue: { failed_jobs_count: 0 },
      backups: { last_success_at: completedBackup.completed_at },
    },
  }));
  await page.route('**/api/system/status', (route) => json(route, { data: systemStatusFixture() }));
  await page.route(/\/api\/backups(?:\?.*)?$/, (route) => json(route, {
    data: [completedBackup],
    meta: {
      current_page: 1,
      from: 1,
      last_page: 1,
      path: '/api/backups',
      per_page: 15,
      to: 1,
      total: 1,
    },
  }));
}

function systemStatusFixture() {
  return {
    environment: {
      app_env: 'production',
      app_debug: false,
      app_url: 'http://192.168.1.10',
      queue_connection: 'database',
      filesystem_disk: 'local',
      app_version: '1.0.0',
      php_version: '8.3.0',
      server_time: '2026-07-02T14:12:00.000Z',
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
      configured_host: '192.168.1.10',
      host_type: 'lan',
      lan_ready: true,
      client_url: 'http://192.168.1.10',
      guidance: 'Clientes entran por IP local.',
    },
    backups: {
      pending_count: 0,
      worker_recently_active: true,
      stale_pending_count: 0,
      stale_pending_threshold_minutes: 15,
      last_success_at: completedBackup.completed_at,
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
      laravel_log: { exists: true, size_bytes: 1024, modified_at: '2026-07-02T14:11:00.000Z' },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: '2026-07-02T14:11:00.000Z' },
      frontend_build: { available: true, modified_at: '2026-07-02T14:11:00.000Z' },
      installed_version: '1.0.0',
      latest_migration: '2026_07_01_000001_ready',
      migration_count: 55,
      pending_migration_count: 0,
      pending_migrations: [],
    },
    readiness: {
      state: 'PRODUCTION_CANDIDATE',
      production_ready: true,
      blockers: [],
    },
    preflight: {
      production_checks: [],
      public_routes: [],
      physical_proofs: [],
      commands: {
        preflight: 'scripts/production_readiness_preflight.ps1',
        backup_worker: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
        scheduler: 'php artisan schedule:run',
      },
    },
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
