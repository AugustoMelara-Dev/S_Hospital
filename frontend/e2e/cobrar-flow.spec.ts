import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import {
  ERYTHROPOIETIN_RULE,
  currencyTotals,
  installCatalog,
  installAdminApi,
  installPreview,
  json,
  openCashSessionFixture,
  type CatalogCategory,
  type CatalogService,
  type AdminTestUser,
  type PreviewInput,
} from './fixtures/admin-e2e';

/**
 * Cobrar — recorrido crítico del producto nuevo (mocks, sin backend):
 *  - nombre único obligatorio y normalizado,
 *  - carrito mixto EPO + productos con y sin receta (gratuidad SOLO por línea),
 *  - emisión sin cobro sin pago ficticio,
 *  - cobro normal con método y referencia.
 */

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const CASHIER: AdminTestUser = {
  id: 71,
  name: 'Cajera Facturacion',
  email: 'facturacion@hospital.local',
  username: 'facturacion.caja',
  active: true,
  roles: ['cashier'],
  permissions: [
    'catalog.view',
    'cash.view',
    'invoices.create',
    'invoices.view',
    'payments.create',
    'receipts.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const CATEGORY: CatalogCategory = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true };

const GLUCOSE: CatalogService = {
  id: 11,
  category_id: 1,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  price: '15.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: { id: 1, name: 'Laboratorio' },
};

const ERYTHROPOIETIN: CatalogService = {
  id: 33,
  category_id: 1,
  name: 'Eritropoyetina',
  slug: 'eritropoyetina',
  price: '2500.00',
  taxable: false,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: ERYTHROPOIETIN_RULE,
  category: { id: 1, name: 'Medicamentos' },
};

const SERVICES = [GLUCOSE, ERYTHROPOIETIN];

function serviceById(id: number): CatalogService {
  const service = SERVICES.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`Servicio sintético desconocido: ${id}`);
  return service;
}

/** Previsualización espejo de la regla por línea: solo el elegible con receta queda a 0. */
function buildPreview(input: PreviewInput): unknown {
  let subtotalCents = 0;
  let taxCents = 0;
  let exemptCents = 0;

  for (const item of input.items) {
    const service = serviceById(item.service_id);
    const quantity = Number(item.quantity);
    const lineCents = Math.round(Number(service.price) * 100) * quantity;
    const free = service.special_rule_code === ERYTHROPOIETIN_RULE && input.dialysis_prescription === true;

    if (free) {
      exemptCents += lineCents;
      continue;
    }

    subtotalCents += lineCents;
    if (service.taxable) taxCents += Math.round(lineCents * 0.15);
  }

  return currencyTotals({
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    exemptCents,
  });
}

function invoiceFixture(patientName: string, total: string, balanceDue: string) {
  return {
    id: 77,
    invoice_number: '000-001-01-00000077',
    patient_name: patientName,
    subtotal: total,
    tax_amount: '0.00',
    discount_amount: '0.00',
    total,
    paid_amount: '0.00',
    balance_due: balanceDue,
    status: 'issued',
    issued_at: '2026-09-18T09:00:00-06:00',
    items: [],
  };
}

function receiptFixture() {
  return {
    id: 77,
    invoice_id: 77,
    payment_id: 90,
    cash_session_id: 7,
    receipt_number: 77,
    receipt_number_full: 'REC-A-00000077',
    status: 'issued',
    amount: '17.25',
    issued_at: '2026-09-18T09:05:00-06:00',
    reprint_count: 0,
    template_code: 'institutional_compact',
    print_profile_code: 'carta_vertical',
    copy_mode: 'original_only',
  };
}

type Scenario = {
  onCreateInvoice: (payload: Record<string, unknown>) => void;
  onRegisterPayment: (payload: Record<string, unknown>) => void;
  onStoreReceipt: (payload: Record<string, unknown>) => void;
  invoiceTotal: string;
};

async function installCobrarMocks(page: Page, scenario: Scenario): Promise<void> {
  await installAdminApi(page, { user: CASHIER, cashSession: openCashSessionFixture() });
  await installCatalog(page, { categories: [CATEGORY], services: SERVICES });
  await installPreview(page, buildPreview);

  await page.route(/\/api\/invoices(?:\?.*)?$/, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      return json(route, { data: [], meta: { current_page: 1, per_page: 10, total: 0 } });
    }

    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    scenario.onCreateInvoice(payload);
    const patient = String(payload.patient_name ?? 'Paciente');
    return json(route, { data: invoiceFixture(patient, scenario.invoiceTotal, scenario.invoiceTotal) }, 201);
  });

  await page.route(/\/api\/invoices\/77\/payments$/, async (route: Route) => {
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    scenario.onRegisterPayment(payload);
    return json(
      route,
      {
        data: {
          payment: { id: 90, invoice_id: 77, amount: payload.amount, method: payload.method, status: 'posted', paid_at: '2026-09-18T09:05:00-06:00' },
          invoice: { ...invoiceFixture('Paciente', scenario.invoiceTotal, '0.00'), status: 'paid', paid_amount: scenario.invoiceTotal },
          institutional_receipt: receiptFixture(),
          institutional_receipt_error: null,
          receipt_outcome: 'issued',
        },
      },
      201,
    );
  });

  await page.route(/\/api\/institutional-receipts$/, async (route: Route) => {
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    scenario.onStoreReceipt(payload);
    return json(route, { data: receiptFixture() }, 201);
  });
}

async function addService(page: Page, name: string): Promise<void> {
  // Re-anclado al contrato vivo del rediseño (Dark 2026-10-16): tras cada
  // agregado CatalogZone colapsa la lista de resultados (`resultsDismissed`,
  // CatalogZone.tsx:57-58,96-102) y `handleCategoryChange` solo la re-abre si
  // la categoría cambia, por lo que el stub anterior con `selectOption('1')`
  // único colapsaba en la segunda agregación. El fill del buscador re-activa
  // resultados via `handleSearchChange` y el mock de `/api/services` filtra
  // por nombre (fixtures/admin-e2e.ts:154-158), haciendo determinista la
  // primera y las sucesivas agregaciones.
  const searchBox = page.getByLabel(/buscar servicio o producto/i);
  await searchBox.fill(name);
  const addButton = page.getByRole('button', { name: new RegExp(`agregar ${name}`, 'i') }).first();
  await expect(addButton).toBeVisible({ timeout: 10_000 });
  await addButton.click();
  await expect(page.getByRole('table', { name: /líneas de la cuenta/i }).getByText(name, { exact: false }).first()).toBeVisible();
}

async function readTotal(page: Page): Promise<string> {
  // Ancla vigente (SummaryActionZone.tsx:73-84 y contrato congelado en
  // src/lib/__regression__/moneyContract.r2.test.tsx:137-168): la etiqueta es
  // «Total confirmado» y el importe vive en el `span[data-ui-money]` hermano.
  // El monto esperado no cambia; solo el selector de observación.
  return page.getByRole('complementary', { name: /total y acción/i }).evaluate((element) => {
    const total = [...element.querySelectorAll('span')].find((span) => span.textContent?.trim() === 'Total confirmado');
    return total?.parentElement?.querySelector('[data-ui-money]')?.textContent?.trim() ?? '';
  });
}

test.describe('Cobrar — recorrido del producto nuevo', () => {
  test('exige el nombre del paciente y lo normaliza antes de habilitar el cobro', async ({ page }) => {
    await installCobrarMocks(page, {
      onCreateInvoice: () => undefined,
      onRegisterPayment: () => undefined,
      onStoreReceipt: () => undefined,
      invoiceTotal: '17.25',
    });

    await page.goto('/cobrar');
    await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();

    const primary = page.getByTestId('cobrar-primary-action');
    await addService(page, 'Glucosa basal');

    await expect(primary).toBeDisabled();
    await expect(page.getByText(/ingrese el nombre del paciente/i)).toBeVisible();

    await page.getByLabel(/nombre del paciente/i).fill('  José   Ángel O\'Brien  ');
    // La identidad nueva no muestra un indicador "Paciente identificado" (el
    // mandato prohíbe esa decoración). La normalización del nombre sigue siendo
    // contrato del esquema, cubierto por cobrarSchema.test.ts; aquí se comprueba
    // que el nombre habilita el cobro.
    await expect(primary).toBeEnabled({ timeout: 10_000 });
  });

  test('carrito mixto: la receta solo libera el medicamento elegible y el resto se cobra', async ({ page }) => {
    const invoicePayloads: Array<Record<string, unknown>> = [];
    const paymentPayloads: Array<Record<string, unknown>> = [];

    await installCobrarMocks(page, {
      onCreateInvoice: (payload) => invoicePayloads.push(payload),
      onRegisterPayment: (payload) => paymentPayloads.push(payload),
      onStoreReceipt: () => undefined,
      invoiceTotal: '17.25',
    });

    await page.goto('/cobrar');
    await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
    await addService(page, 'Eritropoyetina');
    await addService(page, 'Glucosa basal');

    // Sin receta, EPO se cobra: 2500 + 15 + ISV de 2.25 = 2517.25
    await expect.poll(() => readTotal(page), { timeout: 10_000 }).toBe('L. 2,517.25');

    const condition = page.getByRole('checkbox', { name: /paciente con receta de diálisis/i });
    await condition.check();

    // Con receta, solo el elegible queda en 0: queda la glucosa (15 + 2.25).
    await expect.poll(() => readTotal(page), { timeout: 10_000 }).toBe('L. 17.25');
    const account = page.getByRole('table', { name: /líneas de la cuenta/i });
    await expect(account.getByText(/sin cobro por receta/i)).toBeVisible();

    await page.getByTestId('cobrar-primary-action').click();
    const confirmDialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Maria Lopez');
    await expect(confirmDialog).toContainText('L. 17.25');
    await page.getByTestId('cobrar-confirm').click();

    await expect.poll(() => invoicePayloads.length).toBe(1);
    expect(invoicePayloads[0]).toMatchObject({
      patient_name: 'Maria Lopez',
      dialysis_prescription: true,
      items: [
        { service_id: ERYTHROPOIETIN.id, quantity: '1' },
        { service_id: GLUCOSE.id, quantity: '1' },
      ],
    });
    await expect.poll(() => paymentPayloads.length).toBe(1);
    expect(paymentPayloads[0]).toMatchObject({ method: 'cash', amount: '17.25' });
    await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
  });

  test('emite sin cobro cuando el total es 0 y no registra pago ficticio', async ({ page }) => {
    let paymentRequests = 0;
    let receiptRequests = 0;

    await installCobrarMocks(page, {
      onCreateInvoice: () => undefined,
      onRegisterPayment: () => {
        paymentRequests += 1;
      },
      onStoreReceipt: () => {
        receiptRequests += 1;
      },
      invoiceTotal: '0.00',
    });

    await page.goto('/cobrar');
    await page.getByLabel(/nombre del paciente/i).fill('Paciente EPO');
    await addService(page, 'Eritropoyetina');
    await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();

    await expect.poll(() => readTotal(page), { timeout: 10_000 }).toBe('L. 0.00');
    const primary = page.getByTestId('cobrar-primary-action');
    await expect(primary).toHaveText(/emitir sin cobro/i);
    await primary.click();

    const confirmDialog = page.getByRole('dialog', { name: /confirmar emisión sin cobro/i });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(/no se registrará pago/i)).toBeVisible();
    await expect(confirmDialog.getByText(/método de pago/i)).toHaveCount(0);
    await page.getByTestId('cobrar-confirm').click();

    await expect.poll(() => receiptRequests).toBe(1);
    await expect(page.getByRole('heading', { name: /operación emitida sin cobro/i })).toBeVisible();
    expect(paymentRequests).toBe(0);
  });

  test('cobra normalmente con método y referencia y abre el comprobante', async ({ page }) => {
    const paymentPayloads: Array<Record<string, unknown>> = [];

    await installCobrarMocks(page, {
      onCreateInvoice: () => undefined,
      onRegisterPayment: (payload) => paymentPayloads.push(payload),
      onStoreReceipt: () => undefined,
      invoiceTotal: '17.25',
    });

    await page.goto('/cobrar');
    await page.getByLabel(/nombre del paciente/i).fill('Carlos Rivera');
    await addService(page, 'Glucosa basal');

    await expect.poll(() => readTotal(page), { timeout: 10_000 }).toBe('L. 17.25');
    await page.getByTestId('cobrar-primary-action').click();

    const confirmDialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await confirmDialog.getByRole('radio', { name: 'Transferencia' }).click();
    await confirmDialog.getByLabel(/referencia/i).fill('TX-QA-001');
    await page.getByTestId('cobrar-confirm').click();

    await expect.poll(() => paymentPayloads.length).toBe(1);
    expect(paymentPayloads[0]).toMatchObject({
      method: 'transfer',
      amount: '17.25',
      reference: 'TX-QA-001',
      cash_session_id: 7,
    });
    await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar pdf/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^imprimir$/i })).toBeEnabled();
  });
});
