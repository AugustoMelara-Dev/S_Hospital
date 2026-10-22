import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('BackupsView module architecture', () => {
  it('keeps backup operations separate from presentation and support-status formatting', () => {
    const source = readFileSync(join(moduleDir, 'BackupsView.tsx'), 'utf8');

    expect(source).toMatch(/useBackups/);
    expect(source).toMatch(/useCreateBackup/);
    expect(source).toMatch(/useSystemStatusSnapshot/);
    expect(source).toMatch(/<BackupHealthPanel/);
    expect(source).toMatch(/<BackupHistoryTable/);
    expect(source).toMatch(/<BackupDownloadDialog/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/apiClient\.(?:restore|delete)Backup/);
  });
});
