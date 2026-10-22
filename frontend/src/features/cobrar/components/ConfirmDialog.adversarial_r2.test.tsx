import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicePreview, Service } from '@/lib/api';
import { asCents } from '@/lib/moneyCents';
import { ERYTHROPOIETIN_RULE } from '../state/domain';
import type { CobrarLine } from '../state/types';
import type { CobrarStatus } from '../state/status';
import { ConfirmDialog } from './ConfirmDialog';

function sampleService(overrides: Partial<Service> = {}): Service {
  return {
    id: 101,
    category_id: 1,
    name: 'Consulta de especialidad',
    slug: 'consulta-especialidad',
    price: '350.00',
    taxable: false,
    active: true,
    special_rule_code: null,
    category: { id: 1, name: 'Consultas', slug: 'consultas', active: true, sort_order: 1 },
    area: null,
    ...overrides,
  };
}

function samplePreview(totalCents: number): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: totalCents,
      taxable_base_cents: totalCents,
      exempt_cents: 0,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: totalCents,
    },
    zero_reason: totalCents === 0 ? 'free_by_rule' : null,
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

function billStatus(totalCents = 35000): CobrarStatus {
  return {
    code: totalCents === 0 ? 'sin_cobro' : 'listo',
    label: totalCents === 0 ? 'Emisión válida sin cobro' : 'Listo para cobrar',
    detail: totalCents === 0 ? 'El total es L 0.00 por la regla aplicada al medicamento elegible.' : null,
    totalCents: asCents(totalCents),
    canConfirm: true,
    confirmKind: totalCents === 0 ? 'zero' : 'pay',
  };
}

type DialogProps = Parameters<typeof ConfirmDialog>[0];

function renderConfirmDialog(props: Partial<DialogProps> = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onMethodChange: vi.fn(),
    onReferenceChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  render(
    <ConfirmDialog
      open
      status={billStatus(35000)}
      patientName="Carlos Alvarado"
      lines={[{ service: sampleService(), quantity: '1', dialysisPrescription: false }]}
      preview={samplePreview(35000)}
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

describe('Challenger M2-2 R2: Adversarial Re-verification of Cashier Flow', () => {
  describe('Mandate Scenario 1: Bill total L. 350.00, customer pays L. 300.00 cash', () => {
    it('underpaid alert displayed, confirm button cobrar-confirm MUST be disabled', async () => {
      const user = userEvent.setup();
      const handlers = renderConfirmDialog();

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '300.00');

      const alert = screen.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent(/el monto recibido es menor que el total a cobrar/i);

      const confirmBtn = screen.getByTestId('cobrar-confirm');
      expect(confirmBtn).toBeDisabled();

      // Attempting to click does NOT trigger onConfirm
      await user.click(confirmBtn);
      expect(handlers.onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Mandate Scenario 2: Bill total L. 350.00, customer types 0.00 cash', () => {
    it('underpaid alert displayed, confirm button cobrar-confirm MUST be disabled', async () => {
      const user = userEvent.setup();
      const handlers = renderConfirmDialog();

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '0.00');

      const alert = screen.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent(/el monto recibido es menor que el total a cobrar/i);

      const confirmBtn = screen.getByTestId('cobrar-confirm');
      expect(confirmBtn).toBeDisabled();

      await user.click(confirmBtn);
      expect(handlers.onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Mandate Scenario 3: Bill total L. 350.00, customer clicks Monto exacto', () => {
    it('exact cash (L. 350.00) entered, change L. 0.00, confirm button enabled', async () => {
      const user = userEvent.setup();
      const handlers = renderConfirmDialog();

      const exactBtn = screen.getByRole('button', { name: /monto exacto/i });
      await user.click(exactBtn);

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      expect(cashInput).toHaveValue('350.00');

      const changeSection = screen.getByText(/cambio a entregar:/i).closest('div');
      expect(within(changeSection!).getByText('L. 0.00')).toBeVisible();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      const confirmBtn = screen.getByTestId('cobrar-confirm');
      expect(confirmBtn).toBeEnabled();

      await user.click(confirmBtn);
      expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mandate Scenario 4: Bill total L. 350.00, customer pays L. 500.00 cash', () => {
    it('change L. 150.00 displayed, confirm button enabled', async () => {
      const user = userEvent.setup();
      const handlers = renderConfirmDialog();

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '500.00');

      const changeSection = screen.getByText(/cambio a entregar:/i).closest('div');
      expect(within(changeSection!).getByText('L. 150.00')).toBeVisible();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      const confirmBtn = screen.getByTestId('cobrar-confirm');
      expect(confirmBtn).toBeEnabled();

      await user.click(confirmBtn);
      expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Adversarial Stress Cases: Boundary Cents & Payment Method Switching', () => {
    it('one cent underpayment (L. 349.99 for L. 350.00) triggers underpaid alert and disables confirm button', async () => {
      const user = userEvent.setup();
      renderConfirmDialog();

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '349.99');

      expect(screen.getByRole('alert')).toBeVisible();
      expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
    });

    it('one cent overpayment (L. 350.01 for L. 350.00) displays change L. 0.01 and enables confirm button', async () => {
      const user = userEvent.setup();
      renderConfirmDialog();

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '350.01');

      const changeSection = screen.getByText(/cambio a entregar:/i).closest('div');
      expect(within(changeSection!).getByText('L. 0.01')).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('cobrar-confirm')).toBeEnabled();
    });

    it('switching to non-cash payment method clears underpaid block', async () => {
      const user = userEvent.setup();
      let currentMethod: 'cash' | 'transfer' | 'card' | 'other' = 'cash';
      const onMethodChange = vi.fn((m) => {
        currentMethod = m;
      });

      const { rerender } = render(
        <ConfirmDialog
          open
          status={billStatus(35000)}
          patientName="Carlos Alvarado"
          lines={[{ service: sampleService(), quantity: '1', dialysisPrescription: false }]}
          preview={samplePreview(35000)}
          previewMatchesRevision
          method={currentMethod}
          onMethodChange={onMethodChange}
          reference=""
          onReferenceChange={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          submitting={false}
        />,
      );

      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '200.00');

      expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
      expect(screen.getByRole('alert')).toBeVisible();

      // Switch to transfer
      const transferRadio = screen.getByRole('radio', { name: 'Transferencia' });
      await user.click(transferRadio);
      expect(onMethodChange).toHaveBeenCalledWith('transfer');

      rerender(
        <ConfirmDialog
          open
          status={billStatus(35000)}
          patientName="Carlos Alvarado"
          lines={[{ service: sampleService(), quantity: '1', dialysisPrescription: false }]}
          preview={samplePreview(35000)}
          previewMatchesRevision
          method="transfer"
          onMethodChange={onMethodChange}
          reference=""
          onReferenceChange={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          submitting={false}
        />,
      );

      // Now underpaid alert is gone and confirm button is enabled
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('cobrar-confirm')).toBeEnabled();
    });
  });

  describe('Mandate Scenario 5: Mixed EPO basket and pure EPO rule handling', () => {
    it('pure EPO basket with dialysis prescription renders zero total emission dialog without payment fields', () => {
      const epoService = sampleService({
        id: 77,
        name: 'Eritropoyetina 4000 UI',
        price: '2500.00',
        special_rule_code: ERYTHROPOIETIN_RULE,
      });

      renderConfirmDialog({
        status: billStatus(0),
        preview: {
          ...samplePreview(0),
          zero_reason: 'all_lines_free_by_rule',
          items: [{
            service_id: 77,
            service_name: 'Eritropoyetina 4000 UI',
            quantity: '2',
            quantity_cents: 200,
            unit_price_cents: 0,
            unit_price_registered_cents: 250000,
            taxable: false,
            tax_rate: '0.00',
            line_subtotal_cents: 0,
            tax_cents: 0,
            line_total_cents: 0,
            special_rule_code: ERYTHROPOIETIN_RULE,
            special_rule_applied: true,
            rule_adjustment_cents: 500000,
          }],
        },
        lines: [
          {
            service: epoService,
            quantity: '2',
            dialysisPrescription: true,
          },
        ],
      });

      const dialog = screen.getByRole('dialog', { name: /confirmar emisión sin cobro/i });
      expect(dialog).toBeVisible();

      // Pure EPO emission shows institutional explanation
      expect(within(dialog).getByText(/no se registrará pago/i)).toBeVisible();
      expect(within(dialog).getByText(/sin cobro por receta de diálisis/i)).toBeVisible();

      // No payment methods or cash inputs
      expect(within(dialog).queryByText(/método de pago/i)).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText(/efectivo recibido/i)).not.toBeInTheDocument();

      // Confirm button says 'Emitir sin cobro' and is enabled
      const confirmBtn = within(dialog).getByTestId('cobrar-confirm');
      expect(confirmBtn).toHaveTextContent('Emitir sin cobro');
      expect(confirmBtn).toBeEnabled();
    });

    it('mixed basket: EPO with prescription is free, other service is charged, dialog shows total to pay', async () => {
      const epoService = sampleService({
        id: 77,
        name: 'Eritropoyetina 4000 UI',
        price: '2500.00',
        special_rule_code: ERYTHROPOIETIN_RULE,
      });
      const labService = sampleService({
        id: 88,
        name: 'Glucosa en suero',
        price: '120.00',
        special_rule_code: null,
      });

      const lines: CobrarLine[] = [
        { service: epoService, quantity: '1', dialysisPrescription: true },
        { service: labService, quantity: '1', dialysisPrescription: false },
      ];

      // Total is only for labService (12000 cents = L. 120.00)
      renderConfirmDialog({
        status: billStatus(12000),
        preview: {
          ...samplePreview(12000),
          items: [
            {
              service_id: 77,
              service_name: 'Eritropoyetina 4000 UI',
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
            {
              service_id: 88,
              service_name: 'Glucosa en suero',
              quantity: '1',
              quantity_cents: 100,
              unit_price_cents: 12000,
              unit_price_registered_cents: 12000,
              taxable: false,
              tax_rate: '0.00',
              line_subtotal_cents: 12000,
              tax_cents: 0,
              line_total_cents: 12000,
              special_rule_code: null,
              special_rule_applied: false,
              rule_adjustment_cents: 0,
            },
          ],
        },
        lines,
      });

      const dialog = screen.getByRole('dialog', { name: /confirmar cobro/i });
      expect(dialog).toBeVisible();

      // Total shown is L. 120.00
      expect(within(dialog).getByText('Total a cobrar').nextElementSibling).toHaveTextContent('L. 120.00');

      // Eligible line shows badge
      expect(within(dialog).getByText(/sin cobro por receta/i)).toBeVisible();

      // Payment options are visible because total > 0
      expect(within(dialog).getByText(/método de pago/i)).toBeVisible();

      // If user enters underpayment of L. 100.00 for L. 120.00 total
      const user = userEvent.setup();
      const cashInput = screen.getByLabelText(/efectivo recibido/i);
      await user.type(cashInput, '100.00');

      expect(screen.getByRole('alert')).toBeVisible();
      expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();

      // If user clicks Monto exacto, input becomes 120.00 and button becomes enabled
      await user.click(screen.getByRole('button', { name: /monto exacto/i }));
      expect(cashInput).toHaveValue('120.00');
      expect(screen.getByTestId('cobrar-confirm')).toBeEnabled();
    });
  });
});
