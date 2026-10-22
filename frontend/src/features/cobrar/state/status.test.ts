import { describe, expect, it } from 'vitest';
import type { InvoicePreview } from '@/lib/api';
import { deriveCobrarStatus, type CobrarStatusInput } from './status';
import type { CobrarResult } from './types';

function preview(overrides: Partial<InvoicePreview> = {}): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: 100000,
      taxable_base_cents: 100000,
      exempt_cents: 0,
      tax_cents: 15000,
      discount_cents: 0,
      total_cents: 115000,
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
    ...overrides,
  };
}

const base: CobrarStatusInput = {
  patientName: '',
  lineCount: 0,
  hasCashSession: true,
  cashSessionLoading: false,
  canCreatePayments: true,
  preview: null,
  previewing: false,
  previewError: null,
  lineIssue: null,
  previewMatchesRevision: false,
  submitting: false,
  result: null,
};

describe('deriveCobrarStatus · estados explícitos y cero legítimo', () => {
  it('borrador sin líneas no ofrece un total', () => {
    const status = deriveCobrarStatus(base);

    expect(status.code).toBe('borrador');
    expect(status.totalCents).toBeNull();
    expect(status.canConfirm).toBe(false);
  });

  it('un error del servidor nunca se representa como L 0.00', () => {
    const status = deriveCobrarStatus({
      ...base,
      lineCount: 1,
      previewError: 'Servidor no disponible.',
    });

    expect(status.code).toBe('servidor_no_disponible');
    expect(status.totalCents).toBeNull();
    expect(status.totalCents).not.toBe(0);
    expect(status.canConfirm).toBe(false);
  });

  it('calculando no muestra un total cero', () => {
    const status = deriveCobrarStatus({ ...base, lineCount: 1, previewing: true });

    expect(status.code).toBe('calculando');
    expect(status.totalCents).toBeNull();
  });

  it('una cantidad inválida es INV con causa y sin cero', () => {
    const status = deriveCobrarStatus({
      ...base,
      lineCount: 1,
      lineIssue: 'La cantidad de "Hemograma" debe ser mayor que cero y con hasta dos decimales.',
    });

    expect(status.code).toBe('invalido');
    expect(status.totalCents).toBeNull();
    expect(status.detail).toMatch(/cantidad/i);
  });

  it('una valoración vieja (no coincide con la revisión) no se confirma', () => {
    const status = deriveCobrarStatus({
      ...base,
      patientName: 'Ana',
      lineCount: 1,
      preview: preview(),
      previewMatchesRevision: false,
    });

    expect(status.code).toBe('calculando');
    expect(status.canConfirm).toBe(false);
  });

  it('listo para cobrar exige importe positivo confirmado y bloquea sin nombre', () => {
    const ready = deriveCobrarStatus({
      ...base,
      patientName: 'Ana',
      lineCount: 1,
      preview: preview(),
      previewMatchesRevision: true,
    });

    expect(ready.code).toBe('listo');
    expect(ready.totalCents).toBe(115000);
    expect(ready.canConfirm).toBe(true);
    expect(ready.confirmKind).toBe('pay');

    const blocked = deriveCobrarStatus({
      ...base,
      patientName: '',
      lineCount: 1,
      preview: preview(),
      previewMatchesRevision: true,
    });

    expect(blocked.code).toBe('invalido');
    expect(blocked.totalCents).toBe(115000);
    expect(blocked.canConfirm).toBe(false);
  });

  it('total 0 confirmado es emisión válida sin cobro', () => {
    const status = deriveCobrarStatus({
      ...base,
      patientName: 'Ana',
      lineCount: 1,
      preview: preview({
        status: 'zero_total',
        tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
        totals: {
          subtotal_cents: 0,
          taxable_base_cents: 0,
          exempt_cents: 0,
          tax_cents: 0,
          discount_cents: 0,
          total_cents: 0,
        },
      }),
      previewMatchesRevision: true,
    });

    expect(status.code).toBe('sin_cobro');
    expect(status.totalCents).toBe(0);
    expect(status.confirmKind).toBe('zero');
  });

  it('permite emitir un cero confirmado aunque el usuario no tenga permiso de pagos', () => {
    const status = deriveCobrarStatus({
      ...base,
      patientName: 'Ana',
      lineCount: 1,
      canCreatePayments: false,
      preview: preview({
        status: 'zero_total',
        zero_reason: 'configured_zero_price',
        totals: {
          subtotal_cents: 0,
          taxable_base_cents: 0,
          exempt_cents: 0,
          tax_cents: 0,
          discount_cents: 0,
          total_cents: 0,
        },
      }),
      previewMatchesRevision: true,
    });

    expect(status.code).toBe('sin_cobro');
    expect(status.canConfirm).toBe(true);
    expect(status.detail).toMatch(/total confirmado/i);
  });

  it('impuesto no disponible bloquea con causa y sin cero', () => {
    const status = deriveCobrarStatus({
      ...base,
      patientName: 'Ana',
      lineCount: 1,
      preview: preview({
        status: 'tax_unavailable',
        tax: { label: 'ISV', available: false, rate: null, rate_basis_points: null, origin: 'unavailable' },
        totals: {
          subtotal_cents: 100000,
          taxable_base_cents: 100000,
          exempt_cents: 0,
          tax_cents: null,
          discount_cents: 0,
          total_cents: null,
        },
      }),
      previewMatchesRevision: true,
    });

    expect(status.code).toBe('invalido');
    expect(status.totalCents).toBeNull();
  });

  it('pendiente de cobro permite reintentar el pago sin duplicar documento', () => {
    const invoice = { total: '115.00', balance_due: '115.00', invoice_number: 'F-1', patient_name: 'Ana' } as CobrarResult['invoice'];
    const result: CobrarResult = {
      invoice,
      outcome: 'pending',
      receipt: null,
      receiptRecovery: null,
      method: null,
      paidAt: null,
    };
    const status = deriveCobrarStatus({ ...base, result });

    expect(status.code).toBe('pendiente_cobro');
    expect(status.canConfirm).toBe(true);
    expect(status.confirmKind).toBe('retry');
  });
});
