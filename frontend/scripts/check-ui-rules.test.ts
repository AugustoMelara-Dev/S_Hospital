import { describe, expect, it } from 'vitest';
import { checkUiRules, scanUiRuleSource } from './check-ui-rules.mjs';

describe('shadcn UI rules', () => {
  it('accepts semantic rounded surfaces and shadows', () => {
    expect(scanUiRuleSource('src/components/ui/card.tsx', '<div className="rounded-xl bg-card shadow-sm" />')).toEqual([]);
  });

  it('rejects spacing utilities that do not compose and manual dark colors', () => {
    expect(scanUiRuleSource(
      'src/components/ui/example.tsx',
      '<div className="space-y-4 dark:bg-slate-950" />',
    )).toEqual([
      expect.stringContaining('usar gap'),
      expect.stringContaining('tokens semánticos'),
    ]);
  });

  it('rejects remote runtime assets', () => {
    expect(scanUiRuleSource('src/styles.css', '@import "https://fonts.example.test/font.css";')).toEqual([
      expect.stringContaining('operación offline'),
    ]);
  });

  it('keeps the checked-in foundation conformant', () => {
    expect(checkUiRules().violations).toEqual([]);
  });
});
