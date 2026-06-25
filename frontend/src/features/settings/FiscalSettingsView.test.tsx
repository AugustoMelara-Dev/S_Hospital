import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(fiscalSettings);
    vi.spyOn(apiClient, 'saveFiscalSequence').mockResolvedValue(fiscalSequence);
    vi.spyOn(apiClient, 'uploadLogo').mockResolvedValue('/api/settings/logo/file?t=123');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('renders one accessible h1, successful fiscal data and real sequence rows', async () => {
    vi.mocked(apiClient.getFiscalSequences).mockResolvedValue([
      fiscalSequence,
      {
        ...fiscalSequence,
        id: 2,
        prefix: '000-002-01',
        current_number: 0,
        cai: 'CAI-SECOND',
        active: false,
      },
    ]);

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: /^configuraci[oó]n$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('08011999000001')).toBeInTheDocument();
    expect(screen.getByText('CAI-TEST')).toBeInTheDocument();

    await activateTab(/numeraci[oó]n/i);

    expect(await screen.findByRole('region', { name: /secuencias fiscales registradas/i })).toBeInTheDocument();
    expect(screen.getByText('000-002-01')).toBeInTheDocument();
    expect(screen.getByText(/inactiva/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar|regenerar|reiniciar/i })).not.toBeInTheDocument();
  });

  it('renders loading with status semantics', async () => {
    vi.mocked(apiClient.getFiscalSettings).mockReturnValue(new Promise<never>(() => undefined));

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/cargando configuraci[oó]n fiscal/i);
  });

  it('renders a sanitized load error and retries the existing fetches', async () => {
    const getFiscalSettings = vi.mocked(apiClient.getFiscalSettings);
    getFiscalSettings
      .mockRejectedValueOnce(new Error('SQLSTATE[HY000] DB_PASSWORD=secret C:\\hospital\\.env'))
      .mockResolvedValueOnce(fiscalSettings);

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo cargar la configuraci[oó]n fiscal/i);
    expect(alert).not.toHaveTextContent(/sqlstate|db_password|secret|\.env/i);

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await screen.findByText('08011999000001');
    expect(getFiscalSettings).toHaveBeenCalledTimes(2);
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

  it('submits the existing fiscal settings payload without adding receipt-settings endpoints', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await activateTab(/^hospital$/i);
    fireEvent.change(await screen.findByLabelText(/nombre del hospital/i), {
      target: { value: 'Hospital Regional' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar hospital y recibo/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalledWith({
        hospital_name: 'Hospital Regional',
        rtn: '08011999000001',
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
        receipt_footer_text: null,
        default_tax_rate: '15.00',
      });
    });
  });

  it('does not invent government, secretariat or receipt location when config is missing', async () => {
    const updateFiscalSettings = vi.mocked(apiClient.updateFiscalSettings);
    vi.mocked(apiClient.getFiscalSettings).mockResolvedValue({
      ...fiscalSettings,
      government_line: null,
      secretariat_line: null,
      receipt_location: null,
      receipt_footer_text: null,
    });

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await activateTab(/^hospital$/i);

    expect(await screen.findByLabelText(/encabezado de gobierno/i)).toHaveValue('');
    expect(screen.getByLabelText(/secretar/i)).toHaveValue('');
    expect(screen.getByLabelText(/lugar del recibo/i)).toHaveValue('');
    expect(screen.getByLabelText(/texto al pie/i)).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: /guardar hospital y recibo/i }));

    await waitFor(() => {
      expect(updateFiscalSettings).toHaveBeenCalledWith({
        hospital_name: 'Hospital San Isidro',
        rtn: '08011999000001',
        primary_color: 'teal',
        address: 'Tocoa, Colon',
        slogan: 'Servicio publico',
        scanner_enabled: true,
        partial_payments_enabled: false,
        receipt_template_mode: 'institutional',
        receipt_paper_size: 'half_letter',
        government_line: null,
        secretariat_line: null,
        receipt_location: null,
        receipt_footer_text: null,
        default_tax_rate: '15.00',
      });
    });
  });

  it('preserves sequence id, current number and payload through confirmation', async () => {
    const saveFiscalSequence = vi.mocked(apiClient.saveFiscalSequence);

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await activateTab(/numeraci[oó]n/i);
    fireEvent.change(await screen.findByLabelText(/^prefijo/i), {
      target: { value: '000-001-01' },
    });
    fireEvent.change(screen.getByLabelText(/^cai/i), {
      target: { value: 'CAI-AUTORIZADO-0001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar numeraci[oó]n/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar numeraci[oó]n/i }));

    await waitFor(() => {
      expect(saveFiscalSequence).toHaveBeenCalledWith({
        id: 1,
        document_type: 'invoice',
        prefix: '000-001-01',
        cai: 'CAI-AUTORIZADO-0001',
        min_number: 1,
        max_number: 1000,
        current_number: 10,
        valid_until: '2026-12-31',
        active: true,
      });
    });
  });

  it('prevents duplicate sequence submissions while the request is pending', async () => {
    let resolveSave!: (sequence: FiscalSequence) => void;
    const pendingSave = new Promise<FiscalSequence>((resolve) => {
      resolveSave = resolve;
    });
    const saveFiscalSequence = vi.mocked(apiClient.saveFiscalSequence).mockReturnValue(pendingSave);

    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await activateTab(/numeraci[oó]n/i);
    fireEvent.click(await screen.findByRole('button', { name: /guardar numeraci[oó]n/i }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /guardar numeraci[oó]n/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(saveFiscalSequence).toHaveBeenCalledTimes(1);

    resolveSave(fiscalSequence);
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('keeps logo upload manual, permission gated and using the existing FormData field', async () => {
    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await activateTab(/apariencia/i);
    const input = await screen.findByLabelText(/seleccionar logo/i);
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    expect(apiClient.uploadLogo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /actualizar logo/i }));

    await waitFor(() => {
      expect(apiClient.uploadLogo).toHaveBeenCalledWith(file);
    });
    expect(document.body.textContent).not.toMatch(/C:\\|storage\/|\.env/i);
  });

  it('does not expose logo upload controls without update permission', async () => {
    render(<FiscalSettingsView canEdit={false} onStatus={vi.fn()} />);

    await activateTab(/apariencia/i);

    expect(await screen.findByText(/la carga de logo requiere permiso/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/seleccionar logo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actualizar logo/i })).not.toBeInTheDocument();
  });

  it('does not render institutional receipt PDF or print-test configuration in the fiscal screen', async () => {
    render(<FiscalSettingsView canEdit onStatus={vi.fn()} />);

    await screen.findByRole('heading', { level: 1, name: /^configuraci[oó]n$/i });

    expect(screen.queryByText(/prueba de impresi[oó]n|pdf de prueba|perfil de impresi[oó]n|serie de recibo/i)).not.toBeInTheDocument();
  });
});

async function activateTab(name: RegExp) {
  const tab = await screen.findByRole('tab', { name });
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' });
}
