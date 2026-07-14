import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function writeButtonSmokeReport(reportPath, results, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Button smoke report must contain at least one result.');
  }

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({
    generated_at: generatedAt,
    mode: 'mocked-non-mutating-playwright',
    results,
  }, null, 2)}\n`);
}
