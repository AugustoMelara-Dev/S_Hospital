import { describe, expect, it } from 'vitest';
import { presetRange, rangeDays, validateRange } from './period';

describe('report period presets (Honduras time)', () => {
  // 03:00 UTC on Dec 1 is still Nov 30, 21:00 in Tegucigalpa (UTC-6).
  const now = new Date('2026-12-01T03:00:00Z');

  it('uses the Honduras calendar day, not UTC', () => {
    expect(presetRange('today', now)).toEqual({ date_from: '2026-11-30', date_to: '2026-11-30' });
    expect(presetRange('yesterday', now)).toEqual({ date_from: '2026-11-29', date_to: '2026-11-29' });
  });

  it('computes 7 días inclusive of today', () => {
    expect(presetRange('last7', now)).toEqual({ date_from: '2026-11-24', date_to: '2026-11-30' });
    expect(rangeDays('2026-11-24', '2026-11-30')).toBe(7);
  });

  it('computes Este mes and Mes anterior', () => {
    expect(presetRange('month', now)).toEqual({ date_from: '2026-11-01', date_to: '2026-11-30' });
    expect(presetRange('prev_month', now)).toEqual({ date_from: '2026-10-01', date_to: '2026-10-31' });
  });

  it('wraps Mes anterior across the year boundary', () => {
    const jan = new Date('2026-01-15T12:00:00-06:00');
    expect(presetRange('prev_month', jan)).toEqual({ date_from: '2025-12-01', date_to: '2025-12-31' });
    const mar = new Date('2028-03-02T12:00:00-06:00');
    expect(presetRange('prev_month', mar)).toEqual({ date_from: '2028-02-01', date_to: '2028-02-29' });
  });
});

describe('custom range validation', () => {
  it('accepts up to 92 days inclusive', () => {
    expect(validateRange('2026-08-01', '2026-10-31')).toBeNull(); // 92 days
  });
  it('rejects more than 92 days', () => {
    expect(validateRange('2026-08-01', '2026-11-01')).toBe('El período no puede superar 92 días.');
  });
  it('rejects inverted or missing dates', () => {
    expect(validateRange('2026-11-10', '2026-11-01')).toMatch(/posterior/);
    expect(validateRange('', '2026-11-01')).toBe('Indique las fechas Desde y Hasta.');
  });
});
