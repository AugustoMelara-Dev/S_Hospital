import { describe, expect, it } from 'vitest';
import { filterViolationsForMode, scanSource } from './ui-legacy-audit.mjs';

describe('ui legacy audit', () => {
  it('accepts institutional zero-radius tokens and flags non-zero radius', () => {
    expect(scanSource('src/design-system/themes/theme.ts', 'const token = { borderRadiusLG: 0 };')).toEqual([]);
    expect(scanSource('src/example.tsx', 'const style = { borderRadius: 8 };')).toEqual([
      expect.objectContaining({ kind: 'inline-radius', file: 'src/example.tsx', line: 1 }),
    ]);
  });

  it('reports imports and prohibited visual classes with structured ownership', () => {
    const violations = scanSource(
      'src/features/reports/Report.tsx',
      "import { X } from 'lucide-react';\n<div className=\"rounded-xl shadow-md\" />",
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'legacy-import', dependency: 'lucide-react', module: 'reports' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'rounded-xl', phaseOwner: 'reports' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'shadow-md', risk: 'medium' }),
    ]));
  });

  it('limits strict mode to declared migrated modules while final mode keeps all violations', () => {
    const violations = [
      ...scanSource('src/features/invoices/History.tsx', "import 'lucide-react';"),
      ...scanSource('src/features/reports/Report.tsx', "import 'lucide-react';"),
    ];

    expect(filterViolationsForMode(violations, 'inventory')).toHaveLength(2);
    expect(filterViolationsForMode(violations, 'strict')).toEqual([
      expect.objectContaining({ file: 'src/features/invoices/History.tsx' }),
    ]);
    expect(filterViolationsForMode(violations, 'final')).toHaveLength(2);
  });
});
