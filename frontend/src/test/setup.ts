import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/dom';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

// Bump the default async-util timeout from 1s to 10s. AppRoutes code-
// splits the 9 heavy views (Reports, Backups, Fiscal Settings, etc.)
// via React.lazy; the chunk load + Suspense resolution on a busy CI
// node can exceed the previous 1s default and cause intermittent
// findBy* timeouts. 10s is well above the worst observed run (~8s
// for "renders only the active module") and still tight enough to
// surface real regressions.
configure({ asyncUtilTimeout: 10_000 });

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

if (typeof HTMLFormElement !== 'undefined') {
  Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
    configurable: true,
    value(this: HTMLFormElement, submitter?: HTMLElement) {
      const event = new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
        submitter: submitter instanceof HTMLElement ? submitter : null,
      });
      this.dispatchEvent(event);
    },
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
