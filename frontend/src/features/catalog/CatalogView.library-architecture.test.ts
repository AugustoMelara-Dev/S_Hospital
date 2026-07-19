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
  it('uses the local shadcn system and institutional table adapter without legacy UI imports', () => {
    const source = sourceFiles(join(process.cwd(), 'src/features/catalog')).map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"]antd['"]/);
    expect(source).not.toMatch(/@ant-design\/icons/);
    expect(source).not.toMatch(/design-system\/ag-grid/);
    expect(source).not.toMatch(/style=\{/);
    expect(source).toContain("from '@/components/ui/");
    expect(source).toContain("from 'lucide-react'");
    expect(source).toContain("from '@/design-system/patterns/DataTable'");
  });
});
