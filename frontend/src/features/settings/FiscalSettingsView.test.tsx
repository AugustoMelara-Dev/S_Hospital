import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, type FiscalSettings } from '@/lib/api';
import { FiscalSettingsView } from './FiscalSettingsView';

describe('FiscalSettingsView', () => {
  it('exposes scanner and partial payment options as labeled controls', async () => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettingsFixture());
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);

    render(<FiscalSettingsView canEdit initialTab="hospital" onStatus={vi.fn()} />);

    await waitFor(() => expect(apiClient.getFiscalSettings).toHaveBeenCalled());

    expect(screen.getByLabelText(/habilitar scanner\/codigos en caja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/permitir abonos parciales/i)).toBeInTheDocument();
  });

  it('uses institutional color theme names without commercial language', async () => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettingsFixture());
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);

    render(<FiscalSettingsView canEdit initialTab="branding" onStatus={vi.fn()} />);

    await waitFor(() => expect(apiClient.getFiscalSettings).toHaveBeenCalled());

    expect(screen.getByText('Vino institucional')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp('prem' + 'ium', 'i'))).not.toBeInTheDocument();
  });
});

function fiscalSettingsFixture(overrides: Partial<FiscalSettings> = {}): FiscalSettings {
  return {
    id: 1,
    hospital_name: 'Hospital San Isidro',
    rtn: '08011999123456',
    default_tax_rate: '15.00',
    receipt_paper_size: 'half_letter',
    primary_color: 'teal',
    address: 'Tocoa, Colon',
    slogan: 'Servicio institucional',
    scanner_enabled: true,
    partial_payments_enabled: true,
    receipt_template_mode: 'institutional',
    government_line: 'Gobierno de Honduras',
    secretariat_line: 'Secretaria de Salud Publica',
    receipt_location: 'Tocoa, Colon',
    receipt_footer_text: 'Gracias por su visita',
    ...overrides,
  };
}
