import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sonner.tsx'), 'utf8');

/**
 * Contrato de identidad del feedback (dark único, IDENTIDAD_DARK_20261016):
 * el toaster del producto es oscuro y no hereda `next-themes` ni un toggle.
 * El render se verifica en `FeedbackProvider.test.tsx`, que captura la prop
 * `theme` real.
 */
describe('Toaster (identidad admin dark única)', () => {
  it('fija el tema dark y no depende de next-themes', () => {
    expect(source).not.toMatch(/from ['"]next-themes['"]/);
    expect(source).toMatch(/theme="dark"/);
    expect(source).toMatch(/var\(--ui-surface\)/);
    expect(source).not.toMatch(/transition(?:-all|:\s*all)/);
  });
});
