import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDateTimeEs,
  formatMonthYear,
  formatTime,
} from './formatDate';

describe('formatDate', () => {
  it('renders an ISO string as DD/MM/YYYY when the time component is midday UTC', () => {
    expect(formatDate('2026-06-02T12:00:00Z')).toBe('02/06/2026');
  });

  it('returns a dash for null, undefined and malformed input', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('renders the long Spanish form for the date', () => {
    expect(formatDateLong('2026-06-02T12:00:00Z')).toBe('2 de junio de 2026');
  });

  it('renders time in HH:mm form', () => {
    expect(formatTime('2026-06-02T08:30:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('combines date and time when needed', () => {
    expect(formatDateTime('2026-06-02T12:00:00Z')).toMatch(/^02\/06\/2026 \d{2}:\d{2}$/);
  });

  it('uses the Spanish short month for the month/year header', () => {
    expect(formatMonthYear('2026-06-02T12:00:00Z')).toBe('jun 2026');
  });
});

describe('formatDateTimeEs', () => {
  it('renders DD/MM/YYYY HH:mm a. m. for the cashier UI', () => {
    const value = '2026-06-16T08:35:00';
    const result = formatDateTimeEs(value);

    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (a|p)\. m\.$/);
    expect(result.endsWith('a. m.') || result.endsWith('p. m.')).toBe(true);
  });

  it('returns a dash for malformed input', () => {
    expect(formatDateTimeEs(null)).toBe('-');
    expect(formatDateTimeEs(undefined)).toBe('-');
    expect(formatDateTimeEs('not-a-date')).toBe('-');
  });
});
