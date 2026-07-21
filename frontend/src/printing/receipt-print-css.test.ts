import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('receipt print css boundary', () => {
  it('keeps page geometry out of global styles and preserves all five print profiles', () => {
    const globalCss = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    const printCss = readFileSync(join(process.cwd(), 'src/printing/styles/receipt-print.css'), 'utf8');
    expect(globalCss).not.toContain('@page');
    for (const profile of ['receipt-letter', 'receipt-half-letter', 'receipt-a5', 'receipt-80mm', 'receipt-58mm']) {
      expect(printCss).toContain(`@page ${profile}`);
    }
  });

  it('keeps only the financial summary indivisible from the signature footer', () => {
    const printCss = readFileSync(join(process.cwd(), 'src/printing/styles/receipt-print.css'), 'utf8');

    expect(printCss).toMatch(/\.receipt-summary\s*\{[^}]*break-inside:\s*avoid;[^}]*page-break-inside:\s*avoid;/s);
    expect(printCss).toMatch(/\.receipt-footer\s*\{[^}]*break-inside:\s*avoid;[^}]*page-break-inside:\s*avoid;/s);
    expect(printCss).not.toMatch(/\.receipt-closing-block\s*\{/);
  });

  it('uses explicit primary page geometry and valid driver-sized thermal pages', () => {
    const printCss = readFileSync(join(process.cwd(), 'src/printing/styles/receipt-print.css'), 'utf8');

    expect(pageRule(printCss, 'receipt-letter')).toMatch(/size:\s*letter landscape;/);
    expect(pageRule(printCss, 'receipt-half-letter')).toMatch(/size:\s*8\.5in 5\.5in;/);
    expect(pageRule(printCss, 'receipt-a5')).toMatch(/size:\s*A5 landscape;/);

    for (const [profile, width] of [['receipt-80mm', '80mm'], ['receipt-58mm', '58mm']] as const) {
      expect(pageRule(printCss, profile)).toMatch(/size:\s*auto;/);
      expect(pageRule(printCss, profile)).not.toMatch(/size:\s*\d+(?:\.\d+)?(?:mm|cm|in|pt|pc|px)\s+auto;/i);
      expect(printCss).toMatch(new RegExp(`\\.institutional-receipt\\.${profile}\\s*\\{[^}]*width:\\s*${width};`, 's'));
    }
  });

  it('uses a restrained grayscale-friendly document hierarchy', () => {
    const printCss = readFileSync(join(process.cwd(), 'src/printing/styles/receipt-print.css'), 'utf8');

    expect(printCss).toMatch(/\.receipt-header\s*\{[^}]*border-bottom:\s*2px solid var\(--color-receipt-ink\);/s);
    expect(printCss).toMatch(/\.receipt-items-table th\s*\{[^}]*background:\s*var\(--color-receipt-panel\);/s);
    expect(printCss).toMatch(/\.receipt-totals-table \.strong th,[\s\S]*?border-top:\s*2px solid var\(--color-receipt-ink\);/s);
  });
});

function pageRule(css: string, profile: string): string {
  return css.match(new RegExp(`@page\\s+${profile}\\s*\\{[^}]*}`, 's'))?.[0] ?? '';
}
