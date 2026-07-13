import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('institutional CSS tokens', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'institutional-tokens.css'), 'utf8');

  it('does not map semantic color custom properties to themselves', () => {
    expect(css).not.toMatch(/(--color-[\w-]+):\s*var\(\1\)/);
  });

  it('keeps radii and decorative shadows flat', () => {
    expect(css).toMatch(/--radius-card:\s*0px/);
    expect(css).toMatch(/--shadow-command:\s*none/);
  });
});
