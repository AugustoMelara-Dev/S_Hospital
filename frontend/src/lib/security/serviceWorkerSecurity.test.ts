import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const serviceWorkerSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('service worker security policy', () => {
  it('never intercepts authenticated API or Sanctum requests', () => {
    expect(serviceWorkerSource).toContain("url.pathname.startsWith('/api/')");
    expect(serviceWorkerSource).toContain("url.pathname.startsWith('/sanctum/')");
    expect(serviceWorkerSource).toMatch(/if \(isSensitiveRequest\(url\)\) \{\s+return;\s+\}/);
    expect(serviceWorkerSource).not.toContain('networkFirst');
  });

  it('only handles navigations and explicit public static assets', () => {
    expect(serviceWorkerSource).toContain("request.mode === 'navigate'");
    expect(serviceWorkerSource).toMatch(/if \(isStaticAsset\(url\)\) \{\s+event\.respondWith\(cacheFirst\(request\)\);/);
    expect(serviceWorkerSource).toContain("url.pathname.startsWith('/assets/')");
  });

  it('avoids stale shells during development and tolerates normal LAN latency', () => {
    expect(mainSource).toContain('navigator.serviceWorker.getRegistrations()');
    expect(mainSource).toContain('registration.unregister()');
    expect(mainSource).toContain('caches.keys()');
    expect(mainSource).toContain("cacheName.startsWith('s-hospital-')");
    expect(mainSource).toContain('window.location.reload()');
    expect(serviceWorkerSource).toContain("const CACHE_VERSION = 's-hospital-v4'");
    expect(serviceWorkerSource).toContain('fetchWithTimeout(request, 8000)');
  });
});
