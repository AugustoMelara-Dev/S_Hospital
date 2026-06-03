import type { Plugin, ResolvedConfig } from 'vite';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Build-time placeholder that the Laravel backend substitutes with
 * a per-request nonce before serving the SPA. Keeping the placeholder
 * stable means the production CSP can require the nonce without
 * having to re-bundle the frontend on every cold start.
 */
export const CSP_NONCE_PLACEHOLDER = '__S_HOSPITAL_CSP_NONCE__';

export function cspNoncePlugin(options: { nonce?: string; meta?: boolean } = {}): Plugin {
  const buildNonce = options.nonce ?? randomBytes(16).toString('base64');
  const injectMeta = options.meta ?? true;

  let config: ResolvedConfig | null = null;

  return {
    name: 's-hospital-csp-nonce',
    enforce: 'pre',

    configResolved(resolved) {
      config = resolved;
    },

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (config?.command === 'build') {
          const placeholderScript = html.replace(
            /<script\b/g,
            `<script nonce="${CSP_NONCE_PLACEHOLDER}"`,
          );
          const placeholderStyle = placeholderScript.replace(
            /<style\b/g,
            `<style nonce="${CSP_NONCE_PLACEHOLDER}"`,
          );

          if (! injectMeta) {
            return placeholderStyle;
          }

          return {
            html: placeholderStyle,
            tags: [
              {
                tag: 'meta',
                attrs: { name: 'csp-nonce', content: CSP_NONCE_PLACEHOLDER },
                injectTo: 'head-prepend',
              },
            ],
          };
        }

        if (! injectMeta) {
          return html;
        }

        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { name: 'csp-nonce', content: buildNonce },
              injectTo: 'head-prepend',
            },
          ],
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
