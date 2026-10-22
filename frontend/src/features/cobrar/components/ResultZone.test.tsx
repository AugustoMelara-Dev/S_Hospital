import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InstitutionalReceipt, Invoice } from '@/lib/api';
import type { CobrarResult } from '../state/types';
import { ResultZone } from './ResultZone';

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 501,
    invoice_number: 'A-0001',
    patient_name: 'Maria Lopez',
    subtotal: '15.00',
    tax_amount: '2.25',
    discount_amount: '0.00',
    total: '17.25',
    paid_amount: '17.25',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T09:45:00-06:00',
    items: [],
    ...overrides,
  };
}

function receiptFixture(): InstitutionalReceipt {
  return {
    id: 700,
    invoice_id: 501,
    payment_id: 900,
    cash_session_id: 7,
    series_id: 1,
    receipt_number: 70,
    receipt_number_full: 'REC-00000070',
    status: 'issued',
    amount: '17.25',
    amount_cents: 1725,
    issued_at: '2026-09-18T09:45:00-06:00',
    issued_by: 1,
    payer_name: 'Maria Lopez',
    concept: 'Servicios de laboratorio',
    amount_words: 'Diecisiete lempiras con veinticinco centavos',
    template_code: 'institutional_classic',
    print_profile_code: 'carta_vertical',
    copy_mode: 'original_only',
    reprint_count: 0,
    voided_by: null,
    voided_at: null,
    void_reason: null,
  };
}

function resultFixture(overrides: Partial<CobrarResult> = {}): CobrarResult {
  return {
    invoice: invoiceFixture(),
    outcome: 'paid',
    receipt: receiptFixture(),
    receiptRecovery: null,
    method: 'cash',
    paidAt: '2026-09-18T09:45:00-06:00',
    ...overrides,
  };
}

type ResultProps = Parameters<typeof ResultZone>[0];

function renderResult(props: Partial<ResultProps> = {}) {
  const handlers = {
    onNewOperation: vi.fn(),
    onPrint: vi.fn(),
    onSavePdf: vi.fn(),
  };

  render(
    <ResultZone result={resultFixture()} printing={false} saving={false} {...handlers} {...props} />,
  );

  return handlers;
}

describe('ResultZone · resultado distinguible', () => {
  it('el cobro muestra documento, paciente y total con la acción de comprobante', async () => {
    const user = userEvent.setup();
    const handlers = renderResult();

    expect(screen.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
    expect(screen.getByText('A-0001')).toBeVisible();
    expect(screen.getByText('Maria Lopez')).toBeVisible();
    expect(screen.getByText('L. 17.25')).toBeVisible();
    expect(screen.getByText('Efectivo')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /^imprimir$/i }));
    expect(handlers.onPrint).toHaveBeenCalledTimes(1);
  });

  it('la emisión sin cobro se distingue del cobro y no ofrece método de pago', () => {
    renderResult({
      result: resultFixture({
        outcome: 'sin_cobro',
        method: null,
        receipt: null,
        invoice: invoiceFixture({ total: '0.00', paid_amount: '0.00', status: 'issued' }),
      }),
    });

    expect(screen.getByRole('heading', { name: /operación emitida sin cobro/i })).toBeVisible();
    expect(screen.getByText(/total sin cobro/i)).toBeVisible();
    expect(screen.queryByText(/^método$/i)).not.toBeInTheDocument();
  });

  it('sin comprobante emitido las acciones de documento quedan bloqueadas, no decorativas', () => {
    renderResult({ result: resultFixture({ receipt: null }) });

    expect(screen.getByRole('button', { name: /^imprimir$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar pdf/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /nueva operación/i })).toBeEnabled();
  });

  it('explica el comprobante pendiente sin ocultar que la operación quedó registrada', () => {
    renderResult({
      result: resultFixture({ receipt: null, receiptRecovery: 'El comprobante no se pudo emitir; reimprímalo.' }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/comprobante pendiente/i);
    expect(screen.getByText(/reimprímalo/i)).toBeVisible();
  });

  it('reinicia el recorrido con Nueva operación sin heredar datos', async () => {
    const user = userEvent.setup();
    const handlers = renderResult();

    await user.click(within(screen.getByRole('region', { name: /operación cobrada/i })).getByRole('button', { name: /nueva operación/i }));

    expect(handlers.onNewOperation).toHaveBeenCalledTimes(1);
  });
});
