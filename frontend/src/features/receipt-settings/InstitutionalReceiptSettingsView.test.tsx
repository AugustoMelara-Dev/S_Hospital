import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionalReceiptSettingsView } from './InstitutionalReceiptSettingsView';
import type { InstitutionalReceiptSettings, ReceiptPrintProfile } from '@/lib/api';

const mockData = vi.hoisted(() => {
  const profiles = [
    ['recibo_pequeno_personalizado', 'Recibo pequeno personalizado', 'custom_mm', '180.00', '95.00', false, false],
    ['media_carta_horizontal', 'Media carta horizontal', 'half_letter_landscape', '215.90', '139.70', true, true],
    ['a5_horizontal', 'A5 horizontal', 'a5_landscape', '210.00', '148.00', true, false],
    ['carta_horizontal', 'Carta horizontal', 'letter_landscape', '279.40', '215.90', true, false],
  ].map(([code, name, paperKind, width, height, active, isGlobalDefault], index) => ({
    id: index + 1,
    code,
    name,
    paper_kind: paperKind,
    width_mm: width,
    height_mm: height,
    margin_top_mm: '6.00',
    margin_right_mm: '6.00',
    margin_bottom_mm: '6.00',
    margin_left_mm: '6.00',
    orientation: 'landscape',
    template_code: 'institutional_classic',
    font_family: 'Arial, sans-serif',
    font_scale: '1.00',
    copies_mode: 'original_only',
    show_copy_legend: true,
    show_physical_seal_space: true,
    use_logo: false,
    show_technical_fields: false,
    active,
    is_global_default: isGlobalDefault,
  })) as ReceiptPrintProfile[];

  const settings: InstitutionalReceiptSettings = {
    institution: {
      hospital_name: 'Hospital San Isidro',
      rtn: '',
      default_tax_rate: '15.00',
      receipt_paper_size: 'half_letter',
      primary_color: 'indigo',
      address: 'Tocoa, Colon',
      slogan: '',
      receipt_template_mode: 'institutional',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaria de Salud',
      receipt_location: 'Tocoa, Colon',
      receipt_footer_text: 'Original: Oficina Recaudadora',
    },
    active_series: {
      id: 1,
      document_type: 'institutional_receipt',
      series: 'REC-A',
      prefix: 'RA',
      number_format: '{series}-{number:08}',
      min_number: 1,
      max_number: 100,
      current_number: 4,
      range_authorization: 'AUT-REC',
      legal_text: 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
      receipt_number_color: '#b91c1c',
      active: true,
      reprint_behavior: 'audit_only',
      void_behavior: 'permission_reason_audit',
    },
    series: [],
    print_profiles: profiles,
    assignments: [],
    resolved_profile: profiles[1],
  };

  return { profiles, settings };
});

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      getInstitutionalReceiptSettings: vi.fn().mockResolvedValue(mockData.settings),
      updateReceiptInstitution: vi.fn().mockResolvedValue(mockData.settings.institution),
      storeReceiptSeries: vi.fn(),
      updateReceiptSeries: vi.fn().mockResolvedValue(mockData.settings.active_series),
      updateReceiptPrintProfile: vi.fn().mockResolvedValue(mockData.profiles[1]),
      upsertReceiptProfileAssignment: vi.fn(),
      testPrintInstitutionalReceipt: vi.fn().mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' })),
    },
  };
});

vi.mock('@/lib/download', () => ({
  downloadBlob: vi.fn(),
}));

function renderView({ canAdvancedPrintSettings = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstitutionalReceiptSettingsView
        canEdit
        canAdvancedPrintSettings={canAdvancedPrintSettings}
        onStatus={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

async function activateTab(name: string | RegExp) {
  const tab = await screen.findByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

describe('InstitutionalReceiptSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the page header and stat cards for the resolved profile', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    expect(screen.getAllByText('Media carta').length).toBeGreaterThan(0);
    expect(screen.getByText('REC-A')).toBeInTheDocument();
    expect(screen.getByText('Editable')).toBeInTheDocument();
  });

  it('preloads saved institutional address before editing receipt data', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab(/instituci/i);

    expect(screen.getByLabelText(/direcci/i)).toHaveValue('Tocoa, Colon');
  });

  it('trims receipt institution identity fields before saving', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab(/instituci/i);

    fireEvent.change(screen.getByLabelText(/nombre del hospital/i), {
      target: { value: '  Hospital Regional del Norte  ' },
    });
    fireEvent.change(screen.getByLabelText(/rtn si aplica/i), {
      target: { value: '  08011999123456  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar instituci/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptInstitution).toHaveBeenCalledWith(
        expect.objectContaining({
          hospital_name: 'Hospital Regional del Norte',
          rtn: '08011999123456',
        }),
      );
    });
  });

  it('never exposes the manual paper fields in the normal flow', async () => {
    renderView();
    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();

    [
      'Ancho mm',
      'Alto mm',
      'Fuente',
      'Escala',
      'Margen sup. (mm)',
      'Margen der. (mm)',
      'Margen inf. (mm)',
      'Margen izq. (mm)',
    ].forEach((label) => {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    });
  });

  it('keeps support permissions out of the normal print settings flow', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText('receipt_settings.advanced')).not.toBeInTheDocument();
  });

  it('keeps technical support profiles out of the normal paper flow', async () => {
    renderView({ canAdvancedPrintSettings: false });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByRole('button', { name: /recibo peque/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ajustes avanzados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/soporte t/i)).not.toBeInTheDocument();
  });

  it('keeps thermal ticket compatibility out of the normal institutional paper choices', async () => {
    renderView({ canAdvancedPrintSettings: false });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.getByRole('radio', { name: /^Carta\b/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Media carta\b/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^A5\b/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 80/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 58/i })).not.toBeInTheDocument();
  });

  it('uses operational paper copy without print implementation terms', async () => {
    renderView({ canAdvancedPrintSettings: false });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText(/css/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fuente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/layout/i)).not.toBeInTheDocument();
  });

  it('does not expose profile activation controls in the normal print flow', async () => {
    renderView({ canAdvancedPrintSettings: false });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByRole('checkbox', { name: /perfil activo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /predeterminado global/i })).not.toBeInTheDocument();
  });

  it('keeps support-only warnings hidden while a standard paper profile is selected', async () => {
    renderView({ canAdvancedPrintSettings: true });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText(/modo soporte no aplica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ajustes avanzados solo aplican/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/modo soporte t/i)).not.toBeInTheDocument();
  });

  it('explains sensitive receipt numbering before saving a series', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    expect(await screen.findByText(/correlativo sensible/i)).toBeInTheDocument();
    expect(screen.getByText(/solo con autorización documentada/i)).toBeInTheDocument();
    expect(screen.getByText(/próximo recibo usará este valor \+ 1/i)).toBeInTheDocument();
  });

  it('blocks saving a receipt series when the range end is below the start', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    fireEvent.change(screen.getByLabelText(/n.mero inicial/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/n.mero final/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el n.mero final debe ser mayor o igual al inicial/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('blocks saving a receipt series when the current number exceeds the range end', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    fireEvent.change(screen.getByLabelText(/n.mero final/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/correlativo actual/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el correlativo actual no puede superar el numero final/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('blocks saving an active receipt series when the next number leaves the authorized range', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    fireEvent.change(screen.getByLabelText(/n.mero final/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/correlativo actual/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el siguiente recibo debe quedar dentro del rango autorizado/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('sends a documented support reason with advanced manual print settings', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView({ canAdvancedPrintSettings: true });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');
    fireEvent.click(screen.getByRole('button', { name: /recibo peque/i }));
    fireEvent.click(screen.getByText(/modo soporte t/i));

    const reason = await screen.findByLabelText(/motivo de soporte/i);
    fireEvent.change(reason, { target: { value: '  Ajuste por prueba de impresora  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar ajustes avanzados/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptPrintProfile).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          support_reason: 'Ajuste por prueba de impresora',
        }),
      );
    });
  });

  it('labels the collapsed advanced panel as an explicit support activation', async () => {
    renderView({ canAdvancedPrintSettings: true });

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');
    fireEvent.click(screen.getByRole('button', { name: /recibo peque/i }));

    expect(screen.getByText(/activar modo soporte t/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Ancho mm')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margen sup. (mm)')).not.toBeInTheDocument();
  });

  it('generates a test print without leaving the settings screen', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');
    fireEvent.click(await screen.findByRole('button', { name: /Imprimir prueba/ }));

    await waitFor(() => {
      expect(apiClient.testPrintInstitutionalReceipt).toHaveBeenCalledWith(expect.objectContaining({
        profile_code: 'media_carta_horizontal',
      }));
    });
  });

});
