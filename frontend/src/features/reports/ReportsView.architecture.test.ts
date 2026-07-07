import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('ReportsView module architecture', () => {
  it('does not keep the legacy ReportsView helpers file after sub-route consolidation', () => {
    expect(existsSync(join(moduleDir, 'ReportsView.helpers.ts'))).toBe(false);
  });
  it('does not keep legacy tab-named cash report components after sub-route consolidation', () => {
    expect(existsSync(join(moduleDir, 'components', 'CashSessionReportTab.tsx'))).toBe(false);
    expect(existsSync(join(moduleDir, 'components', 'CashSessionReportTab.test.tsx'))).toBe(false);
  });
  it('does not keep generic report filter components after executive route consolidation', () => {
    expect(existsSync(join(moduleDir, 'components', 'ReportFiltersPanel.tsx'))).toBe(false);
    expect(existsSync(join(moduleDir, 'components', 'ReportFiltersPanel.test.tsx'))).toBe(false);
  });
});
