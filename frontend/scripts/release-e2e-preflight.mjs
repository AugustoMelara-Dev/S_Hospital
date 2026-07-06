import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function assertBackendVendorPresent(backendDir) {
  const autoloadPath = join(backendDir, 'vendor', 'autoload.php');

  if (existsSync(autoloadPath)) {
    return;
  }

  throw new Error([
    'backend/vendor/autoload.php is missing; release E2E needs backend Composer dependencies on the host running this script.',
    'Run `composer install` from backend/ before `npm run e2e`, or run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\run_release_e2e_mariadb.ps1 -SeedPassword <secret>` from the repo root for the Docker/MariaDB release gate.',
    'Do not copy container vendor files into the repository as release evidence.',
  ].join('\n'));
}

export function requireE2eReleasePassword(env = process.env) {
  const password = env.E2E_RELEASE_PASSWORD ?? env.E2E_SEED_PASSWORD;

  if (typeof password === 'string' && password.trim() !== '') {
    return password;
  }

  throw new Error([
    'E2E release password is required for release E2E data seeding.',
    'Set E2E_RELEASE_PASSWORD or E2E_SEED_PASSWORD before running `npm run e2e`.',
    'Do not rely on a committed default password for release evidence.',
  ].join('\n'));
}
