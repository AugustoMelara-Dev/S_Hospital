import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { system } from '@/lib/api';
import type { AuditLogPage } from '@/lib/api/types';
import { AuditView } from './AuditView';

vi.mock('@/lib/api', async (load) => ({ ...await load<typeof import('@/lib/api')>(), system: { getAuditLogs: vi.fn() } }));
const page: AuditLogPage = { data: [{ id: 7, action: 'invoice.voided', reason: 'Duplicado confirmado', result: 'success', user: { id: 2, name: 'Ana López', username: 'ana' }, created_at: '2026-10-22T12:00:00Z' }], meta: { current_page: 1, per_page: 25, total: 26 } };
function renderAudit() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuditView /></QueryClientProvider>);
}
beforeEach(() => { vi.mocked(system.getAuditLogs).mockReset().mockResolvedValue(page); });
describe('AuditView', () => {
  it('muestra acción humana, responsable, resultado y motivo sin acciones de edición', async () => {
    renderAudit();
    expect(await screen.findByText('Duplicado confirmado')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Anulación de operación' })).toBeInTheDocument();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Duplicado confirmado')).toBeInTheDocument();
    expect(screen.getByText('Correcto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar|editar/i })).not.toBeInTheDocument();
  });
  it('aplica búsqueda de usuario y fechas al servidor y conserva filtros al paginar', async () => {
    const user = userEvent.setup(); renderAudit();
    await screen.findByText('Duplicado confirmado');
    await user.type(screen.getByLabelText('Nombre o usuario'), 'Ana');
    await user.selectOptions(screen.getByLabelText('Acción'), 'invoice.voided');
    await user.type(screen.getByLabelText('Desde'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(system.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ user: 'Ana', action: 'invoice.voided', from: '2026-10-01', page: 1 })));
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(system.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ user: 'Ana', action: 'invoice.voided', page: 2 })));
  });
  it('presenta vacío sin prometer que no existe actividad fuera de los filtros', async () => {
    vi.mocked(system.getAuditLogs).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 25, total: 0 } });
    renderAudit();
    expect(await screen.findByText('Sin eventos para estos filtros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
  it('explica el fallo y permite reintentar', async () => {
    vi.mocked(system.getAuditLogs).mockRejectedValueOnce(new Error('Fallo interno privado'));
    renderAudit();
    expect(await screen.findByText('No se pudo cargar la auditoría')).toBeInTheDocument();
    expect(screen.queryByText('Fallo interno privado')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Duplicado confirmado')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Anulación de operación' })).toBeInTheDocument();
  });
});
