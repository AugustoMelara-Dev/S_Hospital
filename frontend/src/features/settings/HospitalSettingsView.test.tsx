import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HospitalSettingsView } from './HospitalSettingsView';
import { apiClient, type FiscalSettings } from '@/lib/api';

const baseSettings: FiscalSettings = {
  id: 1,
  hospital_name: 'Hospital San Isidro',
  rtn: '08011999000001',
  default_tax_rate: '15.00',
  primary_color: 'teal',
  address: 'Tocoa, Colon',
  slogan: 'Servicio publico',
  scanner_enabled: false,
  partial_payments_enabled: false,
  receipt_template_mode: 'institutional',
  receipt_paper_size: 'half_letter',
  government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaria de Salud Publica',
  receipt_location: 'Tocoa, Colon',
  receipt_footer_text: '',
};

describe('HospitalSettingsView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(baseSettings);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(baseSettings);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders hospital form with seeded values', async () => {
    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/nombre del hospital/i)).toHaveValue('Hospital San Isidro');
    expect(screen.getByLabelText(/^rtn$/i)).toHaveValue('08011999000001');
    expect(screen.getByLabelText(/direcci[oó]n/i)).toHaveValue('Tocoa, Colon');
    expect(screen.getByLabelText(/lema/i)).toHaveValue('Servicio publico');
  });

  it('submits trimmed optional fields as null', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);
    vi.mocked(apiClient.getFiscalSettings).mockResolvedValue({
      ...baseSettings,
      government_line: null,
      secretariat_line: null,
      receipt_location: null,
      receipt_footer_text: null,
    });

    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/dependencia superior/i)).toHaveValue('');
    expect(screen.getByLabelText(/^secretar/i)).toHaveValue('');
    expect(screen.getByLabelText(/lugar del recibo/i)).toHaveValue('');

    fireEvent.click(await screen.findByRole('button', { name: /guardar datos del hospital/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalled();
    });

    const payload = updateFiscalSettings.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.government_line).toBeNull();
    expect(payload.secretariat_line).toBeNull();
    expect(payload.receipt_location).toBeNull();
  });

  it('disables inputs without edit permission', async () => {
    render(<HospitalSettingsView canEdit={false} onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/nombre del hospital/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar datos del hospital/i })).toBeDisabled();
  });
});