import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function assertBackendVendorPresent(backendDir) {
  const autoloadPath = join(backendDir, 'vendor', 'autoload.php');

  if (existsSync(autoloadPath)) {
    return;
  }

  throw new Error([
    'backend/vendor/autoload.php is missing; release E2E needs backend Composer dependencies on the host running this script.',
    'Run `composer install` from backend/ before `npm run e2e`, or run the Docker mocked Playwright gates documented in docs/testing-report.md when validating only the containerized UI smoke.',
    'Do not copy container vendor files into the repository as release evidence.',
  ].join('\n'));
}
