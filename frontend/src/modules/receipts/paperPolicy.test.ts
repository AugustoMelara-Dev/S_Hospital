import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAPER_CHOICES,
  THERMAL_COMPATIBILITY_CHOICES,
  institutionalPaperFromProfile,
  isThermalPaper,
  normalizeInstitutionalPaper,
  paperChoiceFor,
  paperPresentation,
  paperProfileCode,
  receiptPaperPresentation,
  type InstitutionalPaper,
} from './paperPolicy';

describe('institutional receipt paper policy', () => {
  it('defines each API-backed institutional paper exactly once', () => {
    const expected: InstitutionalPaper[] = ['letter', 'half_letter', 'a5', 'custom'];

    expect(PAPER_CHOICES.map(({ value }) => value)).toEqual(expected);
    expect(new Set(PAPER_CHOICES.map(({ value }) => value)).size).toBe(expected.length);
    expect(PAPER_CHOICES.every(({ group }) => group === 'institutional')).toBe(true);
  });

  it('keeps thermal formats as secondary compatibility information', () => {
    expect(THERMAL_COMPATIBILITY_CHOICES.map(({ value }) => value)).toEqual(['80mm', '58mm']);
    expect(THERMAL_COMPATIBILITY_CHOICES.every(({ group }) => group === 'compatibility')).toBe(true);
  });

  it('normalizes malformed and historical thermal settings to the safe institutional default', () => {
    expect(normalizeInstitutionalPaper('half_letter')).toBe('half_letter');
    expect(normalizeInstitutionalPaper('80mm')).toBe('half_letter');
    expect(normalizeInstitutionalPaper('58mm')).toBe('half_letter');
    expect(normalizeInstitutionalPaper('ticket-roll')).toBe('half_letter');
  });

  it('derives preview proportions and existing print classes from the policy', () => {
    expect(paperPresentation('letter')).toEqual({
      previewClass: 'receipt-paper-preview--letter',
      printClass: 'receipt-letter',
    });
    expect(paperPresentation('half_letter').printClass).toBe('receipt-half-letter');
    expect(paperChoiceFor('a5').aspectRatio).toBe('210 / 148');
  });

  it('aligns Carta preview and print CSS with the horizontal backend profile', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/printing/styles/receipt-print.css'),
      'utf8',
    );

    expect(paperChoiceFor('letter').aspectRatio).toBe('11 / 8.5');
    expect(styles).toMatch(
      /\.institutional-receipt\.receipt-letter\s*\{[^}]*width:\s*min\(10\.1in,\s*100%\);[^}]*min-height:\s*7\.6in;/s,
    );
    expect(styles).toMatch(
      /\.institutional-receipt\.receipt-letter\s*\{[^}]*page:\s*receipt-letter;[^}]*width:\s*10\.1in;[^}]*min-height:\s*7\.6in;/s,
    );
    expect(styles).toMatch(/@page receipt-letter\s*\{[^}]*size:\s*letter landscape;[^}]*margin:\s*0\.45in;/s);
  });

  it('provides the print class for every API receipt paper from one helper', () => {
    expect(receiptPaperPresentation('letter').printClass).toBe('receipt-letter');
    expect(receiptPaperPresentation('half_letter').printClass).toBe('receipt-half-letter');
    expect(receiptPaperPresentation('a5').printClass).toBe('receipt-a5');
    expect(receiptPaperPresentation('80mm').printClass).toBe('receipt-80mm');
    expect(receiptPaperPresentation('58mm').printClass).toBe('receipt-58mm');
    expect(receiptPaperPresentation('custom').printClass).toBe('receipt-custom');
  });

  it('maps only institutional paper to backend default profile codes', () => {
    expect(paperProfileCode('letter')).toBe('carta_horizontal');
    expect(paperProfileCode('half_letter')).toBe('media_carta_horizontal');
    expect(paperProfileCode('a5')).toBe('a5_horizontal');
    expect(paperProfileCode('custom')).toBe('recibo_pequeno_personalizado');
    expect(institutionalPaperFromProfile({ code: 'carta_horizontal' })).toBe('letter');
    expect(institutionalPaperFromProfile({ code: 'recibo_pequeno_personalizado' })).toBe('custom');
    expect(institutionalPaperFromProfile({ code: 'thermal_80mm' })).toBe('half_letter');
    expect(institutionalPaperFromProfile(null)).toBe('half_letter');
  });

  it('identifies thermal compatibility formats without treating standard paper as thermal', () => {
    expect(isThermalPaper('80mm')).toBe(true);
    expect(isThermalPaper('58mm')).toBe(true);
    expect(isThermalPaper('letter')).toBe(false);
  });
});
