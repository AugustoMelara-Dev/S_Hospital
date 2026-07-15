import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandingView } from './BrandingView';
import { apiClient, type FiscalSettings } from '@/lib/api';

const fiscalSettings: FiscalSettings = {
  id: 1,
  hospital_name: 'Hospital General San Isidro',
  rtn: '08011999000001',
  default_tax_rate: '15.00',
  primary_color: 'teal',
  address: 'Tocoa, Colón, Honduras',
  slogan: 'Servicio publico',
  scanner_enabled: true,
  partial_payments_enabled: true,
  receipt_template_mode: 'institutional',
  government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaria de Salud Publica',
  receipt_location: 'Tocoa, Colón, Honduras',
  receipt_footer_text: '',
};

describe('BrandingView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue({
      ...fiscalSettings,
      primary_color: 'blue',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows a replaceable provisional wordmark while no official logo is loaded', async () => {
    render(<BrandingView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByText('Hospital General San Isidro')).toBeVisible();
    expect(screen.getByText('Tocoa, Colón, Honduras')).toBeVisible();
    expect(screen.getByText('Identidad provisional')).toBeVisible();
    expect(screen.getByText(/wordmark tipográfico provisional/i)).toBeVisible();
  });

  it('uses the same stable identity box for an uploaded logo', async () => {
    vi.mocked(apiClient.getLogo).mockResolvedValueOnce('/api/settings/logo/file?t=123');

    render(<BrandingView canEdit onStatus={vi.fn()} />);

    const logo = await screen.findByRole('img', { name: /hospital general san isidro/i });
    expect(logo.parentElement).toHaveClass('institutional-logo-box');
    expect(screen.queryByText('Identidad provisional')).not.toBeInTheDocument();
  });

  it('updates brand color without sending fiscal or operational settings', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);
    const onStatus = vi.fn();

    render(<BrandingView canEdit onStatus={onStatus} />);

    fireEvent.click(await screen.findByRole('button', { name: /azul/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalled();
    });

    const payload = updateFiscalSettings.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.primary_color).toBe('blue');
    expect(payload.rtn).toBeUndefined();
    expect(payload.default_tax_rate).toBeUndefined();
    expect(payload.scanner_enabled).toBeUndefined();
    expect(payload.partial_payments_enabled).toBeUndefined();
    expect(onStatus).toHaveBeenCalledWith({
      key: 'settings:branding:color',
      level: 'info',
      message: 'Guardando color de marca...',
      toast: false,
    });
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'settings:branding:color',
      level: 'success',
    }));
  });

  it('reports brand color failures as errors with a stable key', async () => {
    vi.mocked(apiClient.updateFiscalSettings).mockRejectedValueOnce(new Error('Fallo controlado'));
    const onStatus = vi.fn();

    render(<BrandingView canEdit onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: /azul/i }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'settings:branding:color',
      level: 'error',
    })));
  });
});
