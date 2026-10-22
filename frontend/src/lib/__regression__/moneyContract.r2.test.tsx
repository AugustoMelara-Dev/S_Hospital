/**
 * R2-MONEY-QA — Regresión INDEPENDIENTE del P0 monetario.
 *
 * Contrato original (hs-qa, 2026-09-18): la cadena de producción
 *   posMath.computeSimpleEstimate -> moneyCents.formatCents -> InvoiceCart.moneyLabel
 * re-interpretaba la coma de miles como cero: todo total >= L 1,000.00 se veía
 * como "L 0.00" (rojo medido contra HEAD baa41f97).
 *
 * T-FE-09 retiró `InvoiceCart` (render muerto; el módulo Cobrar tiene sus
 * propios componentes). Esta regresión conserva EXACTAMENTE los mismos casos y
 * garantías, pero apuntada a la ruta VIVA del dinero:
 *   InvoicePreview (centavos enteros del servidor)
 *     -> moneyCents.asCents
 *     -> cobrar/state/status.deriveCobrarStatus
 *     -> SummaryActionZone / AccountZone (MoneyText)
 * Un dato ausente/no confirmado (total o impuesto) sigue viajando como `null`
 * y NUNCA se presenta como "L 0.00".
 *
 * No se modifica para "hacer pasar" el producto: los valores esperados se
 * conservan; solo cambia el componente observado al retirarse el anterior.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicePreview, Service } from '../../lib/api';
import { formatLempirasUIFromCents, parseCents, parseQuantityUnits } from '../moneyCents';
import { AccountZone } from '../../features/cobrar/components/AccountZone';
import { SummaryActionZone } from '../../features/cobrar/components/SummaryActionZone';
import { deriveCobrarStatus } from '../../features/cobrar/state/status';
import type { CobrarLine } from '../../features/cobrar/state/types';

const ZERO = 'L. 0.00';

function serviceFixture(price: string, overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    name: 'Servicio sintético R2',
    slug: 'servicio-sintetico-r2',
    price,
    taxable: false,
    active: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: null,
    ...overrides,
  };
}

function cobrarLine(price: string, quantity = '1'): CobrarLine {
  return { service: serviceFixture(price), quantity, dialysisPrescription: false };
}

function previewFixture(
  totalCents: number | null,
  totals: Partial<InvoicePreview['totals']> = {},
): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '0.00', rate_basis_points: 0, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: totalCents ?? 0,
      taxable_base_cents: 0,
      exempt_cents: totalCents ?? 0,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: totalCents,
      ...totals,
    },
    zero_reason: null,
    items: [],
    emission: {
      persisted: false,
      invoice_created: false,
      fiscal_number_consumed: false,
      payment_created: false,
      institutional_receipt_created: false,
    },
  };
}

/** Valoración con impuesto o total no confirmados (no se pinta como cero). */
function unavailablePreview(status: InvoicePreview['status'] = 'ok'): InvoicePreview {
  const base = previewFixture(10000);

  return {
    ...base,
    status,
    tax: {
      ...base.tax,
      available: status !== 'tax_unavailable',
      rate: null,
      rate_basis_points: null,
      origin: status === 'tax_unavailable' ? 'unavailable' : 'fiscal_settings',
    },
    totals: { ...base.totals, tax_cents: null, total_cents: null },
  };
}

function statusFor(preview: InvoicePreview) {
  return deriveCobrarStatus({
    patientName: 'Paciente Sintético R2',
    lineCount: 1,
    hasCashSession: true,
    cashSessionLoading: false,
    canCreatePayments: true,
    preview,
    previewing: false,
    previewError: null,
    lineIssue: null,
    previewMatchesRevision: true,
    submitting: false,
    result: null,
  });
}

/** Renderiza el total por la MISMA ruta viva: preview -> status -> SummaryActionZone. */
function renderSummary(preview: InvoicePreview) {
  const status = statusFor(preview);
  render(
    <SummaryActionZone
      status={status}
      preview={preview}
      previewMatchesRevision
      submitting={false}
      onConfirm={vi.fn()}
      onRetryPreview={vi.fn()}
      canPreviewDocument
      previewingDocument={false}
      onPreviewDocument={vi.fn()}
    />,
  );

  return status;
}

/**
 * Valor del total por el ancla VIGENTE del SUT (`SummaryActionZone.tsx:73‑84`):
 * el concepto se etiqueta como «Total confirmado» (etiqueta textual) y el
 * importe vive en el `span[data-ui-money]` hermano (`MoneyText`); cuando el
 * servidor no confirma el total, el SUT pinta un span de texto propio
 * («No disponible» / «Calculando…» / «Sin líneas»). Los importes esperados no
 * cambian: solo se re-observa el marcado actual (Dark 2026-10-16, MC-1).
 */
function totalValueZone(): HTMLElement {
  const concept = screen.getByText('Total confirmado');
  const zone = concept.parentElement;

  if (!zone) {
    throw new Error('No se encontró la zona del total en SummaryActionZone.');
  }

  return zone;
}

function totalText(): string {
  const zone = totalValueZone();
  const money = zone.querySelector<HTMLElement>('[data-ui-money]');

  if (money) {
    return money.textContent?.trim() ?? '';
  }

  // Total no confirmado: último hijo de la zona, un span de texto.
  const fallback = zone.children[zone.children.length - 1];

  return fallback?.textContent?.trim() ?? '';
}

function rowTextFor(label: string): string {
  const dt = Array.from(document.querySelectorAll('dt')).find((node) => node.textContent?.trim() === label);
  if (!dt?.parentElement) {
    throw new Error(`No se encontró la fila "${label}" en SummaryActionZone.`);
  }

  return (dt.parentElement.querySelector('dd')?.textContent ?? '').trim();
}

function renderAccount(lines: CobrarLine[]) {
  const preview = previewFixture(0);
  preview.items = lines.map((line) => {
    const unitPrice = parseCents(line.service.price);
    const quantity = parseQuantityUnits(line.quantity);
    const lineTotal = unitPrice === null || quantity === null
      ? null
      : Math.trunc((unitPrice * quantity + 50) / 100);

    return {
      service_id: line.service.id,
      service_name: line.service.name,
      quantity: line.quantity,
      quantity_cents: quantity ?? 0,
      unit_price_cents: unitPrice ?? 0,
      unit_price_registered_cents: unitPrice,
      taxable: false,
      tax_rate: '0.00',
      line_subtotal_cents: lineTotal ?? 0,
      tax_cents: lineTotal === null ? null : 0,
      line_total_cents: lineTotal,
      special_rule_code: null,
      special_rule_applied: false,
      rule_adjustment_cents: 0,
    };
  });

  render(
    <AccountZone
      lines={lines}
      canMarkDialysisPrescription={false}
      hasEligibleMedication={false}
      conditionActive={false}
      preview={preview}
      previewMatchesRevision
      onToggleCondition={vi.fn()}
      onQuantityChange={vi.fn()}
      onRemoveLine={vi.fn()}
    />,
  );
}

function accountRow(name: string): HTMLTableRowElement {
  const table = screen.getByRole('table', { name: /líneas de la cuenta/i });
  const row = within(table).getByText(name).closest('tr');
  if (!row) {
    throw new Error(`No se encontró la fila "${name}" en AccountZone.`);
  }

  return row as HTMLTableRowElement;
}

/** Importe de línea: celda bajo el encabezado «Importe» (robusto al orden). */
function lineAmountText(row: HTMLTableRowElement): string {
  const table = row.closest('table');
  if (!table) {
    throw new Error('La fila no pertenece a una tabla.');
  }

  const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
    (th.textContent ?? '').trim(),
  );
  const index = headers.findIndex((header) => /^importe$/i.test(header));

  if (index < 0) {
    throw new Error('No se encontró la columna "Importe" en la tabla de la cuenta.');
  }

  return row.querySelectorAll('td')[index]?.textContent?.trim() ?? '';
}

function quantityText(row: HTMLTableRowElement): string {
  return (row.querySelector('input') as HTMLInputElement | null)?.value ?? '';
}

describe('R2-MONEY-QA // contrato de importes: centavos -> render (cadena viva)', () => {
  it.each([
    [0, 'L. 0.00'],
    [1, 'L. 0.01'],
    [99999, 'L. 999.99'],
    [100000, 'L. 1,000.00'],
    [102925, 'L. 1,029.25'],
    [104650, 'L. 1,046.50'],
    [1000000, 'L. 10,000.00'],
    [10000, 'L. 100.00'],
  ])('formatea %i centavos como %s', (cents, expected) => {
    expect(formatLempirasUIFromCents(cents)).toBe(expected);
  });

  // Los 6 casos medidos por el coordinador. El valor es el TOTAL en centavos.
  it.each([
    { cents: 0, expected: 'L. 0.00' },
    { cents: 99999, expected: 'L. 999.99' },
    { cents: 100000, expected: 'L. 1,000.00' },
    { cents: 102925, expected: 'L. 1,029.25' },
    { cents: 104650, expected: 'L. 1,046.50' },
    { cents: 170000, expected: 'L. 1,700.00' },
    { cents: 1000000, expected: 'L. 10,000.00' },
  ])('total de $cents centavos se renderiza como "$expected"', ({ cents, expected }) => {
    const preview = previewFixture(cents);
    const status = renderSummary(preview);
    const total = totalText();

    console.log(
      `[R2-MONEY] cents=${cents} status.totalCents=${String(status.totalCents)} rendered=${JSON.stringify(total)}`,
    );

    expect(status.totalCents).toBe(cents);
    expect(total).toBe(expected);
  });

  it('presenta 10000 centavos (L. 100.00) como caso de centavos, no como unidades', () => {
    renderSummary(previewFixture(10000));

    expect(totalText()).toBe('L. 100.00');
  });

  it('no depende de la coma de miles del estado para un total legítimamente cero', () => {
    renderSummary(previewFixture(0));

    expect(totalText()).toBe(ZERO);
    expect(totalText()).toBe(formatLempirasUIFromCents(0));
  });
});

describe('R2-MONEY-QA // cantidades: el total sigue el importe real, no un cero', () => {
  it('cantidad 2 con precio 500.00 muestra L. 1,000.00 en la línea', () => {
    renderAccount([cobrarLine('500.00', '2')]);
    const row = accountRow('Servicio sintético R2');

    expect(quantityText(row)).toBe('2');
    expect(lineAmountText(row)).toBe('L. 1,000.00');
  });

  it('admite cantidad fraccionaria 1.50 y calcula L. 1,500.00 (línea)', () => {
    renderAccount([cobrarLine('1000.00', '1.50')]);
    const row = accountRow('Servicio sintético R2');

    expect(quantityText(row)).toBe('1.50');
    expect(lineAmountText(row)).toBe('L. 1,500.00');
  });
});

describe('R2-MONEY-QA // estados no disponibles: null/ausente nunca es cero legítimo', () => {
  it('un total ausente es "No disponible", no L 0.00, y bloquea la emisión', () => {
    renderSummary(unavailablePreview());

    expect(totalText()).toBe('No disponible');
    expect(totalText()).not.toBe(ZERO);
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();
    expect(document.body.textContent).not.toContain(ZERO);
  });

  it('un impuesto no disponible no se presenta como L 0.00', () => {
    renderSummary(unavailablePreview());

    expect(rowTextFor('ISV')).toBe('No disponible');
    expect(rowTextFor('ISV')).not.toBe(ZERO);
    expect(rowTextFor('ISV').length).toBeGreaterThan(0);
  });

  it('el estado tax_unavailable del servidor no se presenta como L 0.00', () => {
    renderSummary(unavailablePreview('tax_unavailable'));

    expect(totalText()).toBe('No disponible');
    expect(document.body.textContent).not.toContain(ZERO);
  });

  it('un precio de línea ilegible es "No disponible", no L 0.00', () => {
    renderAccount([cobrarLine('monto-danado', '1')]);
    const row = accountRow('Servicio sintético R2');

    expect(lineAmountText(row)).toBe('No disponible');
    expect(lineAmountText(row)).not.toBe(ZERO);
  });
});
