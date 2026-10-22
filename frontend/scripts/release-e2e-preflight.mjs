import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function assertBackendVendorPresent(backendDir) {
  const autoloadPath = join(backendDir, 'vendor', 'autoload.php');

  if (existsSync(autoloadPath)) {
    return;
  }

  throw new Error([
    'backend/vendor/autoload.php is missing; release E2E needs backend Composer dependencies on the host running this script.',
    'Run `composer install` from backend/ before `npm run test:e2e:release`, or run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\run_release_e2e_mariadb.ps1 -SeedPassword <secret>` from the repo root for the Docker/MariaDB release gate.',
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
    'Set E2E_RELEASE_PASSWORD or E2E_SEED_PASSWORD before running `npm run test:e2e:release`.',
    'Do not rely on a committed default password for release evidence.',
  ].join('\n'));
}

// The installed application on port 8000 is never a disposable target.
export function assertExternalReleaseTarget(env = process.env) {
  if (env.E2E_RELEASE_ALLOW_MUTATIONS !== '1') {
    throw new Error('External release E2E requires E2E_RELEASE_ALLOW_MUTATIONS=1 for a disposable laboratory.');
  }
  for (const key of ['E2E_RELEASE_BASE_URL', 'E2E_RELEASE_API_BASE_URL']) {
    const url = new URL(env[key] ?? '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port === '8000') {
      throw new Error(key + ' must target a loopback laboratory outside installed port 8000.');
    }
  }
}