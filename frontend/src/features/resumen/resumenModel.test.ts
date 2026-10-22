import { describe, expect, it } from 'vitest';
import type { CashSession, Invoice, TodayReport } from '@/lib/api';
import { formatLempirasUIFromCents } from '@/lib/moneyCents';
import {
  apiMoneyCents,
  buildResumenAttention,
  buildResumenMetrics,
  countZeroTotalInvoices,
  invoiceTotalCents,
  operationDisplay,
  pendingCollectionCohort,
} from './resumenModel';

const today: TodayReport = {
  date: '2026-09-18',
  timezone: 'America/Tegucigalpa',
  server_time: '2026-09-18T15:00:00-06:00',
  cash_session_open: true,
  cash_session_id: 4,
  cash_session_opened_at: '2026-09-18T08:00:00-06:00',
  cash_session_opening_amount: '500.00',
  issued_count: 3,
  without_charge_count: 2,
  collected_count: 2,
  billed: '1500.00',
  collected: '900.00',
  pending: '400.00',
  voided_count: 0,
  voided_amount: '0.00',
  reversal_count: 0,
  pending_invoice_count: 2,
  pending_invoice_amount: '700.00',
  payments_by_method: { cash: '800.00', transfer: '0.00', card: '0.00', other: '0.00' },
  payments_count_by_method: { cash: 2, transfer: 0, card: 0, other: 0 },
  backup_pending: false,
  backup_pending_age_hours: null,
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: 'F-0001',
    patient_name: 'Paciente Demo',
    subtotal: '100.00',
    tax_amount: '0.00',
    discount_amount: '0.00',
    total: '100.00',
    paid_amount: '100.00',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T09:00:00-06:00',
    items: [],
    ...overrides,
  };
}

function session(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 4,
    user_id: 2,
    opening_amount: '500.00',
    closing_amount: null,
    expected_amount: '1300.00',
    expected_cash_amount: '1300.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-18T08:00:00-06:00',
    closed_at: null,
    pending_invoice_count: 1,
    pending_amount: '700.00',
    ...overrides,
  };
}

describe('resumenModel', () => {
  it('keeps the emission, collection and outstanding cohorts separate', () => {
    const metrics = buildResumenMetrics(today);
    const byKey = Object.fromEntries(metrics.map((metric) => [metric.key, metric]));

    expect(byKey.emitido.valueCents).toBe(150000);
    expect(byKey.cobrado.valueCents).toBe(90000);
    expect(byKey.saldo.valueCents).toBe(40000);
    expect(byKey.saldo.context).toMatch(/por cobrar de la emisión/i);
    expect(byKey.emitido.valueCents! - byKey.cobrado.valueCents!).not.toBe(byKey.saldo.valueCents);
    expect(byKey.sinCobro.valueCount).toBe(2);
    // Moneda siempre con dos decimales, como en el resto del producto.
    expect(byKey.sinCobro.context).toMatch(/con total L 0\.00$/);
    expect(byKey.cobrado.detail).toMatch(/emitidas antes/i);
    // El detalle extenso vive bajo demanda; el contexto visible es breve.
    for (const metric of metrics) {
      expect(metric.context.length).toBeLessThanOrEqual(48);
      expect(metric.detail.length).toBeGreaterThan(metric.context.length);
    }
  });

  it('no expone copy de desarrollador en el recorrido habitual', () => {
    const metrics = buildResumenMetrics(today);
    const visible = metrics.map((metric) => `${metric.label} ${metric.context}`).join(' ');

    expect(visible).not.toMatch(/cohorte|snapshot|postead|no es emitido|valorado por el servidor|paginaci/i);
    expect(metrics.every((metric) => metric.tone === 'default')).toBe(true);
  });

  it('marks an absent server count as unavailable instead of zero', () => {
    const metrics = buildResumenMetrics({ ...today, without_charge_count: undefined });
    const sinCobro = metrics.find((metric) => metric.key === 'sinCobro');
    expect(sinCobro?.valueCount).toBeNull();
  });

  it.each([0, 1])('preserves the legitimate server count %s', (withoutChargeCount) => {
    const metrics = buildResumenMetrics({
      ...today,
      without_charge_count: withoutChargeCount,
    });

    expect(metrics.find((metric) => metric.key === 'sinCobro')?.valueCount).toBe(
      withoutChargeCount,
    );
  });

  it('counts only zero-total invoices as operations without charge', () => {
    expect(
      countZeroTotalInvoices([
        invoice({ id: 1, total: '0.00' }),
        invoice({ id: 2, total: '120.00' }),
        invoice({ id: 3, total: '0.00', status: 'paid' }),
      ]),
    ).toBe(2);
  });

  it('labels a paid zero-total invoice as emitted without charge', () => {
    expect(operationDisplay(invoice({ total: '0.00' }))).toEqual({
      label: 'Emitida sin cobro',
      adminStatus: 'gratuito',
    });
    expect(operationDisplay(invoice({ status: 'issued' })).label).toBe('Emitida pendiente');
    expect(operationDisplay(invoice({ status: 'void' })).label).toBe('Anulada');
  });

  describe('frontera de dinero (centavos, nunca cero falso)', () => {
    it('nunca convierte un valor ausente o mal formado en cero', () => {
      expect(apiMoneyCents(null)).toBeNull();
      expect(apiMoneyCents(undefined)).toBeNull();
      expect(apiMoneyCents('')).toBeNull();
      expect(apiMoneyCents('   ')).toBeNull();
      expect(apiMoneyCents('no-es-numero')).toBeNull();
      expect(formatLempirasUIFromCents(apiMoneyCents(null))).toBeNull();
      expect(apiMoneyCents(null)).not.toBe(0);
    });

    it('usa centavos para el total de la operación', () => {
      expect(invoiceTotalCents(invoice({ total: '1234.56' }))).toBe(123456);
      expect(invoiceTotalCents(invoice({ total: '0.00' }))).toBe(0);
      expect(invoiceTotalCents(invoice({ total: '' }))).toBeNull();
      expect(invoiceTotalCents(invoice({ total: 'L 1,234.56' }))).toBeNull();
    });

    it('formatea un importe decimal mayor de mil con separador de miles', () => {
      const cents = apiMoneyCents('1234.56');
      expect(cents).toBe(123456);
      expect(formatLempirasUIFromCents(cents)).toBe('L. 1,234.56');
    });

    it('deja las métricas del corte en null (No disponible) ante decimales mal formados', () => {
      const broken: TodayReport = { ...today, billed: '', collected: 'n/a', pending: '   ' };
      const byKey = Object.fromEntries(buildResumenMetrics(broken).map((metric) => [metric.key, metric]));

      expect(byKey.emitido.valueCents).toBeNull();
      expect(byKey.cobrado.valueCents).toBeNull();
      expect(byKey.saldo.valueCents).toBeNull();
      expect(byKey.emitido.valueCents).not.toBe(0);
    });
  });

  describe('atención ahora', () => {
    it('prefiere la cohorte de la sesión abierta para los pendientes de cobro', () => {
      const cohort = pendingCollectionCohort(today, session({ pending_invoice_count: 3, pending_amount: '250.00' }));

      expect(cohort.count).toBe(3);
      expect(cohort.amountCents).toBe(25000);
      expect(cohort.scope).toMatch(/sesión de caja abierta/i);
    });

    it('cae a la cohorte del período cuando no hay sesión abierta', () => {
      const cohort = pendingCollectionCohort(today, null);

      expect(cohort.count).toBe(today.pending_invoice_count);
      expect(cohort.amountCents).toBe(apiMoneyCents(today.pending_invoice_amount));
      expect(cohort.scope).toMatch(/emisión de/i);
    });

    it('construye pendientes y recibos institucionales con sus accesos', () => {
      const items = buildResumenAttention(
        { ...today, cash_session_open: true },
        session({ missing_institutional_receipt_count: 2 }),
      );
      const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

      expect(items).toHaveLength(2);
      expect(byKey.pendientesCobro.count).toBe(1);
      expect(byKey.pendientesCobro.amountCents).toBe(70000);
      expect(byKey.pendientesCobro.to).toBe('/recibos');
      expect(byKey.recibosInstitucionales.count).toBe(2);
      expect(byKey.recibosInstitucionales.to).toBe('/recibos');
      expect(byKey.caja).toBeUndefined();
    });

    it('una caja abierta durante el turno no es una incidencia', () => {
      const items = buildResumenAttention(
        { ...today, cash_session_open: true, pending_invoice_count: 0, pending_invoice_amount: '0.00' },
        session({
          pending_invoice_count: 0,
          pending_amount: '0.00',
          difference_amount: null,
          missing_institutional_receipt_count: 0,
        }),
      );

      expect(items).toEqual([]);
      expect(items.some((item) => item.key === 'caja')).toBe(false);
    });

    it('marca la caja con diferencia y no inventa importe cuando el dato está ausente', () => {
      const withDifference = buildResumenAttention(
        { ...today, cash_session_open: true, pending_invoice_count: 0, pending_invoice_amount: '0.00' },
        session({ difference_amount: '-15.50', missing_institutional_receipt_count: 0 }),
      );
      expect(withDifference.find((item) => item.key === 'caja')?.amountCents).toBe(-1550);
      expect(withDifference.find((item) => item.key === 'caja')?.label).toMatch(/diferencia/i);

      const broken = buildResumenAttention(
        { ...today, cash_session_open: true, pending_invoice_count: 0, pending_invoice_amount: '0.00' },
        session({ difference_amount: 'no-numero', missing_institutional_receipt_count: 0 }),
      );
      expect(broken.some((item) => item.key === 'caja')).toBe(false);
    });

    it('oculta el bloque cuando no hay nada que atender', () => {
      const items = buildResumenAttention(
        { ...today, cash_session_open: false, pending_invoice_count: 0, pending_invoice_amount: '0.00' },
        session({ status: 'closed', pending_invoice_count: 0, pending_amount: '0.00', missing_institutional_receipt_count: 0 }),
      );

      expect(items).toEqual([]);
    });

    it('no inventa recibos institucionales pendientes cuando el dato está ausente', () => {
      const items = buildResumenAttention(
        { ...today, cash_session_open: true, pending_invoice_count: 0, pending_invoice_amount: '0.00' },
        session({ missing_institutional_receipt_count: undefined }),
      );

      expect(items.some((item) => item.key === 'recibosInstitucionales')).toBe(false);
      expect(items.some((item) => item.key === 'caja')).toBe(false);
      expect(items.some((item) => item.key === 'pendientesCobro')).toBe(true);
    });
  });
});
