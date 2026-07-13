/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/dom';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

import React from 'react';
expect.extend(matchers);

import dayjs from 'dayjs';

vi.mock('@/design-system/ag-grid/InstitutionalDataGrid', () => {
  return {
    InstitutionalDataGrid: ({ ariaLabel, regionAriaLabel, gridAriaLabel, rows, columns, state = rows.length === 0 ? 'empty' : 'ready', errorMessage = 'No se pudo cargar la información.', emptyMessage = 'No hay registros para mostrar.', actions }: any) => {
      if (state !== 'ready') {
        return React.createElement(
          'section',
          { 'aria-label': regionAriaLabel ?? ariaLabel },
          React.createElement(
            'div',
            { role: state === 'error' ? 'alert' : 'status' },
            state === 'loading' ? 'Cargando registros…' : state === 'error' ? errorMessage : emptyMessage
          ),
          actions
        );
      }
      return React.createElement(
        'section',
        { 'aria-label': regionAriaLabel ?? ariaLabel },
        React.createElement(
          'table',
          {
            'aria-label': gridAriaLabel ?? ariaLabel,
            className: 'min-w-0 md:min-w-[980px] max-md:block max-md:[&_td]:min-w-0',
          },
          React.createElement(
            'thead',
            null,
            React.createElement(
              'tr',
              null,
              columns.map((column: any) =>
                React.createElement(
                  'th',
                  {
                    key: column.colId ?? column.field ?? '',
                    'data-numeric': column.numeric || column.type === 'rightAligned' ? 'true' : undefined,
                  },
                  column.headerName
                )
              )
            )
          ),
          React.createElement(
            'tbody',
            null,
            rows.map((row: any, rowIndex: number) =>
              React.createElement(
                'tr',
                { key: row.id ?? rowIndex },
                columns.map((column: any) => {
                  const fieldVal = column.field ? row[column.field] : undefined;
                  const params = { data: row, value: fieldVal };
                  const renderer = column.cellRenderer;
                  const formatter = column.valueFormatter;
                  const getter = column.valueGetter;
                  let renderedValue: any = '';
                  if (renderer) {
                    renderedValue = renderer(params);
                  } else if (formatter) {
                    renderedValue = formatter(params);
                  } else if (getter) {
                    renderedValue = getter({ data: row });
                  } else {
                    renderedValue = fieldVal !== undefined && fieldVal !== null ? String(fieldVal) : '';
                  }
                  return React.createElement(
                    'td',
                    {
                      key: column.colId ?? column.field ?? '',
                      'data-numeric': column.numeric || column.type === 'rightAligned' ? 'true' : undefined,
                    },
                    renderedValue
                  );
                })
              )
            )
          )
        ),
        actions
      );
    }
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    DatePicker: (props: any) => {
      const { value, onChange, id, className, ...rest } = props;
      const formattedValue = value ? value.format('YYYY-MM-DD') : '';
      return React.createElement('input', {
        id,
        type: 'date',
        className,
        value: formattedValue,
        onChange: (e: any) => {
          const val = e.target.value;
          const dateObj = val ? dayjs(val) : null;
          if (onChange) {
            onChange(dateObj, val);
          }
        },
        ...rest,
      });
    }
  };
});

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

beforeEach(async () => {
  document.body.innerHTML = '';
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
