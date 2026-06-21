import { describe, expect, it } from 'vitest';
import { STRINGS } from './es-HN';
import { formatLempirasUI } from '../money';
import { formatDate, formatDateTime } from '../format/formatDate';

describe('i18n surface for the cashier workflow', () => {
  it('renders the hospital tagline in Spanish', () => {
    expect(STRINGS.app.tagline).toMatch(/hospital/i);
  });

  it('covers every step the cashier reaches', () => {
    const screens = ['login', 'pos', 'cashbox', 'invoices'];
    for (const screen of screens) {
      expect(STRINGS, `Missing screen.${screen}`).toHaveProperty(screen);
    }
  });

  it('exposes all error message types that the apiClient can return', () => {
    const errors = STRINGS.errors;
    for (const key of ['serverUnavailable', 'serverError', 'conflict', 'locked'] as const) {
      expect(errors[key]).toBeTruthy();
    }
  });

  it('formats lempiras and dates the way the cashier expects', () => {
    expect(formatLempirasUI(1500.5)).toBe('L 1,500.50');
    expect(formatDate('2026-06-02T12:00:00Z')).toBe('02/06/2026');
    expect(formatDateTime('2026-06-02T08:30:00Z')).toMatch(/^02\/06\/2026 \d{2}:\d{2}$/);
  });

  it('formats POS status messages that the cashier copy expects', () => {
    expect(STRINGS.pos.issued('000-001-01-00000012')).toBe('Factura emitida 000-001-01-00000012.');
    expect(STRINGS.pos.paymentRegisteredPrint('000-001-01-00000012')).toContain('Pago registrado');
    expect(STRINGS.pos.paymentRegisteredPrint('000-001-01-00000012')).toContain('000-001-01-00000012');
  });
});
