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
});
