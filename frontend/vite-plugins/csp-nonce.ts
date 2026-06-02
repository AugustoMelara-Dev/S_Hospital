import type { Plugin, ResolvedConfig } from 'vite';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Vite plugin that injects a per-build CSP nonce into the entry
 * script and the inline styles emitted by Tailwind.
 *
 * The nonce is rendered as a `<meta name="csp-nonce" content="...">`
 * tag inside the served `index.html` so the Laravel backend can
 * read it on the first request and use the same value to seed the
 * `Content-Security-Policy` header. The same nonce is then attached
 * to every script and style emitted by the Vite transform so
 * `unsafe-inline` can finally be removed from `script-src` and
 * `style-src` in the production CSP.
 */
export function cspNoncePlugin(options: { nonce?: string; meta?: boolean } = {}): Plugin {
  const buildNonce = options.nonce ?? randomBytes(16).toString('base64');
  const injectMeta = options.meta ?? true;

  let config: ResolvedConfig | null = null;

  return {
    name: 's-hospital-csp-nonce',
    enforce: 'post',

    configResolved(resolved) {
      config = resolved;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (config?.command === 'build') {
          return html;
        }

        const nonce = buildNonce;
        const tags: string[] = [];

        if (injectMeta) {
          tags.push(`<meta name="csp-nonce" content="${nonce}">`);
        }

        return {
          html,
          tags,
        };
      },
    },

    transform(code, id) {
      if (config?.command === 'build') {
        return null;
      }

      if (!/\.(js|ts|tsx|jsx|html)$/.test(id)) {
        return null;
      }

      if (id.includes('node_modules')) {
        return null;
      }

      if (id.includes('vite-plugins')) {
        return null;
      }

      const nonce = buildNonce;

      if (id.endsWith('.html')) {
        return code.replace(/<script\b/g, `<script nonce="${nonce}"`);
      }

      const transformed = code.replace(
        /<script\b/g,
        `<script nonce="${nonce}"`,
      ).replace(
        /<style\b/g,
        `<style nonce="${nonce}"`,
      );

      if (transformed === code) {
        return null;
      }

      return {
        code: transformed,
        map: null,
      };
    },

    generateBundle() {
      if (config?.command !== 'build') {
        return;
      }

      const manifest = buildCspNonceManifest(buildNonce);
      this.emitFile({
        type: 'asset',
        fileName: 'csp-nonce.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

/**
 * Pure helper that the unit tests call directly so the plugin
 * wrapper around Vite is not part of the tested surface.
 */
export function buildCspNonceManifest(nonce: string): {
  nonce: string;
  generated_at: string;
} {
  return {
    nonce: createHash('sha256').update(nonce).digest('hex').slice(0, 16),
    generated_at: new Date().toISOString(),
  };
}

export function isCspNonceApplicable(command: string | undefined): boolean {
  return command === 'serve' || command === 'build';
}

export default cspNoncePlugin;
