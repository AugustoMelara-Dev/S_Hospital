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

    fireEvent.change(screen.getByLabelText(/direcci/i), {
      target: { value: '  Tocoa, Colón  ' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /guardar datos del hospital/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalled();
    });

    const payload = updateFiscalSettings.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.government_line).toBeNull();
    expect(payload.secretariat_line).toBeNull();
    expect(payload.receipt_location).toBeNull();
    expect(payload.default_tax_rate).toBeUndefined();
    expect(payload.primary_color).toBeUndefined();
    expect(payload.receipt_template_mode).toBeUndefined();
    expect(payload.scanner_enabled).toBeUndefined();
    expect(payload.partial_payments_enabled).toBeUndefined();
  });

  it('trims institutional identity fields before saving', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/nombre del hospital/i), {
      target: { value: '  Hospital Regional del Norte  ' },
    });
    fireEvent.change(screen.getByLabelText(/^rtn$/i), {
      target: { value: '  08011999123456  ' },
    });
    fireEvent.change(screen.getByLabelText(/motivo del cambio fiscal/i), {
      target: { value: 'Correccion documentada de RTN' },
    });

    fireEvent.click(screen.getByRole('button', { name: /guardar datos del hospital/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y guardar/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalled();
    });

    const payload = updateFiscalSettings.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.hospital_name).toBe('Hospital Regional del Norte');
    expect(payload.rtn).toBe('08011999123456');
  });

  it('asks for a fiscal reason when the RTN changes', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    const rtnInput = await screen.findByLabelText(/^rtn$/i);
    fireEvent.change(rtnInput, { target: { value: '08011999111111' } });

    const reasonInput = screen.getByLabelText(/motivo del cambio fiscal/i);
    fireEvent.change(reasonInput, { target: { value: 'Correccion documentada de RTN' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar datos del hospital/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y guardar/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalled();
    });

    const payload = updateFiscalSettings.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.rtn).toBe('08011999111111');
    expect(payload.reason).toBe('Correccion documentada de RTN');
  });

  it('reviews the RTN consequence before preserving the exact hospital payload', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/^rtn$/i), {
      target: { value: '08011999111111' },
    });
    fireEvent.change(screen.getByLabelText(/motivo del cambio fiscal/i), {
      target: { value: 'Correccion documentada de RTN' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar datos del hospital/i }));

    const dialog = await screen.findByRole('alertdialog', { name: /revisar cambio de rtn/i });
    expect(dialog).toHaveTextContent('08011999000001');
    expect(dialog).toHaveTextContent('08011999111111');
    expect(dialog).toHaveTextContent(/recibos y documentos institucionales/i);
    expect(updateFiscalSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirmar y guardar/i }));

    await waitFor(() => expect(updateFiscalSettings).toHaveBeenCalledWith({
      hospital_name: 'Hospital San Isidro',
      rtn: '08011999111111',
      address: 'Tocoa, Colon',
      phone: null,
      slogan: 'Servicio publico',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaria de Salud Publica',
      receipt_location: 'Tocoa, Colon',
      receipt_footer_text: null,
      reason: 'Correccion documentada de RTN',
    }));
  });
  it('disables inputs without edit permission', async () => {
    render(<HospitalSettingsView canEdit={false} onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/nombre del hospital/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /guardar datos del hospital/i })).not.toBeInTheDocument();
  });

  it('shows the sticky save action only after the long form changes', async () => {
    render(<HospitalSettingsView canEdit onStatus={vi.fn()} />);

    const name = await screen.findByLabelText(/nombre del hospital/i);
    expect(screen.queryByRole('button', { name: /guardar datos del hospital/i })).not.toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Hospital General San Isidro' } });
    const save = screen.getByRole('button', { name: /guardar datos del hospital/i });
    expect(save.closest('[data-sticky-actions="true"]')).toHaveClass('sticky', 'bottom-20', 'lg:bottom-0');
  });
});
