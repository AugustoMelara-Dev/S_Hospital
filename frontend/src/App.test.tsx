import { render, screen } from '@testing-library/react';
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
      } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /configuracion fiscal/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Hospital Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar configuracion/i })).toBeEnabled();
  });
});
