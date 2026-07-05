import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertBackendVendorPresent } from './release-e2e-preflight.mjs';

describe('release E2E preflight', () => {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
