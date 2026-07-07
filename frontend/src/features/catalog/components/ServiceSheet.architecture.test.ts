import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('ServiceSheet module architecture', () => {
  it('keeps the service sheet as an orchestrator instead of a full form monolith', () => {
    const source = readFileSync(join(moduleDir, 'ServiceSheet.tsx'), 'utf8');
    const lines = source.split(/\r?\n/).length;

    expect(lines).toBeLessThanOrEqual(520);
  });
});
