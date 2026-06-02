import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildCspNonceManifest, cspNoncePlugin, isCspNonceApplicable } from './csp-nonce';

describe('cspNoncePlugin', () => {
  it('returns a Vite plugin with the expected name', () => {
    const plugin = cspNoncePlugin();
    expect(plugin.name).toBe('s-hospital-csp-nonce');
  });

  it('reports the nonce as applicable in serve and build commands', () => {
    expect(isCspNonceApplicable('serve')).toBe(true);
    expect(isCspNonceApplicable('build')).toBe(true);
    expect(isCspNonceApplicable('test')).toBe(false);
    expect(isCspNonceApplicable(undefined)).toBe(false);
  });

  it('builds a deterministic manifest for a given nonce', () => {
    const nonce = 'deterministic-nonce-1234567890';
    const manifest = buildCspNonceManifest(nonce);

    expect(manifest.nonce).toBe(
      createHash('sha256').update(nonce).digest('hex').slice(0, 16),
    );
    expect(manifest.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('produces the same manifest for the same nonce', () => {
    const a = buildCspNonceManifest('shared-nonce');
    const b = buildCspNonceManifest('shared-nonce');
    expect(a.nonce).toBe(b.nonce);
  });
});
