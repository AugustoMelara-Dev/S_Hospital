import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '@/auth/guards';
import { makeMe, mockApi, reply } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import RespaldosPage from './RespaldosPage';

const done = {
  id: 1,
  filename: 'shs-20261116.sql.gz.enc',
  size_bytes: 2_621_440,
  sha256: 'a'.repeat(64),
  status: 'success',
  kind: 'scheduled',
  error: null,
  created_by: null,
  created_at: '2026-11-16T02:00:00-06:00',
  completed_at: '2026-11-16T02:00:05-06:00',
};

describe('RespaldosPage', () => {
  it('creating a backup POSTs and polls until it is no longer pending', async () => {
    const user = userEvent.setup();
    let created = false;
    let listCallsAfterCreate = 0;
    const api = mockApi({
      'GET /auth/me': makeMe(),
      'GET /system/status': {
        version: '2.0.0',
        database: { ok: true, engine: 'MariaDB', version: '11.4' },
        migration: { current: 'x', head: 'x', up_to_date: true },
        disk: { free_bytes: 10 * 1024 ** 3, total_bytes: 100 * 1024 ** 3 },
        last_backup: done,
      },
      'GET /backups': () => {
        if (!created) return { items: [done], page: 1, per_page: 25, total: 1 };
        listCallsAfterCreate += 1;
        const status = listCallsAfterCreate >= 2 ? 'success' : 'pending';
        return { items: [{ ...done, id: 2, kind: 'manual', status, sha256: status === 'success' ? 'b'.repeat(64) : null, created_at: '2026-11-17T10:00:00-06:00' }, done], page: 1, per_page: 25, total: 2 };
      },
      'POST /backups': () => {
        created = true;
        return reply(202, { ...done, id: 2, kind: 'manual', status: 'pending', sha256: null, created_at: '2026-11-17T10:00:00-06:00' });
      },
    });
    renderWithProviders(
      <RequireAuth>
        <RespaldosPage />
      </RequireAuth>,
    );
    expect(await screen.findByText('MariaDB 11.4')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Crear respaldo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear respaldo' });
    await user.click(within(dialog).getByRole('button', { name: 'Crear respaldo' }));

    await waitFor(() => expect(api.calls('POST /backups')).toHaveLength(1));
    expect(await screen.findByText('En proceso')).toBeInTheDocument();
    // Polling refetches the list until the backup is no longer pending.
    await waitFor(() => expect(screen.queryByText('En proceso')).not.toBeInTheDocument(), { timeout: 8000 });
    expect(listCallsAfterCreate).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('bbbbbbbbbbbb…')).toBeInTheDocument();
  }, 15000);

  it('hides create and download without permission', async () => {
    mockApi({
      'GET /auth/me': makeMe({ role: { code: 'auditor', name: 'Auditoría' }, permissions: ['backups.view'] }),
      'GET /backups': { items: [done], page: 1, per_page: 25, total: 1 },
    });
    renderWithProviders(
      <RequireAuth>
        <RespaldosPage />
      </RequireAuth>,
    );
    expect(await screen.findByText('Automático')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear respaldo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar respaldo/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Estado del sistema')).not.toBeInTheDocument();
  });
});
