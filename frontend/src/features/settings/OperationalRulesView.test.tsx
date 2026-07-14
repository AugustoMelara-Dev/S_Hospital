import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationalRulesView } from './OperationalRulesView';
import { apiClient, type FiscalSettings, type OperationalSettings } from '@/lib/api';

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
  government_line: null,
  secretariat_line: null,
  receipt_location: null,
  receipt_footer_text: null,
};

const operationalSettings: OperationalSettings = {
  default_tax_rate: '15.00',
  scanner_enabled: false,
  partial_payments_enabled: false,
};

describe('OperationalRulesView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(baseSettings);
    vi.spyOn(apiClient, 'getOperationalSettings').mockResolvedValue(operationalSettings);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(baseSettings);
    vi.spyOn(apiClient, 'updateOperationalSettings').mockResolvedValue({
      scanner_enabled: true,
      partial_payments_enabled: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads operational rules without requesting full fiscal settings', async () => {
    render(<OperationalRulesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/scanner/i)).toBeInTheDocument();
    expect(apiClient.getOperationalSettings).toHaveBeenCalled();
    expect(apiClient.getFiscalSettings).not.toHaveBeenCalled();
  });

  it('renders scanner and partial payments checkboxes', async () => {
    render(<OperationalRulesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/scanner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/abonos parciales/i)).toBeInTheDocument();
  });

  it('submits the toggled flags', async () => {
    const updateOperationalSettings = vi.mocked(apiClient.updateOperationalSettings);
    const onStatus = vi.fn();

    render(<OperationalRulesView canEdit onStatus={onStatus} />);

    const scanner = await screen.findByLabelText(/scanner/i);
    fireEvent.click(scanner);

    fireEvent.click(screen.getByRole('button', { name: /guardar reglas operativas/i }));

    expect(updateOperationalSettings).toHaveBeenCalledWith({
      scanner_enabled: true,
      partial_payments_enabled: false,
    });
    expect(apiClient.updateFiscalSettings).not.toHaveBeenCalled();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Reglas operativas guardadas.'));
  });

  it('disables inputs without edit permission', async () => {
    render(<OperationalRulesView canEdit={false} onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/scanner/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar reglas operativas/i })).toBeDisabled();
  });
});
