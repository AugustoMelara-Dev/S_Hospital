import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';
import type { ReceiptPrintProfile } from '@/lib/api';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
import type { ReceiptDocumentPlan } from './useReceiptEnginePreview';

const profile: ReceiptPrintProfile = {
  id: 1,
  code: 'media_carta_horizontal',
  name: 'Media carta horizontal',
  paper_kind: 'half_letter_landscape',
  width_mm: '215.90',
  height_mm: '139.70',
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
  active: true,
  is_global_default: true,
};

function renderPreview(element: ReactElement, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const rendered = render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);

  return { ...rendered, queryClient };
}

function engineResponse(overrides: Partial<{ html: string; copy_labels: string[]; copy_count: number; document: ReceiptDocumentPlan }> = {}) {
  return {
    data: {
      html: '<!doctype html><html><body><p>MOTOR-REC-A-00000005</p></body></html>',
      copy_labels: ['ORIGINAL'],
      copy_count: 1,
      ...overrides,
    },
  };
}

/**
 * Canonical generator result (C3-P2). Pages are a measured property of the
 * document, never derived from the copy count: the two-zone sheet can put two
 * examples on one page and a long operation can need extra pages.
 */
function samplePlan(overrides: Partial<ReceiptDocumentPlan> = {}): ReceiptDocumentPlan {
  return {
    paper: { kind: 'half_letter_landscape', label: 'Media carta', orientation: 'landscape', width_pt: 612, height_pt: 396 },
    copies: { count: 1, labels: ['ORIGINAL'], destinations: ['ORIGINAL'] },
    page_count: 1,
    sheet_count: 1,
    requested_composition: 'single',
    used_composition: 'single',
    distribution: [{ sheet: 1, destinations: ['ORIGINAL'], pages: 1 }],
    alternative_output: false,
    alternative_reason: null,
    draft: false,
    headline: 'Media carta · 1 ejemplar · 1 página PDF.',
    print_instruction:
      'El documento ya incluye los ejemplares: imprima una copia del conjunto y no aumente el número de copias en el diálogo de impresión.',
    sheet_assumption: null,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('ReceiptSettingsPreview (motor real)', () => {
  it('renders the exact HTML returned by the receipt engine in a sandboxed iframe', async () => {
    const html = '<!doctype html><html><body><p>MOTOR-REC-A-00000005</p></body></html>';
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(engineResponse({ html }));

    renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />);

    const frame = await screen.findByTitle('Vista previa del recibo institucional (Media carta)');
    expect(frame).toHaveAttribute('srcdoc', html);
    // Most restrictive sandbox: static server-rendered document, no scripts.
    expect(frame).toHaveAttribute('sandbox', '');
    expect(screen.getByRole('region', { name: 'Vista previa de recibo Media carta' })).toBeInTheDocument();

    expect(request).toHaveBeenCalledTimes(1);
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/api/settings/institutional-receipts/test-preview');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      profile_code: 'media_carta_horizontal',
      payer_name: 'Paciente de prueba',
      amount: '25.00',
    });
  });

  it('never renders a parallel mockup document when the motor HTML is shown', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue(engineResponse());

    renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />);
    await screen.findByTitle('Vista previa del recibo institucional (Media carta)');

    // The previous mockup exposed these nodes/strings; the engine iframe must not.
    expect(screen.queryByText('Consulta de medicina general')).not.toBeInTheDocument();
    expect(screen.queryByText('PRUEBA-SIN-SERIE')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/data-receipt-preview-table|data-receipt-preview-signatures|data-receipt-preview-content/);
  });

  it('requests a new preview and updates the content when the selected profile changes', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(engineResponse({ html: '<html><body>MOTOR-MEDIA-CARTA</body></html>' }))
      .mockResolvedValueOnce(
        engineResponse({
          html: '<html><body>MOTOR-CARTA-HORIZONTAL</body></html>',
          copy_labels: ['ORIGINAL', 'PRIMERA COPIA'],
          copy_count: 2,
        }),
      );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { rerender } = renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />, queryClient);
    await screen.findByTitle('Vista previa del recibo institucional (Media carta)');

    const nextProfile: ReceiptPrintProfile = { ...profile, code: 'carta_horizontal', name: 'Carta horizontal' };
    rerender(
      <QueryClientProvider client={queryClient}>
        <ReceiptSettingsPreview profile={nextProfile} paper="letter" />
      </QueryClientProvider>,
    );

    const updated = await screen.findByTitle('Vista previa del recibo institucional (Carta horizontal)');
    expect(updated).toHaveAttribute('srcdoc', '<html><body>MOTOR-CARTA-HORIZONTAL</body></html>');
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((request.mock.calls[1][1] as RequestInit).body)).profile_code).toBe('carta_horizontal');
  });

  it('states the measured document result and never says "one page per copy" (§13 / C3-P2)', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue(
      engineResponse({
        copy_labels: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
        copy_count: 3,
        document: samplePlan({
          copies: {
            count: 3,
            labels: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
            destinations: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
          },
          page_count: 3,
          sheet_count: 3,
          distribution: [
            { sheet: 1, destinations: ['ORIGINAL'], pages: 1 },
            { sheet: 2, destinations: ['PRIMERA COPIA'], pages: 1 },
            { sheet: 3, destinations: ['SEGUNDA COPIA'], pages: 1 },
          ],
          headline: 'Media carta · 3 ejemplares · 3 páginas PDF.',
          sheet_assumption: 'Las hojas se estiman suponiendo impresión a una cara; el PDF no conoce la configuración de doble cara de la impresora.',
        }),
      }),
    );

    renderPreview(<ReceiptSettingsPreview profile={{ ...profile, copies_mode: 'original_first_second' }} paper="half_letter" />);

    expect(await screen.findByText(/Este PDF es una copia del conjunto/i)).toBeInTheDocument();
    // The text is the measured plan, not a page count derived from the copies.
    expect(await screen.findByText('Media carta · 3 ejemplares · 3 páginas PDF.')).toBeInTheDocument();
    expect(screen.getByText(/imprima una copia del conjunto/i)).toBeInTheDocument();
    // Speaking of physical sheets declares the one-face assumption.
    expect(screen.getByText(/impresión a una cara/)).toBeInTheDocument();
    expect(screen.queryByText(/una por copia/i)).not.toBeInTheDocument();
  });

  it('shows the preparation state without inventing a page or copy figure (C3-P2)', () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => new Promise(() => undefined));

    renderPreview(<ReceiptSettingsPreview profile={{ ...profile, copies_mode: 'original_first_second' }} paper="half_letter" />);

    const pending = screen.getByTestId('receipt-settings-preview').querySelector('[data-receipt-plan-pending]');
    expect(pending).not.toBeNull();
    expect(pending).toHaveTextContent('Preparando la vista previa del conjunto…');

    // No figure about pages or copies before the engine answers.
    expect(screen.queryByText(/Contiene \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ páginas?/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ ejemplares?/)).not.toBeInTheDocument();
    expect(screen.queryByText(/una por copia/i)).not.toBeInTheDocument();
  });

  it('shows a loading state while the engine builds the preview', () => {
    vi.spyOn(apiClient, 'request').mockImplementation(() => new Promise(() => undefined));

    renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />);

    expect(screen.getByRole('status', { name: 'Preparando la vista previa del recibo' })).toBeInTheDocument();
  });

  it('shows a recoverable error and refetches on Reintentar', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockRejectedValueOnce(new ApiError('engine failed', 500))
      .mockResolvedValueOnce(engineResponse({ html: '<html><body>MOTOR-REINTENTO</body></html>' }));

    renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />);

    expect(await screen.findByText('No se pudo preparar la vista previa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

    const frame = await screen.findByTitle('Vista previa del recibo institucional (Media carta)');
    expect(frame).toHaveAttribute('srcdoc', '<html><body>MOTOR-REINTENTO</body></html>');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('shows a permission-specific state when the endpoint denies access', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(new ApiError('denied', 403));

    renderPreview(<ReceiptSettingsPreview profile={profile} paper="half_letter" />);

    expect(await screen.findByText('Sin permiso para la vista previa')).toBeInTheDocument();
    expect(screen.getByText(/no tiene permiso para previsualizar el recibo institucional/i)).toBeInTheDocument();
  });

  it('renders the real engine draft (not the stored profile) when a validated draft is provided', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(
      engineResponse({
        html: '<!doctype html><html><body><p>MOTOR-BORRADOR-ORIGINAL-DOS-COPIAS</p></body></html>',
        copy_labels: ['ORIGINAL', 'PRIMERA COPIA'],
        copy_count: 2,
      }),
    );

    renderPreview(
      <ReceiptSettingsPreview
        profile={profile}
        paper="half_letter"
        draftProfile={{ copies_mode: 'original_first', show_copy_legend: true }}
      />,
    );

    const frame = await screen.findByTitle('Vista previa del recibo institucional (Media carta)');
    expect(frame).toHaveAttribute('srcdoc', '<!doctype html><html><body><p>MOTOR-BORRADOR-ORIGINAL-DOS-COPIAS</p></body></html>');
    expect(screen.getByText('Borrador sin guardar')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-settings-preview').querySelector('[data-receipt-preview-mode="draft"]')).not.toBeNull();

    const body = JSON.parse(String((request.mock.calls[0][1] as RequestInit).body));
    expect(body.draft).toMatchObject({ copies_mode: 'original_first', show_copy_legend: true });
    expect(body.reserved_number).toBeUndefined();
  });

  it('does not let an older draft response replace a newer preview', async () => {
    let resolveFirst: (value: ReturnType<typeof engineResponse>) => void = () => undefined;
    let resolveSecond: (value: ReturnType<typeof engineResponse>) => void = () => undefined;
    vi.spyOn(apiClient, 'request')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = renderPreview(
      <ReceiptSettingsPreview profile={profile} paper="half_letter" draftProfile={{ copies_mode: 'original_first' }} />,
      queryClient,
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <ReceiptSettingsPreview
          profile={profile}
          paper="half_letter"
          draftProfile={{ copies_mode: 'original_first_second' }}
        />
      </QueryClientProvider>,
    );

    // The second (newer) request resolves first, then the older one resolves late.
    resolveSecond(engineResponse({ html: '<html><body>BORRADOR-NUEVO</body></html>' }));
    resolveFirst(engineResponse({ html: '<html><body>BORRADOR-VIEJO</body></html>' }));

    const frame = await screen.findByTitle('Vista previa del recibo institucional (Media carta)');
    await waitFor(() => expect(frame).toHaveAttribute('srcdoc', '<html><body>BORRADOR-NUEVO</body></html>'));
    expect(frame).not.toHaveAttribute('srcdoc', '<html><body>BORRADOR-VIEJO</body></html>');
  });

  it('keeps the aspect ratio and offers zoom and sheet navigation across the copy set', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue(
      engineResponse({
        copy_labels: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
        copy_count: 3,
        document: samplePlan({
          copies: {
            count: 3,
            labels: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
            destinations: ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
          },
          page_count: 3,
          sheet_count: 3,
          headline: 'Media carta · 3 ejemplares · 3 páginas PDF.',
        }),
        html: '<!DOCTYPE html><html><head><style>@page{margin:12mm}</style></head><body>'
          + '<section class="receipt-page primary-paper"><p>PAGINA-UNO</p></section>'
          + '<section class="receipt-page primary-paper"><p>PAGINA-DOS</p></section>'
          + '<section class="receipt-page primary-paper"><p>PAGINA-TRES</p></section>'
          + '</body></html>',
      }),
    );

    renderPreview(
      <ReceiptSettingsPreview
        profile={{ ...profile, copies_mode: 'original_first_second' }}
        paper="half_letter"
      />,
    );

    const frame = await screen.findByTitle('Vista previa del recibo institucional (Media carta)');
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('PAGINA-UNO'));
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('@page'));

    // The navigation walks the document's page blocks (sheets), not the copies.
    expect(screen.getByText('Hoja 1 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hoja siguiente/ }));
    await waitFor(() => expect(screen.getByText('Hoja 2 de 3')).toBeInTheDocument());
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('PAGINA-DOS'));

    fireEvent.click(screen.getByRole('button', { name: /Acercar vista previa/ }));
    await waitFor(() => expect(screen.getByText('125%')).toBeInTheDocument());
    expect(screen.getByTestId('receipt-settings-preview').querySelector('[data-receipt-preview-scale="1.25"]')).not.toBeNull();
  });

  it('does not call the engine when no profile is selected', () => {
    const request = vi.spyOn(apiClient, 'request');

    renderPreview(<ReceiptSettingsPreview profile={null} paper="half_letter" />);

    expect(screen.getByText('Sin perfil de impresión')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
