import type { Plugin, ResolvedConfig } from 'vite';
import { createHash, randomBytes } from 'node:crypto';

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

          if (!injectMeta) {
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

        if (!injectMeta) {
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

      if (id.includes('node_modules') || id.includes('vite-plugins')) {
        return null;
      }

      if (id.endsWith('.html')) {
        return code.replace(/<script\b/g, `<script nonce="${buildNonce}"`);
      }

      const transformed = code
        .replace(/<script\b/g, `<script nonce="${buildNonce}"`)
        .replace(/<style\b/g, `<style nonce="${buildNonce}"`);

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

      this.emitFile({
        type: 'asset',
        fileName: 'csp-nonce.json',
        source: JSON.stringify(buildCspNonceManifest(buildNonce), null, 2),
      });
    },
  };
}

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
