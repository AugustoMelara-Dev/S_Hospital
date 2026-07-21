import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('real Playwright configuration', () => {
  it('uses the reviewed local Chromium path when the offline runner provides it', () => {
    const source = readFileSync('playwright.real.config.ts', 'utf8');

    expect(source).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
    expect(source).toContain('executablePath');
    expect(source).toContain("'--no-sandbox'");
    expect(source).toContain('workers: 1');
  });

  it('waits for the real login response before asserting authenticated navigation', () => {
    const source = readFileSync('e2e/real-smoke.spec.ts', 'utf8');

    expect(source).toContain("page.waitForResponse(");
    expect(source).toContain("response.url().includes('/api/auth/login')");
    expect(source).not.toContain('await page.waitForTimeout(1_000);');
  });

  it('confirms the audited cash-opening dialog in the real mutation flow', () => {
    const source = readFileSync('e2e/real-smoke.spec.ts', 'utf8');

    expect(source).toContain("name: /confirmar apertura de caja/i");
    expect(source).toContain("openDialog.getByRole('button', { name: /^abrir caja$/i }).click()");
  });

  it('waits for the searched service response before enforcing LAN timings', () => {
    const source = readFileSync('e2e/critical-lan-performance.spec.ts', 'utf8');

    expect(source).toMatch(
      /completed\.some\(\s*\(request\) => request\.path === '\/api\/services' && request\.query\.includes\('search=glucosa'\),?\s*\)/,
    );
  });

  it('gives the complete release transaction enough aggregate time on mounted Docker workspaces', () => {
    const source = readFileSync('e2e/release-gate.spec.ts', 'utf8');

    expect(source).toContain('test.setTimeout(240_000)');
  });
});
