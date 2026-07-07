import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('UsersView module architecture', () => {
  it('keeps UsersView as an orchestrator instead of a single mega-component', () => {
    const source = readFileSync(join(moduleDir, 'UsersView.tsx'), 'utf8');
    const lines = source.split(/\r?\n/).length;

    expect(lines).toBeLessThanOrEqual(440);
  });
});
