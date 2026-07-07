import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('BackupsView module architecture', () => {
  it('keeps backup operations separate from presentation and support-status formatting', () => {
    const source = readFileSync(join(moduleDir, 'BackupsView.tsx'), 'utf8');
    const lines = source.split(/\r?\n/).length;

    expect(lines).toBeLessThanOrEqual(620);
  });
});
