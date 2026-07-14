import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function renderView({ canEditAdvanced = false }: { canEditAdvanced?: boolean } = {}) {
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
        canEditAdvanced={canEditAdvanced}
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

  it('permite elegir papel sin controles técnicos', async () => {
    renderView();

    expect(await screen.findByRole('radio', { name: /Carta/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Media carta/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /A5/ })).toBeEnabled();
    expect(screen.queryByLabelText(/margen|escala|fuente|tamaño/i)).not.toBeInTheDocument();
  });

  it('separa compatibilidad térmica de formatos institucionales', async () => {
    renderView();

    const institutional = await screen.findByRole('group', { name: 'Formatos institucionales' });
    const compatibility = screen.getByRole('group', { name: 'Formatos térmicos secundarios' });

    expect(within(institutional).getAllByRole('radio')).toHaveLength(3);
    expect(within(compatibility).queryAllByRole('radio')).toHaveLength(0);
    expect(within(compatibility).getAllByRole('listitem')).toHaveLength(2);
  });

  it('actualiza la vista previa con el papel institucional elegido', async () => {
    renderView();

    expect(await screen.findByRole('region', { name: 'Vista previa de recibo Media carta' })).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /^Carta\b/i }));
    expect(screen.getByRole('region', { name: 'Vista previa de recibo Carta' })).toBeVisible();
  });

  it('shows the page header and stat cards for the resolved profile', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    expect(screen.getAllByText('Media carta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('REC-A').length).toBeGreaterThan(0);
    expect(screen.getByText('Editable')).toBeInTheDocument();
  });

  it('preloads saved institutional address before editing receipt data', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab(/instituci/i);

    await waitFor(() => expect(screen.getByLabelText(/direcci/i)).toHaveValue('Tocoa, Colon'));
  });

  it('trims receipt institution identity fields before saving', async () => {
    const { apiClient } = await import('@/lib/api');
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab(/instituci/i);

    const hospitalName = screen.getByLabelText(/nombre del hospital/i);
    await waitFor(() => expect(hospitalName).toHaveValue('Hospital San Isidro'));
    await user.clear(hospitalName);
    await user.type(hospitalName, '  Hospital Regional del Norte  ');
    const rtn = screen.getByLabelText(/rtn si aplica/i);
    await user.clear(rtn);
    await user.type(rtn, '  08011999123456  ');
    await user.click(screen.getByRole('button', { name: /guardar instituci/i }));

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

  it('protects technical paper controls behind the advanced receipt permission', async () => {
    renderView({ canEditAdvanced: true });

    await activateTab('Papel y copias');
    fireEvent.click(screen.getByText(/ajustes técnicos avanzados/i));

    expect(screen.getByLabelText('Ancho mm')).toBeVisible();
    expect(screen.getByLabelText('Alto mm')).toBeVisible();
    expect(screen.getByLabelText(/motivo de soporte/i)).toBeVisible();
    expect(screen.queryByText('receipt_settings.advanced')).not.toBeInTheDocument();
  });

  it('keeps technical support profiles out of the normal paper flow', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByRole('button', { name: /recibo peque/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ajustes avanzados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/soporte t/i)).not.toBeInTheDocument();
  });

  it('keeps thermal ticket compatibility out of the normal institutional paper choices', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.getByRole('radio', { name: /^Carta\b/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Media carta\b/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^A5\b/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 80/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 58/i })).not.toBeInTheDocument();
  });

  it('keeps the normal print flow to one paper selector instead of duplicate profile buttons', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText('Perfiles disponibles')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /^Carta\b/i })).toHaveLength(1);
    expect(screen.getAllByRole('radio', { name: /^Media carta\b/i })).toHaveLength(1);
    expect(screen.getAllByRole('radio', { name: /^A5\b/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Carta\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Media carta\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^A5\b/i })).not.toBeInTheDocument();
  });

  it('keeps normal print controls limited to paper copies logo seal preview and save', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.getByRole('group', { name: /formatos institucionales/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /copias/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /espacio para sello\/firma/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /mostrar logo autorizado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir prueba/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar perfil/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /leyenda de copias/i })).not.toBeInTheDocument();
  });

  it('renders normal paper settings from the safe backend payload without technical fields', async () => {
    const { apiClient } = await import('@/lib/api');
    const safeProfiles: ReceiptPrintProfile[] = mockData.profiles
      .filter((profile) => profile.code !== 'recibo_pequeno_personalizado')
      .map((profile) => ({
        id: profile.id,
        code: profile.code,
        name: profile.name,
        copies_mode: profile.copies_mode,
        show_copy_legend: profile.show_copy_legend,
        show_physical_seal_space: profile.show_physical_seal_space,
        use_logo: profile.use_logo,
        active: profile.active,
        is_global_default: profile.is_global_default,
      }));
    vi.mocked(apiClient.getInstitutionalReceiptSettings).mockResolvedValueOnce({
      ...mockData.settings,
      print_profiles: safeProfiles,
      resolved_profile: safeProfiles[0],
    });

    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.getByRole('radio', { name: /^Media carta\b/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Ancho mm')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margen sup. (mm)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar perfil/i })).toBeEnabled();
  });

  it('explains that technical print adjustments are automatic without exposing controls', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText(/css/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ajusta m.rgenes, fuente y escala autom.ticamente/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/margen|escala|fuente|tama.o/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/layout/i)).not.toBeInTheDocument();
  });

  it('does not expose profile activation controls in the normal print flow', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByRole('checkbox', { name: /perfil activo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /predeterminado global/i })).not.toBeInTheDocument();
  });

  it('keeps support-only paper controls hidden from the normal flow even for support users', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByRole('button', { name: /recibo peque/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 80/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 58/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /perfil activo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /predeterminado global/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ancho mm')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fuente')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Escala')).not.toBeInTheDocument();
  });

  it('never exposes technical print mode to application users', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText(/activar modo soporte/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ajustes avanzados/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ancho mm/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/margen/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fuente/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/escala/i)).not.toBeInTheDocument();
  });

  it('saves the selected normal paper profile as the institutional default without exposing technical controls', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    fireEvent.click(screen.getByRole('radio', { name: /^Carta\b/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar perfil/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptPrintProfile).toHaveBeenCalledWith(
        4,
        expect.objectContaining({
          active: true,
          is_global_default: true,
          template_code: 'institutional_classic',
        }),
      );
    });

    const [, payload] = vi.mocked(apiClient.updateReceiptPrintProfile).mock.calls.at(-1) ?? [];
    expect(payload).not.toHaveProperty('show_copy_legend');
    expect(screen.queryByRole('checkbox', { name: /predeterminado global/i })).not.toBeInTheDocument();
  });

  it('saves a standard paper profile as the institutional default for support users in the normal flow', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    fireEvent.click(screen.getByRole('radio', { name: /^Carta\b/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar perfil/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptPrintProfile).toHaveBeenCalledWith(
        4,
        expect.objectContaining({
          active: true,
          is_global_default: true,
          template_code: 'institutional_classic',
        }),
      );
    });

    expect(screen.queryByRole('checkbox', { name: /predeterminado global/i })).not.toBeInTheDocument();
  });

  it('keeps support-only warnings hidden while a standard paper profile is selected', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');

    expect(screen.queryByText(/modo soporte no aplica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ajustes avanzados solo aplican/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ancho mm')).not.toBeInTheDocument();
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
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    const minimum = screen.getByLabelText(/n.mero inicial/i);
    await waitFor(() => expect(minimum).toHaveValue('1'));
    await user.clear(minimum);
    await user.type(minimum, '100');
    const maximum = screen.getByLabelText(/n.mero final/i);
    await user.clear(maximum);
    await user.type(maximum, '50');
    await user.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el n.mero final debe ser mayor o igual al inicial/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('blocks saving a receipt series when the current number exceeds the range end', async () => {
    const { apiClient } = await import('@/lib/api');
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    const maximum = screen.getByLabelText(/n.mero final/i);
    await waitFor(() => expect(maximum).toHaveValue('100'));
    const current = screen.getByLabelText(/correlativo actual/i);
    await user.clear(current);
    await user.type(current, '150');
    await user.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el correlativo actual no puede superar el numero final/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('blocks saving an active receipt series when the next number leaves the authorized range', async () => {
    const { apiClient } = await import('@/lib/api');
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    const maximum = screen.getByLabelText(/n.mero final/i);
    await waitFor(() => expect(maximum).toHaveValue('100'));
    const current = screen.getByLabelText(/correlativo actual/i);
    await user.clear(current);
    await user.type(current, '100');
    await user.click(screen.getByRole('button', { name: /guardar serie/i }));

    expect(await screen.findByText(/el siguiente recibo debe quedar dentro del rango autorizado/i)).toBeInTheDocument();
    expect(apiClient.updateReceiptSeries).not.toHaveBeenCalled();
  });

  it('trims receipt series identity fields before saving', async () => {
    const { apiClient } = await import('@/lib/api');
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Serie');

    const series = screen.getByRole('textbox', { name: /^Serie$/i });
    await waitFor(() => expect(series).toHaveValue('REC-A'));
    await user.clear(series);
    await user.type(series, '  REC-B  ');
    const prefix = screen.getByRole('textbox', { name: /prefijo/i });
    await user.clear(prefix);
    await user.type(prefix, '  RB  ');
    const format = screen.getByRole('textbox', { name: /formato/i });
    await user.clear(format);
    await user.click(format);
    await user.paste('  {series}-{number:08}  ');
    await user.click(screen.getByRole('button', { name: /guardar serie/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptSeries).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          series: 'REC-B',
          prefix: 'RB',
          number_format: '{series}-{number:08}',
        }),
      );
    });
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

  it('locks normal paper profile controls while saving the profile', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient.updateReceiptPrintProfile).mockImplementation(() => new Promise(() => undefined));
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    await activateTab('Papel y copias');
    fireEvent.click(screen.getByRole('button', { name: /guardar perfil/i }));

    await waitFor(() => {
      expect(apiClient.updateReceiptPrintProfile).toHaveBeenCalled();
    });

    expect(screen.getByRole('radio', { name: /^Carta\b/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /copias/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /espacio para sello\/firma/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /imprimir prueba/i })).toBeDisabled();
  });

});
