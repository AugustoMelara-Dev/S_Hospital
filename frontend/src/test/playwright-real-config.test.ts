import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('real Playwright configuration', () => {
  it('uses the reviewed local Chromium path when the offline runner provides it', () => {
    const source = readFileSync('playwright.real.config.ts', 'utf8');

    expect(source).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
    expect(source).toContain('executablePath');
    expect(source).toContain("'--no-sandbox'");
  });
});
