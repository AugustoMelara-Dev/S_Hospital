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

  /* ---------------------------------------------------------------------- */
  /* C4-B2 — regressión del transform en modo serve                         */
  /* ---------------------------------------------------------------------- */

  function serveTransform(
    plugin: ReturnType<typeof cspNoncePlugin>,
    code: string,
    id: string,
  ): string | null {
    const config = (plugin as unknown as { configResolved: (cfg: unknown) => void }).configResolved;
    config({ command: 'serve' });
    const transform = (
      plugin as unknown as { transform: (code: string, id: string) => { code: string } | null }
    ).transform;
    const result = transform(code, id);
    return result === null ? null : result.code;
  }

  it('serve: un módulo .ts con literales `/<style\\b…/` NO se corrompe', () => {
    // Regresión C4-B/B2: receiptDocumentSummary.ts devolvía HTTP 500 porque el
    // transform aplicaba /<script\b/g y /<style\b/g a TODO módulo .ts.
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-serve' });
    const moduleCode = [
      'function stripStyleAndScript(html: string): string {',
      '  return html',
      "    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, '')",
      "    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, '');",
      '}',
    ].join('\n');

    expect(serveTransform(plugin, moduleCode, '/src/features/receipts/receiptDocumentSummary.ts')).toBe(
      null,
    );
  });

  it('serve: un .ts sin tags reales no recibe transform (se sirve tal cual)', () => {
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-serve' });
    const plain = "export const label = '<style es literal de texto';\n";
    expect(serveTransform(plugin, plain, '/src/lib/label.ts')).toBe(null);
  });

  it('serve: inyecta el nonce en tags reales de un .tsx conservando el delimitador', () => {
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-serve' });
    const component = [
      'export const Shell = () => (',
      '  <><style>{`.a{color:red}`}</style><div><script>{"x"}</script></div></>',
      ');',
    ].join('\n');

    const transformed = serveTransform(
      plugin,
      component,
      'C:/repo/frontend/src/Shell.tsx',
    );

    expect(transformed).toContain('<style nonce="test-nonce-serve">');
    expect(transformed).toContain('<script nonce="test-nonce-serve">');
    // `<style>`/`<script>` sin espacio tras el nombre también debe igualarse.
    expect(transformed).not.toContain('<style>');
    expect(transformed).not.toContain('<script>');
  });

  it('serve: exige tag real, no `<script\\b` dentro de texto plano de un .jsx', () => {
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-serve' });
    const jsx = 'export const hint = "escribe <script\\\\b para ver ayuda";\n';
    expect(serveTransform(plugin, jsx, '/src/hint.jsx')).toBe(null);
  });

  it('serve: los módulos .js/.ts dejan de transformarse (exclusión de extensión)', () => {
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-serve' });
    const jsWithRealTagLikeText = "const h = '<script type=\"module\">';\n";
    expect(serveTransform(plugin, jsWithRealTagLikeText, '/src/legacy.js')).toBe(null);
    expect(serveTransform(plugin, jsWithRealTagLikeText, '/src/legacy.ts')).toBe(null);
  });

  it('build: el transform sigue desactivado (camino de build sin cambios)', () => {
    const plugin = cspNoncePlugin({ nonce: 'test-nonce-build' });
    const config = (plugin as unknown as { configResolved: (cfg: unknown) => void }).configResolved;
    config({ command: 'build' });
    const transform = (
      plugin as unknown as { transform: (code: string, id: string) => unknown }
    ).transform;
    expect(transform('<style>x</style>', '/src/Shell.tsx')).toBeNull();
  });
});
