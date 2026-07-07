import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('NewInvoiceView module architecture', () => {
  it('keeps the invoice screen from absorbing keyboard orchestration and receipt/payment internals', () => {
    const source = readFileSync(join(moduleDir, 'NewInvoiceView.tsx'), 'utf8');
    const lines = source.split(/\r?\n/).length;

    expect(lines).toBeLessThanOrEqual(720);
  });
});
