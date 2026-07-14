import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Grid } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalSettingsView } from './FiscalSettingsView';
import { apiClient, type FiscalSequence, type FiscalSettings } from '@/lib/api';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

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

const fiscalSequence: FiscalSequence = {
  id: 1,
  document_type: 'invoice',
  prefix: 'A',
  min_number: 1,
  max_number: 1000,
  current_number: 10,
  cai: 'CAI-TEST',
  valid_until: '2026-12-31',
  active: true,
};

function renderView(
  props: {
    canEdit?: boolean;
    canEditOperationalRules?: boolean;
    canViewFiscalSettings?: boolean;
    onStatus?: OperationalStatusReporter;
  } = {},
) {
  return render(
    <MemoryRouter>
      <FiscalSettingsView
        canEdit={props.canEdit ?? true}
        canEditOperationalRules={props.canEditOperationalRules ?? props.canEdit ?? true}
        canViewFiscalSettings={props.canViewFiscalSettings ?? true}
        onStatus={props.onStatus ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('FiscalSettingsView (separated sections)', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue({
      default_tax_rate: '15.00',
      scanner_enabled: false,
      partial_payments_enabled: false,
    });
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'updateOperationalSettings').mockResolvedValue({
      scanner_enabled: true,
      partial_payments_enabled: false,
    });
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

  it('renders a single accessible h1 and keeps receipts as a dedicated route, not a fiscal tab', async () => {
    renderView();

    expect(
      await screen.findByRole('heading', { level: 1, name: /^configuraci[oó]n$/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    expect(screen.getByRole('tab', { name: /hospital/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /numeraci[oó]n/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /operativa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^marca$/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^recibos$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /administrar recibos/i })).toHaveAttribute(
      'href',
      '/settings/institutional-receipts',
    );
  });

  it('keeps configuration tabs above the content on narrow screens', async () => {
    vi.spyOn(Grid, 'useBreakpoint').mockReturnValue({ md: false });

    renderView();

    await screen.findByRole('heading', { level: 1 });
    const tabList = screen.getByRole('tablist');
    expect(tabList.closest('.ant-tabs')).toHaveClass('ant-tabs-top');
    expect(tabList).toHaveAttribute('aria-orientation', 'horizontal');
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

  it('uses the active fiscal sequence in the summary', async () => {
    vi.mocked(apiClient.getFiscalSequences).mockResolvedValueOnce([fiscalSequence]);

    renderView();

    expect(await screen.findByText('CAI-TEST')).toBeInTheDocument();
    expect(screen.getByText('A-00000001 a A-00001000')).toBeInTheDocument();
    expect(screen.getByText('A-00000011')).toBeInTheDocument();
    expect(screen.queryByText(/CAI y prefijo fiscal/i)).not.toBeInTheDocument();
  });

  it('allows editing only operational rules with the operational settings permission', async () => {
    renderView({ canEdit: false, canEditOperationalRules: true });

    await screen.findByRole('heading', { level: 1, name: /^configuraci.n$/i });
    const operationalTab = screen.getByRole('tab', { name: /operativa/i });
    fireEvent.mouseDown(operationalTab);
    fireEvent.click(operationalTab);

    expect(await screen.findByLabelText(/scanner/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar reglas operativas/i })).not.toBeDisabled();
    expect(screen.getByText(/edici.n operativa/i)).toBeInTheDocument();
  });

  it('does not request fiscal settings when the user only edits operational rules', async () => {
    renderView({ canEdit: false, canEditOperationalRules: true, canViewFiscalSettings: false });

    expect(await screen.findByRole('heading', { level: 1, name: /^configuraci.n$/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/scanner/i)).not.toBeDisabled();
    expect(apiClient.getOperationalSettings).toHaveBeenCalledTimes(1);
    expect(apiClient.getFiscalSettings).not.toHaveBeenCalled();
    expect(apiClient.getFiscalSequences).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: /hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /numeraci.n/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^marca$/i })).not.toBeInTheDocument();
  });
});
