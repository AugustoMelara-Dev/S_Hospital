import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CSP_NONCE_PLACEHOLDER,
  buildCspNonceManifest,
  cspNoncePlugin,
  isCspNonceApplicable,
} from './csp-nonce';

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

  it('exposes a stable placeholder that the backend can substitute', () => {
    expect(CSP_NONCE_PLACEHOLDER).toBe('__S_HOSPITAL_CSP_NONCE__');
  });

  it('substitutes a build-time placeholder that points to the static slot', async () => {
    const plugin = cspNoncePlugin();
    const html = '<html><script type="module" src="/main.js"></script><style>body{}</style></html>';
    const handler = plugin.transformIndexHtml as { handler: (html: string) => unknown };
    const config = (plugin as unknown as { configResolved: (cfg: unknown) => void }).configResolved;
    config({ command: 'build' });

    const result = await handler.handler(html);
    const typed = result as { html: string; tags: Array<{ tag: string; attrs: Record<string, string> }> };

    expect(typed.html).toContain(`nonce="${CSP_NONCE_PLACEHOLDER}"`);
    expect(typed.html).toContain('<style nonce="');
    expect(typed.tags[0]?.tag).toBe('meta');
    expect(typed.tags[0]?.attrs.name).toBe('csp-nonce');
    expect(typed.tags[0]?.attrs.content).toBe(CSP_NONCE_PLACEHOLDER);
  });

  it('does not emit invalid html tag descriptors', async () => {
    const plugin = cspNoncePlugin();
    const html = '<html><script type="module" src="/main.js"></script></html>';
    const handler = plugin.transformIndexHtml as { handler: (html: string) => unknown };
    const config = (plugin as unknown as { configResolved: (cfg: unknown) => void }).configResolved;
    config({ command: 'build' });

    const result = await handler.handler(html);
    const typed = result as { html: string; tags: Array<{ tag: string; attrs: Record<string, string> }> };

    expect(typed.html).not.toContain('<undefined>');
    expect(typed.tags.every((tag) => typeof tag.tag === 'string')).toBe(true);
  });
});
