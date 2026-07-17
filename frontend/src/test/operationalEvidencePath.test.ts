import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationalEvidencePath } from '../../e2e/fixtures/operational-evidence-path';

const temporaryRoots: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('operationalEvidencePath', () => {
  it('uses the isolated Playwright output by default', () => {
    const outputPath = vi.fn((name: string) => join('test-output', name));

    expect(operationalEvidencePath({ outputPath }, 'catalog-1366.png')).toBe(join('test-output', 'catalog-1366.png'));
    expect(outputPath).toHaveBeenCalledWith('catalog-1366.png');
  });

  it('writes to curated QA evidence only with the exact update flag', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-evidence-'));
    temporaryRoots.push(root);
    const frontendRoot = join(root, 'frontend');
    vi.spyOn(process, 'cwd').mockReturnValue(frontendRoot);
    vi.stubEnv('E2E_UPDATE_OPERATIONAL_UX_EVIDENCE', '1');

    const path = operationalEvidencePath({ outputPath: vi.fn() }, 'billing-1366x768.png', 'core');

    expect(path).toBe(resolve(root, 'qa/operational-ux/after/core/billing-1366x768.png'));
    expect(existsSync(resolve(root, 'qa/operational-ux/after/core'))).toBe(true);
  });

  it('does not enable curated writes for truthy-looking values', () => {
    vi.stubEnv('E2E_UPDATE_OPERATIONAL_UX_EVIDENCE', 'true');
    const outputPath = vi.fn((name: string) => join('isolated', name));

    expect(operationalEvidencePath({ outputPath }, 'history-1366.png')).toBe(join('isolated', 'history-1366.png'));
  });
});
