import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeReleaseDatabaseHash, releaseDatabaseHashInputs } from './release-e2e-hash.mjs';

function write(root, path, contents) {
  const fullPath = join(root, ...path.split('/'));
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, contents);
}

describe('release E2E golden database hash', () => {
  it('includes migrations, seeders, release prep, auth and session inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-release-hash-'));
    try {
      write(root, 'database/migrations/2026_01_01_000000_create_users.php', '<?php // migration v1');
      write(root, 'database/seeders/RolesAndPermissionsSeeder.php', '<?php // seeder v1');
      write(root, 'app/Console/Commands/PrepareE2eReleaseDataCommand.php', '<?php // prep v1');
      write(root, 'app/Http/Controllers/AuthController.php', '<?php // auth v1');
      write(root, 'app/Http/Middleware/StripApiReadSessionCookies.php', '<?php // cookie v1');
      write(root, 'app/Http/Requests/Auth/LoginRequest.php', '<?php // login v1');
      write(root, 'bootstrap/app.php', '<?php // middleware bootstrap v1');
      write(root, 'config/session.php', '<?php // session v1');
      write(root, 'config/sanctum.php', '<?php // sanctum v1');
      write(root, 'routes/api.php', '<?php // api v1');
      write(root, 'routes/web.php', '<?php // web v1');
      write(root, 'app/Unrelated.php', '<?php // unrelated');

      const inputs = releaseDatabaseHashInputs(root).map((file) => relative(root, file).split(sep).join('/'));

      expect(inputs).toEqual([
        'app/Console/Commands/PrepareE2eReleaseDataCommand.php',
        'app/Http/Controllers/AuthController.php',
        'app/Http/Middleware/StripApiReadSessionCookies.php',
        'app/Http/Requests/Auth/LoginRequest.php',
        'bootstrap/app.php',
        'config/sanctum.php',
        'config/session.php',
        'database/migrations/2026_01_01_000000_create_users.php',
        'database/seeders/RolesAndPermissionsSeeder.php',
        'routes/api.php',
        'routes/web.php',
      ]);

      const initialHash = computeReleaseDatabaseHash(root);
      write(root, 'app/Console/Commands/PrepareE2eReleaseDataCommand.php', '<?php // prep v2');
      const prepHash = computeReleaseDatabaseHash(root);
      write(root, 'app/Http/Controllers/AuthController.php', '<?php // auth v2');
      const authHash = computeReleaseDatabaseHash(root);

      expect(prepHash).not.toBe(initialHash);
      expect(authHash).not.toBe(prepHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});