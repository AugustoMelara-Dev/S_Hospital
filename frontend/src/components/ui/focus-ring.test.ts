import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDir = dirname(fileURLToPath(import.meta.url));

/**
 * Contrato TOKENS_V2 §7 / WCAG 1.4.11: el indicador de foco debe medir >=3:1
 * contra la superficie adyacente. `ring-ring/50` compone 2.15:1 sobre blanco,
 * así que ningún control shadcn puede volver a usarlo.
 */
describe('focus ring contrast contract', () => {
  const files = readdirSync(uiDir).filter((file) => file.endsWith('.tsx'));

  it('never composes the focus ring at 50% alpha', () => {
    for (const file of files) {
      const source = readFileSync(join(uiDir, file), 'utf8');
      expect(source, `${file} usa ring-ring/50 (2.15:1)`).not.toContain('ring-ring/50');
    }
  });

  it('keeps a visible focus-visible substitute on the Radix tab panel', () => {
    const tabs = readFileSync(join(uiDir, 'tabs.tsx'), 'utf8');
    expect(tabs).toContain('focus-visible:ring-3 focus-visible:ring-ring');
  });
});
