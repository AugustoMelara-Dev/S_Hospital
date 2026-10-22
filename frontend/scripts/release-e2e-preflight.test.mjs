import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertBackendVendorPresent, assertExternalReleaseTarget, requireE2eReleasePassword } from './release-e2e-preflight.mjs';

describe('release E2E preflight', () => {
  it('accepts only an explicitly authorized loopback laboratory for external servers', () => {
    const env = {
      E2E_RELEASE_BASE_URL: 'http://127.0.0.1:18082',
      E2E_RELEASE_API_BASE_URL: 'http://127.0.0.1:18082',
      E2E_RELEASE_ALLOW_MUTATIONS: '1',
    };
    expect(() => assertExternalReleaseTarget(env)).not.toThrow();
    expect(() => assertExternalReleaseTarget({ ...env, E2E_RELEASE_ALLOW_MUTATIONS: '0' })).toThrow(/disposable laboratory/);
    expect(() => assertExternalReleaseTarget({ ...env, E2E_RELEASE_BASE_URL: 'http://127.0.0.1:8000' })).toThrow(/installed port 8000/);
    expect(() => assertExternalReleaseTarget({ ...env, E2E_RELEASE_API_BASE_URL: 'https://example.com' })).toThrow(/loopback laboratory/);
  });
  it('passes when the backend Composer autoloader exists', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-e2e-preflight-'));
    try {
      mkdirSync(join(root, 'vendor'), { recursive: true });
      writeFileSync(join(root, 'vendor', 'autoload.php'), '<?php');

      expect(() => assertBackendVendorPresent(root)).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails early with a recovery command when backend dependencies are missing', () => {
    const root = mkdtempSync(join(tmpdir(), 's-hospital-e2e-preflight-'));
    try {
      expect(() => assertBackendVendorPresent(root)).toThrow(/backend\/vendor\/autoload\.php is missing/i);
      expect(() => assertBackendVendorPresent(root)).toThrow(/composer install/i);
      expect(() => assertBackendVendorPresent(root)).toThrow(/run_release_e2e_mariadb\.ps1/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit E2E password for host release evidence', () => {
    expect(() => requireE2eReleasePassword({})).toThrow(/E2E release password is required/i);
    expect(() => requireE2eReleasePassword({ E2E_RELEASE_PASSWORD: '  ' })).toThrow(/E2E release password is required/i);
    expect(requireE2eReleasePassword({ E2E_RELEASE_PASSWORD: 'ReleaseSecret!1' })).toBe('ReleaseSecret!1');
    expect(requireE2eReleasePassword({ E2E_SEED_PASSWORD: 'SeedSecret!1' })).toBe('SeedSecret!1');
  });

  it('does not ship a committed default password in the host release runner', () => {
    const runner = readFileSync('scripts/run-release-e2e.mjs', 'utf8');

    expect(runner).not.toContain('Password123');
    expect(runner).not.toContain("hospital:prepare-e2e-release-data', '--json");
    expect(runner).toContain('requireE2eReleasePassword');
  });
});
