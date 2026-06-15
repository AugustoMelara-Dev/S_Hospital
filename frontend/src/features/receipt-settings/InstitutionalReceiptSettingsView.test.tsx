import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstitutionalReceiptSettingsView canEdit onStatus={vi.fn()} />
    </QueryClientProvider>,
  );
}

function activateTab(name: string) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

describe('InstitutionalReceiptSettingsView', () => {
  it('shows the required institutional paper profiles and default single original copy mode', async () => {
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    activateTab('Papel y copias');

    expect(await screen.findByRole('button', { name: /Recibo pequeno personalizado/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Media carta horizontal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A5 horizontal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Carta horizontal/ })).toBeInTheDocument();
    expect(screen.getAllByText('Solo original').length).toBeGreaterThan(0);
  });

  it('generates a test print without leaving the settings screen', async () => {
    const { apiClient } = await import('@/lib/api');
    renderView();

    expect(await screen.findByText('Recibos institucionales')).toBeInTheDocument();
    activateTab('Papel y copias');
    fireEvent.click(await screen.findByRole('button', { name: /Imprimir prueba/ }));

    await waitFor(() => {
      expect(apiClient.testPrintInstitutionalReceipt).toHaveBeenCalledWith(expect.objectContaining({
        profile_code: 'media_carta_horizontal',
      }));
    });
  });
});
