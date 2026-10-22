import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

describe('catalog library architecture', () => {
  it('uses the admin design system without R2 page/card/alert/badge shells', () => {
    const source = sourceFiles(join(process.cwd(), 'src/features/catalog')).map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/style=\{/);
    expect(source).toContain("from '@/design-system/admin/components'");
    expect(source).toContain("from 'lucide-react'");
    expect(source).not.toMatch(/from '@\/design-system\/components\/PageHeader'/);
    expect(source).not.toMatch(/from '@\/components\/ui\/(?:card|alert|badge|button)'/);
    expect(source).not.toMatch(/from '@\/design-system\/patterns\/DataTable'/);
    expect(source).not.toMatch(/teal|--primary\b/);
  });
});
