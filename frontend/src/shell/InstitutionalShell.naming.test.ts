import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('institutional shell boundary', () => {
  it('does not retain Clinical shell terminology or retired overlay providers', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const shell = readFileSync('src/shell/InstitutionalShell.tsx', 'utf8');

    expect(`${app}\n${shell}`).not.toMatch(/Clinical(?:Shell|Rail|MobileNav|Toaster)|MotionProvider/);
    expect(app).not.toMatch(/components\/ui\/(?:dialog|states)/);
  });

  it('hosts contextual Ant Design feedback inside the application provider', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const designProvider = readFileSync('src/design-system/providers/DesignSystemProvider.tsx', 'utf8');
    const feedbackProvider = readFileSync('src/design-system/providers/FeedbackProvider.tsx', 'utf8');

    expect(designProvider).toContain('<AntApp>');
    expect(app).toContain('<FeedbackProvider>');
    expect(`${app}\n${feedbackProvider}`).toContain('useFeedback()');
    expect(feedbackProvider).toContain('AntApp.useApp()');
  });
});
