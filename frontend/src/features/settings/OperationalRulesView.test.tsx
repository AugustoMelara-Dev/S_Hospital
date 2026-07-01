import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationalRulesView } from './OperationalRulesView';
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
  government_line: null,
  secretariat_line: null,
  receipt_location: null,
  receipt_footer_text: null,
};

describe('OperationalRulesView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(baseSettings);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(baseSettings);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders scanner and partial payments checkboxes', async () => {
    render(<OperationalRulesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/scanner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/abonos parciales/i)).toBeInTheDocument();
  });

  it('submits the toggled flags', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<OperationalRulesView canEdit onStatus={vi.fn()} />);

    const scanner = await screen.findByLabelText(/scanner/i);
    fireEvent.click(scanner);

    fireEvent.click(screen.getByRole('button', { name: /guardar reglas operativas/i }));

    expect(updateFiscalSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        scanner_enabled: true,
      }),
    );
  });

  it('disables inputs without edit permission', async () => {
    render(<OperationalRulesView canEdit={false} onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/scanner/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar reglas operativas/i })).toBeDisabled();
  });
});