import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { FiscalSettingsView } from './FiscalSettingsView';
import { apiClient, type FiscalSequence, type FiscalSettings } from '../../lib/api';

describe('FiscalSettingsView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(mockFiscalSettings());
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([mockFiscalSequence()]);
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);

    const { container } = render(
      <FiscalSettingsView canEdit onStatus={vi.fn()} />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Hospital San Isidro');
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

function mockFiscalSettings(): FiscalSettings {
  return {
    id: 1,
    hospital_name: 'Hospital San Isidro',
    rtn: '08011999123456',
    default_tax_rate: '15.00',
    receipt_paper_size: 'half_letter',
    primary_color: 'teal',
    address: 'Barrio Centro',
    slogan: 'Al servicio de tu salud',
    scanner_enabled: false,
    partial_payments_enabled: false,
    receipt_template_mode: 'institutional',
    government_line: 'Gobierno de Honduras',
    secretariat_line: 'Secretaria de Salud Publica',
    receipt_location: 'Tocoa, Colon',
    receipt_footer_text: '',
  };
}

function mockFiscalSequence(): FiscalSequence {
  return {
    id: 1,
    document_type: 'invoice',
    prefix: '000-001-01',
    min_number: 1,
    max_number: 99999999,
    current_number: 0,
    cai: 'TEST-CAI-VALID',
    valid_until: '2027-12-31',
    active: true,
  };
}
