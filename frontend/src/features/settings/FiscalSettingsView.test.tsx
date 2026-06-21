import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalSettingsView } from './FiscalSettingsView';
import { apiClient, type FiscalSequence, type FiscalSettings } from '@/lib/api';

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

describe('FiscalSettingsView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([fiscalSequence]);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('keeps brand color controls read-only when the operator cannot edit fiscal settings', async () => {
    const updateFiscalSettings = vi.spyOn(apiClient, 'updateFiscalSettings');

    render(<FiscalSettingsView canEdit={false} onStatus={vi.fn()} />);

    const appearanceTab = await screen.findByRole('tab', { name: /apariencia/i });
    fireEvent.pointerDown(appearanceTab, { button: 0, ctrlKey: false });
    fireEvent.keyDown(appearanceTab, { key: 'Enter', code: 'Enter' });

    const blueTheme = await screen.findByRole('button', { name: /azul m[eé]dico/i });
    expect(blueTheme).toBeDisabled();

    fireEvent.click(blueTheme);

    await waitFor(() => {
      expect(updateFiscalSettings).not.toHaveBeenCalled();
    });
  });
});
