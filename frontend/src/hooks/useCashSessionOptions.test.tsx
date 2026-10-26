import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cash } from '@/lib/api';
import { useCashSessionOptions } from './useCashSessionOptions';

afterEach(() => vi.restoreAllMocks());

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('authorized cash options', () => {
  it('loads further pages only on request and retains a selected item outside the result page', async () => {
    const getOptions = vi.spyOn(cash, 'getCashSessionOptions').mockImplementation(async ({ page = 1 }) => ({
      data: [{ value: String(page), label: `Turno página ${page}` }],
      selected: { value: '99', label: 'Turno antiguo seleccionado' },
      meta: { current_page: page, per_page: 1, total: 2 },
    }));
    const { result } = renderHook(() => useCashSessionOptions('sessions', { enabled: true, selectedId: 99 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(getOptions).toHaveBeenCalledTimes(1);
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.options).toHaveLength(3));
    expect(getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, selectedId: 99, kind: 'sessions' }));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('searches on the server and resets pagination instead of filtering the first loaded page', async () => {
    const getOptions = vi.spyOn(cash, 'getCashSessionOptions').mockImplementation(async ({ search }) => ({
      data: [{ value: search ? '80' : '1', label: search || 'Inicial' }], selected: null,
      meta: { current_page: 1, per_page: 20, total: 1 },
    }));
    const { result } = renderHook(() => useCashSessionOptions('cashiers', { enabled: true }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.options[0]?.value).toBe('1'));
    act(() => result.current.setSearch('Cajera de otro año'));
    await waitFor(() => expect(result.current.options[0]?.value).toBe('80'));
    expect(getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'cashiers', search: 'Cajera de otro año', page: 1 }));
  });

  it('does not fetch options for a user who cannot filter scope', () => {
    const getOptions = vi.spyOn(cash, 'getCashSessionOptions');
    renderHook(() => useCashSessionOptions('cashiers', { enabled: false }), { wrapper: wrapper() });
    expect(getOptions).not.toHaveBeenCalled();
  });
});
