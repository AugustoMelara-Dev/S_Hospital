import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('clinical design tokens', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'clinical-tokens.css'), 'utf8');

  it.each(['--color-clinical', '--color-attention', '--color-surface', '--font-sans'])('%s está definido', (token) => {
    expect(css).toContain(token);
  });

  it('incluye un tema oscuro con los mismos roles semánticos', () => {
    expect(css).toMatch(/html\.dark[\s\S]+--color-clinical/);
  });
});
