import { describe, expect, it } from 'vitest';
import { STRINGS } from './es-HN';
import { t } from './index';

describe('es-HN dictionary', () => {
  it('exposes the expected app identity', () => {
    expect(STRINGS.app.name).toBe('Sistema de Caja Hospitalaria');
  });

  it('exposes every top-level navigation label', () => {
    for (const key of ['dashboard', 'billing', 'cashbox', 'catalog', 'invoices', 'reports', 'backups', 'users', 'settings', 'help'] as const) {
      expect(STRINGS.nav[key], `Missing nav.${String(key)}`).toBeTruthy();
    }
  });

  it('builds POS messages with the provided invoice number', () => {
    expect(STRINGS.pos.issued('000-001-01-00000001')).toContain('000-001-01-00000001');
    expect(STRINGS.pos.issued('000-001-01-00000001')).toMatch(/^Factura emitida /);
  });

  it('builds cashbox pending message with count and amount', () => {
    expect(STRINGS.cashbox.pendingInvoices(3, '150.00')).toBe(
      'No se puede cerrar la caja con 3 factura(s) pendientes o parciales por L. 150.00. Revise los cobros antes de cerrar.',
    );
  });

  it('returns the dictionary from t()', () => {
    expect(t()).toBe(STRINGS);
  });

  it('resolves a known dotted path through t(key)', () => {
    expect(t('invoicePayment.title')).toBe('Registrar pago');
    expect(t('invoicePayment.methodCash')).toBe('Efectivo');
    expect(t('cash.title')).toBe('Caja');
    expect(t('catalog.title')).toBe('Catálogo de servicios');
  });

  it('falls back to the key itself for missing entries', () => {
    expect(t('invoicePayment.does.not.exist')).toBe('invoicePayment.does.not.exist');
    expect(t('totally.missing')).toBe('totally.missing');
  });

  it('falls back to the key for function-shaped values (call through STRINGS directly)', () => {
    expect(t('pos.issued')).toBe('pos.issued');
  });
});
