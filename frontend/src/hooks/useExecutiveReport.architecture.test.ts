import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('useExecutiveReport module architecture', () => {
  it('does not keep the unused today report query hook in the executive report module', () => {
    const source = readFileSync(join(moduleDir, 'useExecutiveReport.ts'), 'utf8');

    expect(source).not.toContain('useTodayReport');
  });
});