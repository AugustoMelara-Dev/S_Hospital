/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom/vitest';

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
import { configure } from '@testing-library/dom';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

import React from 'react';
expect.extend(matchers);

// JSDOM cannot run AG Grid's layout engine. The institutional adapter remains
// real; only the third-party renderer is replaced at the test boundary.
vi.mock('ag-grid-react', () => ({
  AgGridProvider: ({ children }: { children: React.ReactNode }) => children,
  AgGridReact: ({
    'aria-label': ariaLabel,
    columnDefs = [],
    rowData = [],
  }: {
    'aria-label'?: string;
    columnDefs?: Array<Record<string, any>>;
    rowData?: Array<Record<string, any>>;
  }) => React.createElement(
    'table',
    { 'aria-label': ariaLabel },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        columnDefs.map((column) => React.createElement(
          'th',
          {
            key: column.colId ?? column.field ?? column.headerName,
            'data-numeric': column.type === 'rightAligned' ? 'true' : undefined,
          },
          column.headerName,
        )),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      rowData.map((row, rowIndex) => React.createElement(
        'tr',
        { key: row.id ?? rowIndex },
        columnDefs.map((column) => {
          const value = column.field ? row[column.field] : undefined;
          const params = { data: row, value };
          const renderedValue = column.cellRenderer
            ? column.cellRenderer(params)
            : column.valueFormatter
              ? column.valueFormatter(params)
              : column.valueGetter
                ? column.valueGetter({ data: row })
                : value;
          return React.createElement(
            'td',
            {
              key: column.colId ?? column.field ?? column.headerName,
              'data-numeric': column.type === 'rightAligned' ? 'true' : undefined,
            },
            renderedValue == null ? '' : renderedValue,
          );
        }),
      )),
    ),
  ),
}));

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

// JSDOM exposes scrollTo but throws "Not implemented" when route-level
// restoration calls it. Browsers keep the real implementation; tests only
// need an observable boundary for navigation and focus assertions.
Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// Ant Design measures scrollbars and focus styles through computed styles.
// Keep JSDOM's stylesheet-derived values (notably display/visibility for
// closing overlays) and fall back only when its CSS parser rejects a selector.
const jsdomGetComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, 'getComputedStyle', {
  configurable: true,
  value: (element: Element, _pseudoElement?: string | null) => {
    try {
      return jsdomGetComputedStyle(element);
    } catch {
      const style = element instanceof HTMLElement || element instanceof SVGElement
        ? element.style
        : document.documentElement.style;
      return style;
    }
  },
});

Object.defineProperty(window, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  configurable: true,
  writable: true,
  value: (handle: number) => window.clearTimeout(handle),
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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
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

beforeEach(async () => {
  document.body.innerHTML = '';
  const portalRoot = document.createElement('div');
  portalRoot.id = 'test-portal-root';
  document.body.appendChild(portalRoot);
  // Reset the module-level queryClient so each test starts with a
  // clean cache. Otherwise a previous test's stale data could leak
  // into mocks of the next test.
  if ('__resetQueryClient' in globalThis) {
    await (globalThis as { __resetQueryClient?: () => void | Promise<void> }).__resetQueryClient?.();
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
