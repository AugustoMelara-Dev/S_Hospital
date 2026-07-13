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
  it('uses institutional libraries without legacy UI or visual utility debt', () => {
    const source = sourceFiles(join(process.cwd(), 'src/features/catalog')).map((file) => readFileSync(file, 'utf8')).join('\n');
    const forbiddenPackages = new RegExp([
      ['lucide', 'react'].join('-'),
      ['@radix', 'ui'].join('-'),
    ].join('|'));
    expect(source).not.toMatch(/components\/(ui|shared)/);
    expect(source).not.toMatch(forbiddenPackages);
    expect(source).not.toMatch(/\brounded(?:-|\b)|\bshadow(?:-|\b)|\bgradient(?:-|\b)/);
    expect(source).not.toMatch(/style=\{/);
    expect(source).toContain("from 'antd'");
    expect(source).toContain("from '@/design-system/ag-grid'");
  });
});
