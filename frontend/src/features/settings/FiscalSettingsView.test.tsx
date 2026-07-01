import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalSettingsView } from './FiscalSettingsView';
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
  partial_payments_enabled: false,
  receipt_template_mode: 'institutional',
  receipt_paper_size: 'half_letter',
  government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaria de Salud Publica',
  receipt_location: 'Tocoa, Colon',
  receipt_footer_text: '',
};

function renderView(props: { canEdit?: boolean; onStatus?: (message: string) => void } = {}) {
  return render(
    <MemoryRouter>
      <FiscalSettingsView
        canEdit={props.canEdit ?? true}
        onStatus={props.onStatus ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('FiscalSettingsView (separated sections)', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'saveFiscalSequence').mockResolvedValue({
      id: 1,
      document_type: 'invoice',
      prefix: 'A',
      min_number: 1,
      max_number: 1000,
      current_number: 10,
      cai: 'CAI-TEST',
      valid_until: '2026-12-31',
      active: true,
    });
    vi.spyOn(apiClient, 'uploadLogo').mockResolvedValue('/api/settings/logo/file?t=123');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('renders a single accessible h1 and the sectioned configuration tabs', async () => {
    renderView();

    expect(
      await screen.findByRole('heading', { level: 1, name: /^configuraci[oó]n$/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    expect(screen.getByRole('tab', { name: /hospital/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /numeraci[oó]n/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /operativa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^marca$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^recibos$/i })).toBeInTheDocument();
  });

  it('renders a sanitized load error when the API fails', async () => {
    vi.mocked(apiClient.getFiscalSettings)
      .mockRejectedValueOnce(new Error('SQLSTATE[HY000] DB_PASSWORD=secret C:\\hospital\\.env'))
      .mockResolvedValueOnce(fiscalSettings);

    renderView();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo cargar la configuraci[oó]n/i);
    expect(alert).not.toHaveTextContent(/sqlstate|db_password|secret|\.env/i);
  });

  it('does not render institutional receipt PDF or print-test configuration in the fiscal screen', async () => {
    renderView();

    await screen.findByRole('heading', { level: 1, name: /^configuraci[oó]n$/i });

    expect(
      screen.queryByText(/prueba de impresi[oó]n|pdf de prueba|perfil de impresi[oó]n|serie de recibo/i),
    ).not.toBeInTheDocument();
  });
});