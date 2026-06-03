import '@testing-library/jest-dom/vitest';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

Object.defineProperty(window, 'focus', {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(window, 'print', {
  configurable: true,
  value: vi.fn(),
});

class ResizeObserverMock implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
});

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null),
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  // Reset the module-level queryClient so each test starts with a
  // clean cache. Otherwise a previous test's stale data could leak
  // into mocks of the next test.
  if ('__resetQueryClient' in globalThis) {
    (globalThis as { __resetQueryClient?: () => void }).__resetQueryClient?.();
  }
});

// Best-effort reset of any per-suite QueryClient. Components that
// spin up their own client should call the global hook.
const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
});
(globalThis as { __resetQueryClient?: () => void }).__resetQueryClient = () => {
  testQueryClient.clear();
};
// Suppress the unused warning while keeping the client alive for any
// helper that wants to call clear() between tests.
void testQueryClient;

afterEach(() => {
  vi.restoreAllMocks();
});
