import { describe, expect, it } from 'vitest';
import config from './playwright.config';

describe('Playwright local server isolation', () => {
  it('starts S_Hospital on a dedicated strict port without reusing unrelated servers', () => {
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(webServer).toMatchObject({
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    });
    expect(config.use?.baseURL).toBe('http://127.0.0.1:4173');
  });
});
