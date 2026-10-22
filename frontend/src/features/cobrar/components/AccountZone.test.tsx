import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicePreview, Service } from '@/lib/api';
import { parseCents, parseQuantityUnits } from '@/lib/moneyCents';
import {
  ERYTHROPOIETIN_RULE,
  removeLine,
  toggleCondition,
  updateLineQuantity,
} from '../state/domain';
import type { CobrarLine } from '../state/types';
import { AccountZone } from './AccountZone';

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    name: 'Hemograma completo',
    slug: 'hemograma-completo',
    price: '100.00',
    taxable: false,
    active: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: null,
    ...overrides,
  };
}

function line(overrides: Partial<CobrarLine> = {}): CobrarLine {
  return { service: serviceFixture(), quantity: '1', dialysisPrescription: false, ...overrides };
}

function erythropoietinLine(): CobrarLine {
  return line({
    service: serviceFixture({
      id: 33,
      name: 'Eritropoyetina',
      price: '2500.00',
      special_rule_code: ERYTHROPOIETIN_RULE,
    }),
    dialysisPrescription: true,
  });
}

function previewFor(lines: CobrarLine[]): InvoicePreview {
  const items = lines.map((current) => {
    const unitPrice = parseCents(current.service.price) ?? 0;
    const quantity = parseQuantityUnits(current.quantity);
    const applies = current.dialysisPrescription && current.service.special_rule_code === ERYTHROPOIETIN_RULE;
    const registeredSubtotal = quantity === null ? null : Math.trunc((unitPrice * quantity + 50) / 100);
    const lineTotal = registeredSubtotal === null ? null : applies ? 0 : registeredSubtotal;

    return {
      service_id: current.service.id,
      service_name: current.service.name,
      quantity: current.quantity,
      quantity_cents: quantity ?? 0,
      unit_price_cents: applies ? 0 : unitPrice,
      unit_price_registered_cents: unitPrice,
      taxable: current.service.taxable,
      tax_rate: '0.00',
      line_subtotal_cents: lineTotal ?? 0,
      tax_cents: lineTotal === null ? null : 0,
      line_total_cents: lineTotal,
      special_rule_code: current.service.special_rule_code,
      special_rule_applied: applies,
      rule_adjustment_cents: applies ? registeredSubtotal : 0,
    };
  });
  const total = items.reduce<number | null>(
    (sum, item) => sum === null || item.line_total_cents === null ? null : sum + item.line_total_cents,
    0,
  );

  return {
    status: total === 0 && lines.length > 0 ? 'zero_total' : 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '0.00', rate_basis_points: 0, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: total ?? 0,
      taxable_base_cents: 0,
      exempt_cents: total ?? 0,
      tax_cents: total === null ? null : 0,
      discount_cents: 0,
      total_cents: total,
    },
    zero_reason: total === 0 && lines.length > 0 ? 'all_lines_free_by_rule' : null,
    items,
    emission: {
      persisted: false,
      invoice_created: false,
      fiscal_number_consumed: false,
      payment_created: false,
      institutional_receipt_created: false,
    },
  };
}

type AccountProps = Parameters<typeof AccountZone>[0];

/** Montaje de sólo lectura: las líneas no cambian y los manejadores se observan. */
function renderAccount(props: Partial<AccountProps> = {}) {
  const handlers = {
    onToggleCondition: vi.fn(),
    onQuantityChange: vi.fn(),
    onRemoveLine: vi.fn(),
  };

  const lines = props.lines ?? [];

  render(
    <AccountZone
      lines={lines}
      canMarkDialysisPrescription={false}
      hasEligibleMedication={false}
      conditionActive={false}
      preview={previewFor(lines)}
      previewMatchesRevision
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

/**
 * Montaje con el estado real de la cuenta (`domain`): permite comprobar la
 * anatomía de la fila mientras el cajero edita, como en la estación real.
 */
function renderLiveAccount(initialLines: CobrarLine[], props: Partial<AccountProps> = {}) {
  function Harness() {
    const [lines, setLines] = useState(initialLines);
    const conditionActive = lines.some((current) => current.dialysisPrescription === true);

    return (
      <AccountZone
        lines={lines}
        canMarkDialysisPrescription={false}
        hasEligibleMedication={false}
        conditionActive={conditionActive}
        preview={previewFor(lines)}
        previewMatchesRevision
        onToggleCondition={(checked) => setLines((current) => toggleCondition(current, checked))}
        onQuantityChange={(index, quantity) =>
          setLines((current) => updateLineQuantity(current, index, quantity))
        }
        onRemoveLine={(index) => setLines((current) => removeLine(current, index))}
        {...props}
      />
    );
  }

  render(<Harness />);
}

function table() {
  return screen.getByRole('table', { name: /líneas de la cuenta/i });
}

function rowFor(name: string): HTMLTableRowElement {
  const row = within(table()).getByText(name).closest('tr');

  if (!row) throw new Error(`No se encontró la fila "${name}".`);

  return row as HTMLTableRowElement;
}

/** Celda bajo el encabezado indicado: robusto al orden de columnas. */
function cellFor(row: HTMLTableRowElement, header: string): HTMLElement {
  const headers = Array.from(table().querySelectorAll('thead th')).map((th) =>
    (th.textContent ?? '').trim(),
  );
  const index = headers.findIndex((value) => new RegExp(`^${header}$`, 'i').test(value));

  if (index < 0) throw new Error(`No se encontró la columna "${header}".`);

  const cell = row.querySelectorAll('td')[index];

  if (!cell) throw new Error(`La fila no tiene celda para "${header}".`);

  return cell as HTMLElement;
}

describe('AccountZone · anatomía de fila', () => {
  it('mantiene concepto, precio unitario, cantidad, importe y quitar en la misma fila', () => {
    renderAccount({ lines: [line()] });

    const row = rowFor('Hemograma completo');

    expect(within(row).getByLabelText(/^cantidad de hemograma completo$/i)).toHaveValue('1');
    expect(
      within(row).getByRole('button', { name: /disminuir cantidad de hemograma completo/i }),
    ).toBeVisible();
    expect(
      within(row).getByRole('button', { name: /aumentar cantidad de hemograma completo/i }),
    ).toBeVisible();
    expect(within(row).getByRole('button', { name: /quitar hemograma completo/i })).toBeVisible();
    expect(cellFor(row, 'Importe')).toHaveTextContent('L. 100.00');
  });

  it('el control de cantidad es un solo bloque: cada botón ajusta y el importe sigue al valor', async () => {
    const user = userEvent.setup();
    renderLiveAccount([line()]);

    await user.click(screen.getByRole('button', { name: /aumentar cantidad de hemograma completo/i }));

    expect(screen.getByLabelText(/^cantidad de hemograma completo$/i)).toHaveValue('2');
    expect(cellFor(rowFor('Hemograma completo'), 'Importe')).toHaveTextContent('L. 200.00');

    await user.click(screen.getByRole('button', { name: /disminuir cantidad de hemograma completo/i }));
    expect(cellFor(rowFor('Hemograma completo'), 'Importe')).toHaveTextContent('L. 100.00');
  });

  it('al disminuir una cantidad menor que uno llega al mínimo 0.01 sin aumentarla', async () => {
    const user = userEvent.setup();
    renderLiveAccount([line({ quantity: '0.50' })]);

    const quantity = screen.getByLabelText(/^cantidad de hemograma completo$/i);
    await user.click(screen.getByRole('button', { name: /disminuir cantidad de hemograma completo/i }));

    expect(quantity).toHaveValue('0.01');

    await user.click(screen.getByRole('button', { name: /disminuir cantidad de hemograma completo/i }));
    expect(quantity).toHaveValue('0.01');
  });

  it('mantiene cantidades mayores de mil e importes con agrupación legible', () => {
    renderLiveAccount([line({ quantity: '1001' })]);

    expect(screen.getByLabelText(/^cantidad de hemograma completo$/i)).toHaveValue('1001');
    expect(cellFor(rowFor('Hemograma completo'), 'Importe')).toHaveTextContent('L. 100,100.00');
  });

  it('quitar elimina la línea de la cuenta', async () => {
    const user = userEvent.setup();
    renderLiveAccount([line()]);

    await user.click(screen.getByRole('button', { name: /quitar hemograma completo/i }));

    expect(screen.queryByRole('table', { name: /líneas de la cuenta/i })).not.toBeInTheDocument();
    expect(screen.getByText(/la cuenta está vacía/i)).toBeVisible();
  });

  it('una cantidad inválida explica el error en la fila y no inventa un importe', async () => {
    const user = userEvent.setup();
    renderLiveAccount([line()]);

    const quantity = screen.getByLabelText(/^cantidad de hemograma completo$/i);
    await user.clear(quantity);
    await user.type(quantity, '0');

    const error = await screen.findByText(/cantidad inválida/i);
    expect(error).toBeVisible();
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(quantity).toHaveAttribute('aria-describedby', error.id);
    expect(cellFor(rowFor('Hemograma completo'), 'Importe')).toHaveTextContent('No disponible');
    expect(screen.queryByText('L. 0.00')).not.toBeInTheDocument();
  });

  it('la línea gratuita conserva su importe L 0.00 y su causa, sin borrarse', () => {
    renderAccount({
      lines: [
        erythropoietinLine(),
        line({ service: serviceFixture({ id: 11, name: 'Glucosa basal', price: '15.00', taxable: true }) }),
      ],
    });

    const freeRow = rowFor('Eritropoyetina');
    expect(cellFor(freeRow, 'Importe')).toHaveTextContent('L. 0.00');
    expect(within(freeRow).getByText(/sin cobro por receta/i)).toBeVisible();

    // El resto de la cuenta sigue cobrándose.
    expect(cellFor(rowFor('Glucosa basal'), 'Importe')).toHaveTextContent('L. 15.00');
  });

  it('la condición de diálisis solo aparece con medicamento elegible y permiso', async () => {
    const user = userEvent.setup();
    const handlers = renderAccount({
      lines: [erythropoietinLine()],
      canMarkDialysisPrescription: true,
      hasEligibleMedication: true,
      conditionActive: true,
    });

    const condition = screen.getByRole('checkbox', { name: /paciente con receta de diálisis/i });
    expect(condition).toBeChecked();

    await user.click(condition);
    expect(handlers.onToggleCondition).toHaveBeenCalledWith(false);
  });

  it('sin medicamento elegible no ofrece la condición y lo advierte si quedó activa', () => {
    renderAccount({
      lines: [line()],
      canMarkDialysisPrescription: true,
      hasEligibleMedication: false,
      conditionActive: true,
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/condición sin medicamento elegible/i)).toBeVisible();
  });

  it('la cuenta vacía se explica sin dibujar una tabla sin filas', () => {
    renderAccount();

    expect(screen.getByText(/la cuenta está vacía/i)).toBeVisible();
    expect(screen.queryByRole('table', { name: /líneas de la cuenta/i })).not.toBeInTheDocument();
  });

  it('muestra columnas contables dedicadas para Precio unitario y Ajuste en la tabla continua', () => {
    renderAccount({
      lines: [
        erythropoietinLine(),
        line({ service: serviceFixture({ id: 11, name: 'Glucosa basal', price: '15.00' }) }),
      ],
    });

    const epoRow = rowFor('Eritropoyetina');
    expect(cellFor(epoRow, 'Precio unitario')).toHaveTextContent('L. 2,500.00');
    expect(cellFor(epoRow, 'Ajuste')).toHaveTextContent('Sin cobro');

    const glucoseRow = rowFor('Glucosa basal');
    expect(cellFor(glucoseRow, 'Precio unitario')).toHaveTextContent('L. 15.00');
    expect(cellFor(glucoseRow, 'Ajuste')).toHaveTextContent('—');
  });
});

