import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('ReportsView module architecture', () => {
  it('does not keep the legacy ReportsView helpers file after sub-route consolidation', () => {
    expect(existsSync(join(moduleDir, 'ReportsView.helpers.ts'))).toBe(false);
  });
});