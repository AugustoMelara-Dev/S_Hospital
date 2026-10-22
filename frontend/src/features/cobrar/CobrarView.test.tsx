import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, type AuthUser, type CashSession, type Invoice, type InvoicePreview, type PaymentRegistrationResult, type Service } from '@/lib/api';
import { billing } from '@/lib/api/billing';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { ERYTHROPOIETIN_RULE } from './state/domain';
import { CobrarView } from './CobrarView';

const PERMISSIONS = [
  'invoices.create',
  'catalog.view',
  'cash.view',
  'payments.create',
  'receipts.view',
  'patients.mark_dialysis_prescription',
];

function authUser(): AuthUser {
  return {
    id: 1,
    name: 'Cajero',
    email: 'cajero@example.test',
    username: 'cajero',
    active: true,
    roles: ['cajero'],
    permissions: PERMISSIONS,
    must_change_password: false,
  };
}

function cashSession(): CashSession {
  return {
    id: 7,
    user_id: 1,
    opening_amount: '0.00',
    closing_amount: null,
    expected_amount: null,
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-18T10:00:00Z',
    closed_at: null,
  };
}

function sampleService(): Service {
  return {
    id: 42,
    category_id: 3,
    name: 'Hemograma completo',
    slug: 'hemograma-completo',
    price: '100.00',
    taxable: false,
    active: true,
    special_rule_code: null,
    category: { id: 3, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: null,
  };
}

function positivePreview(): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: 10000,
      taxable_base_cents: 0,
      exempt_cents: 10000,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: 10000,
    },
    zero_reason: null,
    items: [
      {
        service_id: 42,
        service_name: 'Hemograma completo',
        quantity: '1',
        quantity_cents: 100,
        unit_price_cents: 10000,
        unit_price_registered_cents: 10000,
        taxable: false,
        tax_rate: '0.00',
        line_subtotal_cents: 10000,
        tax_cents: 0,
        line_total_cents: 10000,
        special_rule_code: null,
        special_rule_applied: false,
        rule_adjustment_cents: 0,
      },
    ],
    emission: {
      persisted: false,
      invoice_created: false,
      fiscal_number_consumed: false,
      payment_created: false,
      institutional_receipt_created: false,
    },
  };
}

/** Glucosa gravable 15.00 + EPO elegible 2,500.00 con receta: total 17.25. */
function glucoseService(): Service {
  return {
    ...sampleService(),
    id: 11,
    name: 'Glucosa basal',
    slug: 'glucosa-basal',
    price: '15.00',
    taxable: true,
  };
}

function erythropoietinService(): Service {
  return {
    id: 33,
    category_id: 4,
    name: 'Eritropoyetina',
    slug: 'eritropoyetina',
    price: '2500.00',
    taxable: false,
    active: true,
    special_rule_code: ERYTHROPOIETIN_RULE,
    category: { id: 4, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 2 },
    area: null,
  };
}

/**
 * Valoración que replica el contrato del servidor: la línea gratuita no aporta
 * base exenta (`exempt_cents: 0`) y el total es 15.00 + ISV 2.25.
 */
function mixedPreview(): InvoicePreview {
  return {
    ...positivePreview(),
    totals: {
      subtotal_cents: 1500,
      taxable_base_cents: 1500,
      exempt_cents: 0,
      tax_cents: 225,
      discount_cents: 0,
      total_cents: 1725,
    },
    items: [
      {
        service_id: 11,
        service_name: 'Glucosa basal',
        quantity: '1',
        quantity_cents: 100,
        unit_price_cents: 1500,
        unit_price_registered_cents: 1500,
        taxable: true,
        tax_rate: '15.00',
        line_subtotal_cents: 1500,
        tax_cents: 225,
        line_total_cents: 1725,
        special_rule_code: null,
        special_rule_applied: false,
        rule_adjustment_cents: 0,
      },
      {
        service_id: 33,
        service_name: 'Eritropoyetina',
        quantity: '1',
        quantity_cents: 100,
        unit_price_cents: 0,
        unit_price_registered_cents: 250000,
        taxable: false,
        tax_rate: '0.00',
        line_subtotal_cents: 0,
        tax_cents: 0,
        line_total_cents: 0,
        special_rule_code: ERYTHROPOIETIN_RULE,
        special_rule_applied: true,
        rule_adjustment_cents: 250000,
      },
    ],
  };
}

function renderCobrar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const onStatus = vi.fn();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider
        user={authUser()}
        cashSession={cashSession()}
        cashSessionLoading={false}
        onStatus={onStatus}
      >
        <CobrarView />
      </AdminSessionProvider>
    </QueryClientProvider>,
  );

  return { ...result, queryClient, onStatus };
}

function mockCatalog() {
  vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
    data: [sampleService()],
    meta: { current_page: 1, per_page: 30, total: 1 },
  });
  vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
}

function mockMixedCatalog() {
  vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({
    data: [glucoseService(), erythropoietinService()],
    meta: { current_page: 1, per_page: 30, total: 2 },
  });
  vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
}

async function addFirstService(user: ReturnType<typeof userEvent.setup>) {
  const addButton = await screen.findByRole('button', { name: /agregar hemograma completo/i });
  await user.click(addButton);
}

describe('CobrarView · recorrido continuo', () => {
  it('captura SOLO el nombre del paciente y no pide datos clínicos', async () => {
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());

    expect(screen.getByRole('heading', { level: 1, name: 'Cobrar' })).toBeVisible();
    expect(screen.getByLabelText(/nombre del paciente/i)).toBeVisible();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(
      screen.queryByLabelText(/rtn|expediente|identidad|contacto|tel[eé]fono|edad|seguro|diagn[oó]stico/i),
    ).not.toBeInTheDocument();
  });

  it('bloquea el cobro sin nombre y lo explica junto a la acción', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    await addFirstService(user);

    await waitFor(() =>
      expect(screen.getByText(/ingrese el nombre del paciente/i)).toBeVisible(),
    );
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();
  });

  it('un error del servidor no se muestra como L 0.00', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockRejectedValue(new Error('No hay conexión con el servidor local.'));
    renderCobrar();

    await addFirstService(user);

    await waitFor(() =>
      expect(screen.getByText(/no hay conexión con el servidor local/i)).toBeVisible(),
    );

    expect(screen.queryByText(/L\.\s*0\.00/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/no se pudo confirmar el total/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();
  });

  it('muestra una sola zona de acción móvil según la posición del resumen', async () => {
    let reportIntersection: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();

    class IntersectionObserverStub {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {
        disconnect();
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0.01];
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    mockCatalog();
    const view = renderCobrar();

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());
    expect(screen.queryByTestId('cobrar-mobile-action')).not.toBeInTheDocument();

    act(() => {
      reportIntersection?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.getByTestId('cobrar-mobile-action')).toBeVisible();

    act(() => {
      reportIntersection?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.queryByTestId('cobrar-mobile-action')).not.toBeInTheDocument();

    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('con receta el Exento es el del servidor (L 0.00), no el precio de la línea gratuita', async () => {
    const user = userEvent.setup();
    mockMixedCatalog();
    const preview = vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(mixedPreview());
    renderCobrar();

    const patient = await screen.findByLabelText(/nombre del paciente/i);
    await user.type(patient, 'Maria Lopez');

    await user.click(await screen.findByRole('button', { name: /agregar glucosa basal/i }));
    await user.click(await screen.findByRole('button', { name: /agregar eritropoyetina/i }));
    await user.click(
      await screen.findByRole('checkbox', { name: /paciente con receta de diálisis/i }),
    );

    const totalZone = await screen.findByRole('complementary', { name: /total y acción/i });
    await waitFor(() =>
      expect(within(totalZone).getByText(/^L\.\s*17\.25$/)).toBeVisible(),
    );

    expect(within(totalZone).getByText(/^L\.\s*0\.00$/)).toBeVisible();
    expect(
      within(screen.getByRole('table', { name: /líneas de la cuenta/i })).getAllByText(/L\.\s*2,500\.00/).length,
    ).toBeGreaterThan(0);
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({ dialysis_prescription: true }),
    );
  });

  it('una cantidad inválida muestra texto de error junto al campo, no un importe', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    await addFirstService(user);

    // Anclado: los botones del stepper llevan aria-label "Disminuir/Aumentar
    // cantidad de Hemograma completo"; solo el input es el control de cantidad.
    const quantity = screen.getByLabelText(/^cantidad de hemograma completo$/i);
    await user.clear(quantity);
    await user.type(quantity, '0');

    const error = await screen.findByText(/cantidad inválida/i);
    expect(error).toBeVisible();
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(quantity).toHaveAttribute('aria-describedby', error.id);
    expect(screen.queryByText(/L\.\s*0\.00/)).not.toBeInTheDocument();
  });

  it('compone la estación como una unidad: paciente, líneas y total/acción dentro de la Cuenta', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    const station = await screen.findByRole('region', { name: 'Cuenta' });

    await user.type(within(station).getByLabelText(/nombre del paciente/i), 'Maria Lopez');
    await user.click(await screen.findByRole('button', { name: /agregar hemograma completo/i }));

    // Las tres partes del recorrido viven en la MISMA superficie: el paciente
    // abre la cuenta, las líneas la siguen y la barra de total/acción la cierra.
    expect(within(station).getByLabelText(/nombre del paciente/i)).toBeVisible();
    expect(within(station).getByRole('table', { name: /líneas de la cuenta/i })).toBeVisible();

    const totalZone = within(station).getByRole('complementary', { name: /total y acción/i });
    await waitFor(() =>
      expect(within(totalZone).getByText('Total confirmado').nextElementSibling?.textContent?.trim()).toBe('L. 100.00'),
    );
    expect(within(totalZone).getByTestId('cobrar-primary-action')).toBeEnabled();

    // El catálogo es el área hermana de la estación, no una tercera torre.
    expect(screen.getByRole('region', { name: 'Agregar conceptos' })).toBeVisible();
    expect(screen.getByText('Caja abierta')).toBeVisible();
  });

  it('abre un borrador real del comprobante sin emitir ni cobrar', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    const previewReceipt = vi.spyOn(billing, 'previewInvoiceReceipt').mockResolvedValue({
      draft: true,
      watermark: 'BORRADOR - SIN VALIDEZ',
      reserved_number: false,
      html: '<!doctype html><html><body>Comprobante borrador</body></html>',
      document: {
        paper: { kind: 'letter', label: 'Carta', orientation: 'portrait', width_pt: 612, height_pt: 792 },
        copies: { count: 1, labels: ['Original'], destinations: ['Paciente'] },
        page_count: 1,
        sheet_count: 1,
        requested_composition: 'single',
        used_composition: 'single',
        distribution: null,
        alternative_output: null,
        alternative_reason: null,
        draft: true,
        headline: 'Comprobante borrador',
        print_instruction: 'Vista previa',
        sheet_assumption: 'Una hoja',
      },
      valuation: positivePreview(),
    });
    const createInvoice = vi.spyOn(apiClient, 'createInvoice');
    const registerPayment = vi.spyOn(apiClient, 'registerPayment');
    renderCobrar();

    await user.type(screen.getByLabelText(/nombre del paciente/i), 'Ana López');
    await addFirstService(user);
    const previewButton = await screen.findByRole('button', { name: /^vista previa$/i });
    await waitFor(() => expect(previewButton).toBeEnabled());
    await user.click(previewButton);

    const frame = await screen.findByTitle(/vista previa del comprobante antes de emitir/i);
    const dialog = screen.getByRole('dialog', { name: /vista previa del comprobante/i });
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('Comprobante borrador'));
    expect(within(dialog).getByText(/revise el comprobante antes de cobrar/i)).toBeVisible();
    expect(within(dialog).queryByText(/servidor|correlativo|portrait/i)).not.toBeInTheDocument();
    expect(previewReceipt).toHaveBeenCalledWith({
      patient_name: 'Ana López',
      items: [{ service_id: 42, quantity: '1' }],
    });
    expect(createInvoice).not.toHaveBeenCalled();
    expect(registerPayment).not.toHaveBeenCalled();
  });

  it('el estado del recorrido se lee en la cabecera de la estación y cambia con la cuenta', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    const station = await screen.findByRole('region', { name: 'Cuenta' });

    // Borrador: sin líneas, el estado vacío lo explica y no hay acción.
    expect(within(station).getByText('Borrador')).toBeVisible();
    expect(within(station).getByText(/la cuenta está vacía/i)).toBeVisible();
    expect(within(station).getByTestId('cobrar-primary-action')).toBeDisabled();

    await addFirstService(user);

    // Falta el nombre: el estado pasa a "Revise la cuenta" y el motivo es textual.
    await waitFor(() => expect(within(station).getByText(/revise la cuenta/i)).toBeVisible());
    expect(within(station).getByText(/ingrese el nombre del paciente/i)).toBeVisible();

    await user.type(within(station).getByLabelText(/nombre del paciente/i), 'Maria Lopez');

    await waitFor(() => expect(within(station).getByText(/listo para cobrar/i)).toBeVisible());
    expect(within(station).getByTestId('cobrar-primary-action')).toBeEnabled();
  });

  it('deja de contar conceptos en cuenta cuando la operación queda cobrada', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());

    const invoice = {
      id: 77,
      invoice_number: '000-001-01-00000077',
      total: '100.00',
      balance_due: '100.00',
      status: 'issued',
    } as unknown as Invoice;
    const paidInvoice = { ...invoice, status: 'paid', balance_due: '0.00' } as unknown as Invoice;
    vi.spyOn(apiClient, 'createInvoice').mockResolvedValue(invoice);
    vi.spyOn(apiClient, 'registerPayment').mockResolvedValue({
      receipt_outcome: 'not_required',
      institutional_receipt: null,
      invoice: paidInvoice,
      payment: { paid_at: '2026-10-21T12:00:00Z' },
    } as unknown as PaymentRegistrationResult);

    renderCobrar();

    await user.type(screen.getByLabelText(/nombre del paciente/i), 'Ana López');
    await addFirstService(user);
    expect(await screen.findByText(/1 concepto en cuenta/i)).toBeVisible();

    const action = await screen.findByTestId('cobrar-primary-action');
    await waitFor(() => expect(action).toBeEnabled());
    await user.click(action);
    await user.click(await screen.findByTestId('cobrar-confirm'));

    await waitFor(() => expect(screen.queryByText(/concepto en cuenta/i)).not.toBeInTheDocument());
  });

  it('un Enter en la búsqueda agrega el concepto seleccionado sin abrir confirmación ni cobrar', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    // Esperar a que el catálogo cargue los servicios
    const searchInput = await screen.findByRole('searchbox');
    await user.click(searchInput);
    await user.type(searchInput, 'hemo');
    await screen.findByRole('button', { name: /^agregar hemograma completo$/i });
    await user.keyboard('{Enter}');

    // El concepto se agregó a la cuenta
    const station = await screen.findByRole('region', { name: 'Cuenta' });
    await waitFor(() => {
      const table = within(station).getByRole('table', { name: /líneas de la cuenta/i });
      expect(within(table).getByText('Hemograma completo')).toBeVisible();
    });

    // El diálogo de confirmación NUNCA se abre por dar Enter en búsqueda
    expect(screen.queryByRole('dialog', { name: /confirmar/i })).not.toBeInTheDocument();
    expect(searchInput).toHaveValue('');
    expect(searchInput).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^agregar hemograma completo$/i })).not.toBeInTheDocument();

    await user.type(searchInput, 'hemo');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^agregar hemograma completo$/i })).toBeVisible(),
    );
    expect(searchInput).toHaveFocus();
  });

  it('no agrega un resultado anterior mientras la nueva búsqueda sigue pendiente', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    renderCobrar();

    await screen.findByRole('button', { name: /agregar hemograma completo/i });
    const searchInput = screen.getByRole('searchbox');
    await user.type(searchInput, 'eritro{Enter}');

    expect(screen.getByText(/la cuenta está vacía/i)).toBeVisible();
    expect(screen.queryByRole('dialog', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  it('conserva la misma cuenta bloqueada cuando la respuesta de emisión es ambigua', async () => {
    const user = userEvent.setup();
    mockCatalog();
    vi.spyOn(apiClient, 'previewInvoice').mockResolvedValue(positivePreview());
    const createInvoice = vi.spyOn(apiClient, 'createInvoice').mockRejectedValue(new Error('Sin respuesta del servidor local.'));
    renderCobrar();

    await user.type(screen.getByLabelText(/nombre del paciente/i), 'María López');
    await addFirstService(user);
    await waitFor(() => expect(screen.getByTestId('cobrar-primary-action')).toBeEnabled());
    await user.click(screen.getByTestId('cobrar-primary-action'));
    await user.click(await screen.findByTestId('cobrar-confirm'));

    expect(await screen.findByText(/reintente esta misma operación/i)).toBeVisible();
    expect(screen.getByLabelText(/nombre del paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/^cantidad de hemograma completo$/i)).toBeDisabled();

    await user.click(screen.getByTestId('cobrar-primary-action'));
    await user.click(await screen.findByTestId('cobrar-confirm'));

    expect(createInvoice).toHaveBeenCalledTimes(2);
    expect(createInvoice.mock.calls[1]?.[1]?.idempotencyKey).toBe(createInvoice.mock.calls[0]?.[1]?.idempotencyKey);
  });



  it('inicia con estado completamente limpio: sin paciente, sin líneas y sin condición de diálisis', async () => {
    mockCatalog();
    renderCobrar();

    const patientInput = await screen.findByLabelText(/nombre del paciente/i);
    expect(patientInput).toHaveValue('');
    expect(screen.getByText(/la cuenta está vacía/i)).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /paciente con receta de diálisis/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();
  });
});

