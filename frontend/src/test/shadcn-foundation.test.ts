import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('shadcn foundation', () => {
  it('uses the nova style, existing alias and global stylesheet', () => {
    const config = JSON.parse(readFileSync(resolve(root, 'components.json'), 'utf8')) as {
      style: string;
      tailwind: { css: string };
      aliases: { ui: string };
      iconLibrary: string;
    };

    expect(config.style).toBe('radix-nova');
    expect(config.tailwind.css).toBe('src/styles.css');
    expect(config.aliases.ui).toBe('@/components/ui');
    expect(config.iconLibrary).toBe('lucide');
  });

  it('exposes semantic rounded tokens without remote assets', () => {
    const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');

    expect(css).toContain('@theme inline');
    expect(css).toContain('--radius:');
    expect(css).not.toMatch(/https?:\/\//);
  });
});
