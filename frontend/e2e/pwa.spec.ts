import { test, expect } from '@playwright/test';

test.describe('PWA - manifest, service worker and offline behaviour', () => {
  test('manifest.webmanifest is served with required fields', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.name).toBeTruthy();
    expect(body.start_url).toBeTruthy();
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('service worker file is reachable at /sw.js', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('CACHE_VERSION');
    expect(text).toContain('addEventListener');
    expect(text).toContain('/api/* -> NetworkFirst');
    expect(text).toContain('Sin conexion LAN al servidor.');
    expect(text).not.toMatch(/[Ââ]/);
  });

  test('login page is reachable and links to the manifest', async ({ page }) => {
    await page.goto('/login');
    const link = page.locator('head link[rel="manifest"]');
    await expect(link).toHaveCount(1);
  });
});
