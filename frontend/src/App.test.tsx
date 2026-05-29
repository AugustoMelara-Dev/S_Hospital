/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { apiClient } from './lib/api';
import { queryClient } from './lib/query-client';
import { resetRequestChain } from './lib/api/base';

describe('App', () => {
  function mockSystemStatus() {
    return {
      data: {
        environment: {
          app_env: 'local',
          app_debug: true,
          app_url: 'http://127.0.0.1:8000',
          queue_connection: 'database',
          filesystem_disk: 'local',
          php_version: '8.3.0',
          server_time: '2026-05-19T19:00:00.000000Z',
          timezone: 'America/Tegucigalpa',
        },
        database: {
          connection: 'mysql',
          driver: 'mysql',
          is_mysql_family: true,
        },
        backups: {
          pending_count: 0,
          last_success_at: null,
          last_success_filename: null,
          last_failure_at: null,
          last_failure_message: null,
          dump_binary: {
            configured: false,
            available: true,
            name: 'mysqldump.exe',
          },
          storage: {
            writable: true,
            free_bytes: 1048576,
          },
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
          laravel_log: {
            exists: true,
            size_bytes: 2048,
            modified_at: '2026-05-19T18:55:00.000000Z',
          },
          backup_automation_log: {
            exists: true,
            size_bytes: 1024,
            modified_at: '2026-05-19T18:50:00.000000Z',
          },
          latest_migration: '2026_05_17_000018_create_backup_logs_table',
          migration_count: 18,
        },
        readiness: {
          state: 'PRODUCTION_CANDIDATE',
          production_ready: false,
          blockers: [
            {
              code: 'PENDING_LAN_CLIENT_VALIDATION',
              label: 'Validacion desde segunda PC LAN',
              status: 'pending',
            },
          ],
        },
        preflight: {
          production_checks: [
            {
              code: 'APP_ENV_PRODUCTION',
              label: 'APP_ENV=production',
              status: 'pending',
              detail: 'Actual: local',
            },
            {
              code: 'DUMP_BINARY_AVAILABLE',
              label: 'mysqldump/mariadb-dump disponible',
              status: 'validated',
              detail: 'mysqldump.exe',
            },
            {
              code: 'BACKUP_WORKER_CONTINUOUS',
              label: 'Worker de backups como tarea/servicio',
              status: 'manual_required',
              detail: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
            },
          ],
          public_routes: [
            {
              path: '/up',
              expected: 'HTTP 200',
              status: 'manual_required',
            },
            {
              path: '/login',
              expected: 'SPA cargada desde host LAN',
              status: 'manual_required',
            },
            {
              path: '/verify-email',
              expected: 'SPA o ruta esperada cargada desde host LAN',
              status: 'manual_required',
            },
          ],
          physical_proofs: [
            {
              code: 'LAN_CLIENT_VALIDATION_PROOF',
              label: 'Segunda PC en LAN',
              required_file: 'qa/LAN_CLIENT_VALIDATION_PROOF.md',
              status: 'pending',
              detail: 'Archivo de evidencia no existe todavia.',
            },
            {
              code: 'THERMAL_PRINTER_PROOF',
              label: 'Impresora institucional media carta/carta/A5',
              required_file: 'qa/THERMAL_PRINTER_PROOF.md',
              status: 'pending',
              detail: 'Archivo de evidencia no existe todavia.',
            },
            {
              code: 'FINAL_RESTORE_PROOF',
              label: 'Restore MySQL/MariaDB final',
              required_file: 'qa/FINAL_RESTORE_PROOF.md',
              status: 'pending',
              detail: 'Archivo de evidencia no existe todavia.',
            },
            {
              code: 'FINAL_CONCURRENCY_PROOF',
              label: 'Concurrencia transaccional final',
              required_file: 'qa/FINAL_CONCURRENCY_PROOF.md',
              status: 'pending',
              detail: 'Archivo de evidencia no existe todavia.',
            },
          ],
          commands: {
            preflight: 'powershell.exe -ExecutionPolicy Bypass -File scripts\\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR',
            backup_worker: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
            scheduler: 'php artisan schedule:run',
          },
        },
      },
    };
  }

  function activateTab(name: RegExp) {
    const tab = screen.getByRole('tab', { name });
    tab.focus();
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' });
    fireEvent.click(tab);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRequestChain();
    queryClient.clear();
    window.history.pushState({}, '', '/');
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    document.body.removeAttribute('data-printing-receipt');
    document.body.removeAttribute('data-receipt-width');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('renders the login screen when there is no session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Unauthenticated.' }),
    } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /caja hospitalaria rápida y clara/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario o correo/i)).toBeInTheDocument();
  });

  it('recovers an authenticated session after a hard refresh on login', async () => {
    window.history.pushState({}, '', '/login');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['settings.fiscal.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      if (url.includes('/api/settings/fiscal')) {
        return {
          ok: true,
          json: async () => ({ data: {} }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: null }),
      } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
    expect(screen.queryByRole('heading', { name: /S_Sistema de Caja Hospitalaria/i })).not.toBeInTheDocument();
  });

  it('renders app shell and fiscal settings route for an authenticated admin', async () => {
    window.history.pushState({}, '', '/settings/fiscal');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      if (url.includes('/api/settings/fiscal')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              hospital_name: 'Hospital Demo',
              rtn: '08011999123456',
              default_tax_rate: '15.00',
              receipt_width: '80mm',
            },
          }),
        } as Response;
      }
      if (url.includes('/api/fiscal-sequences')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                document_type: 'invoice',
                prefix: '000-001-01',
                min_number: 1,
                max_number: 99999999,
                current_number: 0,
                cai: 'DEMO-CAI',
                valid_until: '2027-05-17',
                active: true,
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    const navigation = await screen.findByRole('navigation', { name: /navegaci[oó]n principal/i });

    expect(navigation).toBeInTheDocument();
    expect(navigation.closest('aside')).toHaveClass('print-hidden');
    expect(screen.getByRole('banner')).toHaveClass('print-hidden');
    expect(screen.getByRole('contentinfo')).toHaveClass('print-hidden');
    expect(screen.getAllByRole('link', { name: /^configuraci[oó]n$/i })[0]).toHaveAttribute(
      'href',
      '/settings/fiscal',
    );
    expect(await screen.findByRole('heading', { name: /^configuracion$/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /configuracion pendiente/i })).toBeInTheDocument();
    expect(screen.getByText(/datos demo o temporales/i)).toBeInTheDocument();
    activateTab(/^hospital$/i);
    expect(await screen.findByRole('heading', { name: /hospital y recibo/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Hospital Demo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar hospital y recibo/i })).toBeEnabled();
    activateTab(/numeracion/i);
    expect(screen.queryByDisplayValue('DEMO-CAI')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar numeracion/i })).toBeEnabled();
  });

  it('renders catalog as read only for a cashier', async () => {
    window.history.pushState({}, '', '/catalog');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
              active: true,
              roles: ['cajero'],
              permissions: ['catalog.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                name: 'Laboratorio',
                slug: 'laboratorio',
                active: true,
                sort_order: 0,
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/services')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                category_id: 1,
                name: 'Glucosa',
                slug: 'glucosa',
                price: '15.00',
                scan_code: 'LAB-GLU-001',
                barcode: null,
                qr_code: null,
                taxable: true,
                active: true,
                special_rule_code: null,
                category: {
                  id: 1,
                  name: 'Laboratorio',
                  slug: 'laboratorio',
                  active: true,
                  sort_order: 0,
                },
              },
            ],
            meta: { current_page: 1, per_page: 15, total: 1 },
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /cat[aá]l[oó]go de servicios/i })).toBeInTheDocument();
    expect(await screen.findByText('Glucosa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar servicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nueva categoria/i })).not.toBeInTheDocument();
  });

  it('renders backups view actions for an admin', async () => {
    window.history.pushState({}, '', '/backups');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['backups.view', 'backups.create', 'backups.download'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/system/status')) {
        return {
          ok: true,
          json: async () => mockSystemStatus(),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: [],
          meta: { current_page: 1, per_page: 15, total: 0 },
        }),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^respaldos$/i })).toBeInTheDocument();
    expect(await screen.findByText(/respaldos del hospital/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/respaldos autom[aá]ticos/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/checklist operativo/i)).toBeInTheDocument();
    expect(screen.getByText(/modo de operaci[oó]n final/i)).toBeInTheDocument();
    expect(screen.getByText(/pantalla de ingreso abre/i)).toBeInTheDocument();
    expect(screen.getByText(/segunda pc en lan/i)).toBeInTheDocument();
    expect(screen.getByText(/impresora institucional/i)).toBeInTheDocument();
    expect(screen.queryByText(/production_candidate/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /crear respaldo/i }).some((button) => !button.hasAttribute('disabled'))).toBe(true);
  });

  it('does not render backups for a user without backup permission', async () => {
    window.history.pushState({}, '', '/cashbox');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 2,
              name: 'Cajero Demo',
              email: 'cajero.demo@hospital-billing.local',
              username: 'cajero.demo',
              active: true,
              roles: ['cajero'],
              permissions: ['cash.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^caja$/i })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /respaldos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear respaldo/i })).not.toBeInTheDocument();
  });

  it('creates a manual backup from the admin backups view', async () => {
    window.history.pushState({}, '', '/backups');
    const backupList: unknown[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['backups.view', 'backups.create', 'backups.download'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/system/status')) {
        return {
          ok: true,
          json: async () => mockSystemStatus(),
        } as Response;
      }

      if (url.includes('/api/backups')) {
        if (method === 'POST') {
          const newBackup = {
            id: 9,
            filename: 'hospital-backup-20260517-101500-test.sql',
            size_bytes: 2048,
            checksum_sha256: 'a'.repeat(64),
            status: 'pending',
            type: 'manual',
            created_by: 1,
            completed_at: null,
            created_at: '2026-05-17T10:15:00-06:00',
            updated_at: '2026-05-17T10:15:00-06:00',
            creator: { id: 1, name: 'Admin Demo', username: 'admin.demo' },
          };
          backupList.push(newBackup);
          return {
            ok: true,
            json: async () => ({
              data: newBackup,
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            data: backupList,
            meta: { current_page: 1, per_page: 15, total: backupList.length },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    render(<App />);

    const createBackupButton = await screen.findByRole('button', { name: /crear respaldo/i });
    await waitFor(() => expect(createBackupButton).toBeEnabled());
    fireEvent.click(createBackupButton);
    fireEvent.click(await screen.findByRole('button', { name: /^crear respaldo$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/backups'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect((await screen.findAllByText('hospital-backup-20260517-101500-test.sql')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /descargar respaldo hospital-backup/i })).not.toBeInTheDocument();
  });

  it('renders successful backups with accessible download and pagination controls', async () => {
    window.history.pushState({}, '', '/backups');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['backups.view', 'backups.download'],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/system/status')) {
        return {
          ok: true,
          json: async () => mockSystemStatus(),
        } as Response;
      }

      if (url.includes('/api/backups')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 10,
                filename: 'hospital-backup-20260517-101500-test.sql',
                size_bytes: 2048,
                checksum_sha256: 'b'.repeat(64),
                status: 'success',
                type: 'manual',
                created_by: 1,
                completed_at: '2026-05-17T10:15:00-06:00',
                created_at: '2026-05-17T10:15:00-06:00',
                updated_at: '2026-05-17T10:15:00-06:00',
                creator: { id: 1, name: 'Admin Demo', username: 'admin.demo' },
              },
            ],
            meta: { current_page: 1, per_page: 15, total: 16 },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    render(<App />);

    expect(await screen.findByText('hospital-backup-20260517-101500-test.sql')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /descargar respaldo hospital-backup-20260517-101500-test\.sql/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear respaldo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/p[aá]gina 1 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled();
  });

  it('lets a user with required password change submit a new password', async () => {
    let mustChange = true;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
              must_change_password: mustChange,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/auth/change-password')) {
        mustChange = false;
        return {
          ok: true,
          status: 204,
          json: async () => ({}),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /cambio obligatorio de contrase[nñ]a/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/contrase[nñ]a actual/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(/^nueva contrase[nñ]a$/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrase[nñ]a/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contrase[nñ]a/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/auth/change-password'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('renders not found for an unknown authenticated route', async () => {
    window.history.pushState({}, '', '/ruta-inexistente');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: ['reports.view'],
              must_change_password: false,
            },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect(await screen.findByText(/ruta no encontrada/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^reportes$/i })).not.toBeInTheDocument();
  });

  it('renders only the active module instead of all modules at once', async () => {
    window.history.pushState({}, '', '/reports');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              name: 'Admin Demo',
              email: 'admin.demo@hospital-billing.local',
              username: 'admin.demo',
              active: true,
              roles: ['admin'],
              permissions: [
                'cash.view',
                'catalog.view',
                'invoices.create',
                'invoices.view',
                'reports.view',
                'reports.managerial.view',
                'reports.export',
                'reports.cash_session.view',
                'backups.view',
                'settings.fiscal.view',
              ],
              must_change_password: false,
            },
          }),
        } as Response;
      }

      if (url.includes('/api/reports/daily')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              date: '2026-05-17',
              total_billed: '0.00',
              total_collected: '0.00',
              invoice_count: 0,
              payment_count: 0,
              payments_by_method: {
                cash: '0.00',
                transfer: '0.00',
                card: '0.00',
                other: '0.00',
              },
              invoices_by_status: {
                issued: { count: 0, total: '0.00' },
                partial: { count: 0, total: '0.00' },
                paid: { count: 0, total: '0.00' },
                void: { count: 0, total: '0.00' },
              },
            },
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<App />);

    expect((await screen.findAllByRole('heading', { name: /^reportes$/i })).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^configuraci[oó]n$/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /nueva factura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /datos fiscales del hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /respaldos/i })).not.toBeInTheDocument();
  });
});
