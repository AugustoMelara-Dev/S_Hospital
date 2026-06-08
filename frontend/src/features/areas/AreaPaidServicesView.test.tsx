import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { apiClient, type AuthUser } from '../../lib/api';
import { resetRequestChain } from '../../lib/api/base';
import { queryClient } from '../../lib/query-client';
import { AreaPaidServicesView } from './AreaPaidServicesView';

describe('AreaPaidServicesView', () => {
  const areaUser: AuthUser = {
    id: 9,
    name: 'Tecnico Laboratorio',
    email: 'laboratorio@hospital-san-isidro.local',
    username: 'laboratorio',
    active: true,
    area_id: 1,
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    roles: ['area'],
    permissions: ['areas.paid_services.view'],
    must_change_password: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRequestChain();
    queryClient.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('loads paid services for the assigned area without exposing internal identifiers', async () => {
    const load = vi.spyOn(apiClient, 'getAreaPaidServicesReport').mockResolvedValue({
      area: 'Laboratorio',
      date_from: '2026-06-08',
      date_to: '2026-06-08',
      services: [
        {
          invoice_number: 'A-00000042',
          patient_name: 'Maria Lopez',
          issued_at: '2026-06-08T08:10:00Z',
          paid_at: '2026-06-08T08:15:00Z',
          service_name: 'Hemograma completo',
          category_name: 'Laboratorio',
          area_name: 'Laboratorio',
          quantity: '1.00',
          amount: '120.00',
          payment_methods: ['cash'],
        },
      ],
      meta: { page: 1, per_page: 15, total: 1 },
    });
    const onStatus = vi.fn();

    render(<AreaPaidServicesView user={areaUser} onStatus={onStatus} />);

    expect(await screen.findByRole('heading', { name: /servicios encontrados/i })).toBeInTheDocument();
    expect(screen.getByText('A-00000042')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByText('Hemograma completo')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('L. 120.00')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/invoice_id|service_id|area_id/i);
    expect(load).toHaveBeenCalledWith(1, expect.objectContaining({ page: 1, per_page: 15 }));
  });

  it('shows a clear empty state when the area user has no assigned area', () => {
    render(<AreaPaidServicesView user={{ ...areaUser, area_id: null, area: null }} onStatus={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /area no asignada/i })).toBeInTheDocument();
    expect(screen.getByText(/pida al administrador/i)).toBeInTheDocument();
  });

  it('blocks date ranges longer than thirty one days before calling the backend', async () => {
    const load = vi.spyOn(apiClient, 'getAreaPaidServicesReport').mockResolvedValue({
      area: 'Laboratorio',
      date_from: '2026-06-08',
      date_to: '2026-06-08',
      services: [],
      meta: { page: 1, per_page: 15, total: 0 },
    });
    const onStatus = vi.fn();

    render(<AreaPaidServicesView user={areaUser} onStatus={onStatus} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-02-15' } });

    expect(screen.getByText(/rango maximo permitido es de 31 dias/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('routes an area-only user directly to paid services without managerial reports navigation', async () => {
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          json: async () => ({ data: areaUser }),
        } as Response;
      }

      if (url.includes('/api/fiscal-settings/public-branding')) {
        return {
          ok: true,
          json: async () => ({ data: { hospital_name: 'Hospital San Isidro' } }),
        } as Response;
      }

      if (url.includes('/api/areas/1/paid-services')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              area: 'Laboratorio',
              date_from: '2026-06-08',
              date_to: '2026-06-08',
              services: [],
              meta: { page: 1, per_page: 15, total: 0 },
            },
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^servicios pagados$/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegacion principal/i })).toHaveTextContent(/servicios pagados/i);
    expect(screen.getByRole('navigation', { name: /navegacion principal/i })).not.toHaveTextContent(/reportes/i);
    expect(window.location.pathname).toBe('/area/services');
  });
});
