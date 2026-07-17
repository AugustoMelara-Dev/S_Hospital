import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TestInfo } from '@playwright/test';

export function operationalEvidencePath(
  testInfo: Pick<TestInfo, 'outputPath'>,
  fileName: string,
  subdirectory?: string,
): string {
  if (process.env.E2E_UPDATE_OPERATIONAL_UX_EVIDENCE !== '1') {
    return testInfo.outputPath(fileName);
  }

  const directory = resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', subdirectory ?? '');
  mkdirSync(directory, { recursive: true });

  return resolve(directory, fileName);
}
