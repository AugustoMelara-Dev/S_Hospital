import { describe, expect, it } from 'vitest';
import { checkUiRules, scanAppSemanticRules, scanUiRuleSource } from './check-ui-rules.mjs';

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

  it('rejects using the secondary surface token as foreground content', () => {
    expect(scanAppSemanticRules('src/features/help.tsx', '<a className="text-secondary">Ayuda</a>')).toEqual([
      expect.stringContaining('secondary es una superficie'),
    ]);
    expect(scanAppSemanticRules('src/features/help.tsx', '<a className="text-primary">Ayuda</a>')).toEqual([]);
  });

  it('keeps the checked-in foundation conformant', () => {
    expect(checkUiRules().violations).toEqual([]);
  });
});
