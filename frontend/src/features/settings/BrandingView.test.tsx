import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandingView } from './BrandingView';
import { apiClient, type FiscalSettings } from '@/lib/api';

const fiscalSettings: FiscalSettings = {
  id: 1,
  hospital_name: 'Hospital San Isidro',
  rtn: '08011999000001',
  default_tax_rate: '15.00',
  primary_color: 'teal',
  address: 'Tocoa, Colon',
  slogan: 'Servicio publico',
  scanner_enabled: true,
  partial_payments_enabled: true,
  receipt_template_mode: 'institutional',
  government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaria de Salud Publica',
  receipt_location: 'Tocoa, Colon',
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

  it('updates brand color without sending fiscal or operational settings', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<BrandingView canEdit onStatus={vi.fn()} />);

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
  });
});
