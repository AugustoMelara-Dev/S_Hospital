import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicePreview } from '@/lib/api';
import { asCents } from '@/lib/moneyCents';
import { ERYTHROPOIETIN_RULE } from '../state/domain';
import type { CobrarLine } from '../state/types';
import type { CobrarStatus } from '../state/status';
import type { Service } from '@/lib/api';
import { ConfirmDialog } from './ConfirmDialog';

function serviceFixture(overrides: Partial<Service> = {}): Service {
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
    ...overrides,
  };
}

function previewFixture(totalCents: number): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: 1500,
      taxable_base_cents: 1500,
      exempt_cents: 0,
      tax_cents: 225,
      discount_cents: 0,
      total_cents: totalCents,
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

function payStatus(totalCents = 1725): CobrarStatus {
  return {
    code: 'listo',
    label: 'Listo para cobrar',
    detail: null,
    totalCents: asCents(totalCents),
    canConfirm: true,
    confirmKind: 'pay',
  };
}

function zeroStatus(): CobrarStatus {
  return {
    code: 'sin_cobro',
    label: 'Emisión válida sin cobro',
    detail: 'El total es L 0.00 por la regla aplicada al medicamento elegible.',
    totalCents: asCents(0),
    canConfirm: true,
    confirmKind: 'zero',
  };
}

type DialogProps = Parameters<typeof ConfirmDialog>[0];

function renderDialog(props: Partial<DialogProps> = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onMethodChange: vi.fn(),
    onReferenceChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  render(
    <ConfirmDialog
      open
      status={payStatus()}
      patientName="Maria Lopez"
      lines={[{ service: serviceFixture(), quantity: '1', dialysisPrescription: false }]}
      preview={previewFixture(1725)}
      previewMatchesRevision
      method="cash"
      reference=""
      submitting={false}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe('ConfirmDialog · confirmación deliberada', () => {
  it('revisa paciente y total, y cobra solo con el botón de confirmación', async () => {
    const user = userEvent.setup();
    const handlers = renderDialog();

    const dialog = screen.getByRole('dialog', { name: /confirmar cobro/i });

    expect(within(dialog).getByText('Maria Lopez')).toBeVisible();
    // El foco del diálogo es la revisión: paciente y total a cobrar.
    expect(within(dialog).getByText('Total a cobrar').nextElementSibling).toHaveTextContent('L. 17.25');
    expect(within(dialog).getByRole('radio', { name: 'Transferencia' })).toBeVisible();

    await user.click(within(dialog).getByTestId('cobrar-confirm'));

    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Enter en un campo no cobra: la confirmación es explícita', async () => {
    const user = userEvent.setup();
    const handlers = renderDialog();

    await user.type(screen.getByLabelText(/referencia/i), 'TX-QA-001{Enter}');

    expect(handlers.onReferenceChange).toHaveBeenCalled();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });

  it('la emisión sin cobro no ofrece método de pago y lo explica', () => {
    renderDialog({
      status: zeroStatus(),
      preview: {
        ...previewFixture(0),
        zero_reason: 'all_lines_free_by_rule',
        items: [{
          service_id: 42,
          service_name: 'Hemograma completo',
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
        }],
      },
      lines: [
        {
          service: serviceFixture({ special_rule_code: ERYTHROPOIETIN_RULE, price: '2500.00' }),
          quantity: '1',
          dialysisPrescription: true,
        },
      ],
    });

    const dialog = screen.getByRole('dialog', { name: /confirmar emisión sin cobro/i });

    expect(within(dialog).getByText(/no se registrará pago/i)).toBeVisible();
    expect(within(dialog).queryByText(/método de pago/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/sin cobro por receta de diálisis/i)).toBeVisible();
  });

  it('sin confirmación permitida el botón queda bloqueado, no decorativo', () => {
    renderDialog({
      status: { ...payStatus(), canConfirm: false },
    });

    expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
  });

  it('una cuenta larga conserva las acciones y el desglose del servidor', () => {
    const lines: CobrarLine[] = Array.from({ length: 12 }, (_, index) => ({
      service: serviceFixture({ id: index + 1, name: `Concepto ${index + 1}` }),
      quantity: '1',
      dialysisPrescription: false,
    }));

    renderDialog({ lines });

    expect(screen.getByText('Concepto 12')).toBeVisible();
    expect(screen.getByTestId('cobrar-confirm')).toBeVisible();
    expect(screen.getByText('Subtotal')).toBeVisible();
  });

  it('calcula el cambio exacto a entregar cuando se ingresa efectivo recibido', async () => {
    const user = userEvent.setup();
    renderDialog({
      status: payStatus(1725),
      method: 'cash',
    });

    const cashInput = screen.getByLabelText(/efectivo recibido/i);
    expect(cashInput).toBeVisible();

    await user.type(cashInput, '20.00');

    // 20.00 - 17.25 = 2.75 de cambio
    expect(screen.getByText(/cambio a entregar:/i)).toBeVisible();
    expect(screen.getByText('L. 2.75')).toBeVisible();
  });

  it('el botón de monto exacto ajusta el efectivo recibido al total', async () => {
    const user = userEvent.setup();
    renderDialog({
      status: payStatus(1725),
      method: 'cash',
    });

    await user.click(screen.getByRole('button', { name: /monto exacto/i }));

    const cashInput = screen.getByLabelText(/efectivo recibido/i);
    expect(cashInput).toHaveValue('17.25');

    const changeSection = screen.getByText(/cambio a entregar:/i).closest('div');
    expect(within(changeSection!).getByText('L. 0.00')).toBeVisible();
  });

  it('no hereda el efectivo recibido cuando comienza otra operación', async () => {
    const user = userEvent.setup();
    const props: DialogProps = {
      open: true,
      status: payStatus(),
      patientName: 'Maria Lopez',
      lines: [{ service: serviceFixture(), quantity: '1', dialysisPrescription: false }],
      preview: previewFixture(1725),
      previewMatchesRevision: true,
      method: 'cash',
      reference: '',
      submitting: false,
      onOpenChange: vi.fn(),
      onMethodChange: vi.fn(),
      onReferenceChange: vi.fn(),
      onConfirm: vi.fn(),
    };
    const view = render(<ConfirmDialog key="operation-1" {...props} />);

    await user.type(screen.getByLabelText(/efectivo recibido/i), '50.00');
    expect(screen.getByLabelText(/efectivo recibido/i)).toHaveValue('50.00');

    view.rerender(<ConfirmDialog key="operation-2" {...props} patientName="Otra persona" />);

    expect(screen.getByLabelText(/efectivo recibido/i)).toHaveValue('');
  });


  it('advierte cuando el efectivo recibido es menor que el total a cobrar', async () => {
    const user = userEvent.setup();
    renderDialog({
      status: payStatus(1725),
      method: 'cash',
    });

    const cashInput = screen.getByLabelText(/efectivo recibido/i);
    await user.type(cashInput, '10.00');

    expect(screen.getByText(/el monto recibido es menor que el total a cobrar/i)).toBeVisible();
    expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
  });

  it('deshabilita el botón de confirmar y advierte cuando se ingresa 0.00 de efectivo para un total positivo', async () => {
    const user = userEvent.setup();
    renderDialog({
      status: payStatus(1725),
      method: 'cash',
    });

    const cashInput = screen.getByLabelText(/efectivo recibido/i);
    await user.type(cashInput, '0.00');

    expect(screen.getByText(/el monto recibido es menor que el total a cobrar/i)).toBeVisible();
    expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
  });
});

