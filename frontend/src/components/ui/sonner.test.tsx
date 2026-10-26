import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sonner.tsx'), 'utf8');

/** El feedback conserva la identidad clara y los tokens compartidos. */
describe('Toaster (identidad admin clara)', () => {
  it('fija el tema claro y no depende de next-themes', () => {
    expect(source).not.toMatch(/from ['"]next-themes['"]/);
    expect(source).toMatch(/theme="light"/);
    expect(source).toMatch(/var\(--ui-surface\)/);
    expect(source).not.toMatch(/transition(?:-all|:\s*all)/);
  });
});
