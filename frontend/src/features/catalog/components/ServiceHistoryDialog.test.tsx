import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, type Service } from '@/lib/api';
import { ServiceHistoryDialog } from './ServiceHistoryDialog';

function renderHistory(service: Service = serviceFixture()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <ServiceHistoryDialog open service={service} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ServiceHistoryDialog', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows useful audited changes, actor and reason without internal fields', async () => {
    vi.spyOn(apiClient, 'getServiceHistory').mockResolvedValue({
      data: [{
        id: 8,
        action: 'service.price_updated',
        label: 'Precio actualizado',
        reason: 'Nueva tarifa autorizada',
        created_at: '2026-09-28T10:30:00-06:00',
        user: { id: 2, name: 'Administración', username: 'admin' },
        changes: [{ field: 'price', label: 'Precio', before: '25.00', after: '30.00' }],
      }],
      meta: { current_page: 1, per_page: 20, total: 1 },
    });

    renderHistory();

    expect(await screen.findByText('Precio actualizado')).toBeInTheDocument();
    expect(screen.getByText('Administración')).toBeInTheDocument();
    expect(screen.getByText(/nueva tarifa autorizada/i)).toBeInTheDocument();
    expect(screen.getByText('L. 25.00')).toBeInTheDocument();
    expect(screen.getByText('L. 30.00')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/category_id|internal_code|source_key/i);
  });

  it('distinguishes loading, empty and error states and allows retry', async () => {
    let rejectHistory: (reason?: unknown) => void = () => undefined;
    const history = vi.spyOn(apiClient, 'getServiceHistory').mockImplementation(() => new Promise((_resolve, reject) => {
      rejectHistory = reject;
    }));

    renderHistory();
    expect(await screen.findByRole('status')).toHaveTextContent(/cargando historial/i);

    rejectHistory(new Error('SQLSTATE private detail'));
    expect(await screen.findByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE/i);

    history.mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, per_page: 20, total: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText(/todavía no hay cambios registrados/i)).toBeInTheDocument();
  });

  it('allows consulting older history pages', async () => {
    const history = vi.spyOn(apiClient, 'getServiceHistory')
      .mockResolvedValueOnce({
        data: [{ id: 1, action: 'service.updated', label: 'Datos actualizados', reason: null, created_at: null, user: null, changes: [] }],
        meta: { current_page: 1, per_page: 20, total: 21 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 2, action: 'service.created', label: 'Concepto creado', reason: null, created_at: null, user: null, changes: [] }],
        meta: { current_page: 2, per_page: 20, total: 21 },
      });

    renderHistory();
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(await screen.findByText('Concepto creado')).toBeInTheDocument();
    expect(history).toHaveBeenLastCalledWith(1, 2);
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });
});

function serviceFixture(): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Eritropoyetina',
    aliases: null,
    slug: 'eritropoyetina',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '25.00',
    taxable: false,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
  };
}
