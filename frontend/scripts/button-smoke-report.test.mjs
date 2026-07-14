import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeButtonSmokeReport } from './button-smoke-report.mjs';

describe('button smoke report writer', () => {
  it('writes the non-mutating smoke report when at least one result exists', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-button-smoke-'));
    const reportPath = join(root, 'nested', 'button-smoke-report.json');

    try {
      writeButtonSmokeReport(reportPath, [
        { name: 'screen controls and axe smoke', path: '/cashbox', status: 'passed' },
      ], '2026-07-05T12:00:00.000Z');

      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        generated_at: '2026-07-05T12:00:00.000Z',
        mode: 'mocked-non-mutating-playwright',
      });
      expect(report.results).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails instead of writing an empty evidence artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-button-smoke-'));
    const reportPath = join(root, 'button-smoke-report.json');

    try {
      expect(() => writeButtonSmokeReport(reportPath, [])).toThrow(/at least one result/i);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
