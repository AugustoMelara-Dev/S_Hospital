import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the login screen when there is no session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Unauthenticated.' }),
    } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /acceso local/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario o email/i)).toBeInTheDocument();
  });

  it('renders fiscal settings for an authenticated admin', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            hospital_name: 'Hospital Demo',
            rtn: '08011999123456',
            default_tax_rate: '15.00',
            receipt_width: '80mm',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /datos fiscales del hospital/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Hospital Demo')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('DEMO-CAI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar configuracion/i })).toBeEnabled();
  });

  it('renders catalog as read only for a cashier', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 10,
              category_id: 1,
              name: 'Eritropoyetina',
              slug: 'eritropoyetina',
              price: '25.00',
              taxable: true,
              active: true,
              special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
              category: {
                id: 1,
                name: 'Laboratorio',
                slug: 'laboratorio',
                active: true,
                sort_order: 0,
              },
            },
          ],
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /categorias y servicios/i })).toBeInTheDocument();
    expect(await screen.findByText('Eritropoyetina')).toBeInTheDocument();
    expect(screen.getByText(/cajero puede consultar catalogo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar servicio/i })).not.toBeInTheDocument();
  });

  it('renders a minimal new invoice view without payment actions', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 2,
            name: 'Cajero Demo',
            email: 'cajero.demo@hospital-billing.local',
            username: 'cajero.demo',
            active: true,
            roles: ['cajero'],
            permissions: ['invoices.create', 'invoices.view'],
            must_change_password: false,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 10,
              category_id: 1,
              name: 'Eritropoyetina',
              slug: 'eritropoyetina',
              price: '25.00',
              taxable: true,
              active: true,
              special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
              category: {
                id: 1,
                name: 'Medicamentos',
                slug: 'medicamentos',
                active: true,
                sort_order: 4,
              },
            },
          ],
        }),
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del paciente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar servicios activos/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /eritropoyetina/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cobrar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/metodo de pago/i)).not.toBeInTheDocument();
  });

  it('lets a user with required password change submit a new password', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
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
            must_change_password: true,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /cambio obligatorio de contrasena/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/contrasena actual/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(/^nueva contrasena$/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrasena/i), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contrasena/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/auth/change-password'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
