import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('institutional shell boundary', () => {
  it('does not retain Clinical shell terminology or retired overlay providers', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const shell = readFileSync('src/shell/InstitutionalShell.tsx', 'utf8');

    expect(`${app}\n${shell}`).not.toMatch(/Clinical(?:Shell|Rail|MobileNav|Toaster)|MotionProvider/);
    expect(app).toContain("from '@/components/ui/dialog'");
  });

  it('hosts contextual Sonner feedback inside the local theme provider', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const designProvider = readFileSync('src/design-system/providers/DesignSystemProvider.tsx', 'utf8');
    const feedbackProvider = readFileSync('src/design-system/providers/FeedbackProvider.tsx', 'utf8');

    expect(designProvider).toContain('<ThemeProvider>');
    expect(app.indexOf('<ThemeProvider>')).toBeLessThan(app.indexOf('<FeedbackProvider>'));
    expect(app).toContain('<FeedbackProvider>');
    expect(`${app}\n${feedbackProvider}`).toContain('useFeedback()');
    expect(feedbackProvider).toContain("from 'sonner'");
  });
});
