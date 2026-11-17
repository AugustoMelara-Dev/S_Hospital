import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { CashRegister, Paginated } from '@/api/types';
import type { CashSessionRow, CashSessionsQuery } from './types';

export const cashKeys = {
  registers: ['cash-registers'] as const,
  detail: (id: number) => ['cash-sessions', 'detail', id] as const,
};

/** Current session of the logged-in user, with reconciliation (polled every 10 s on /caja). */
export function useCurrentSession(enabled = true) {
  return useQuery({
    queryKey: qk.currentCash,
    queryFn: () => api.get<CashSessionRow | null>('/cash-sessions/current'),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    enabled,
  });
}

export function useCashRegisters(enabled = true) {
  return useQuery({
    queryKey: cashKeys.registers,
    queryFn: () => api.get<CashRegister[] | Paginated<CashRegister>>('/cash-registers'),
    select: (data) => (Array.isArray(data) ? data : data.items).filter((r) => r.active),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Session detail with reconciliation and movements. */
export function useSessionDetail(id: number | null, opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: cashKeys.detail(id ?? 0),
    queryFn: () => api.get<CashSessionRow>(`/cash-sessions/${id}`),
    enabled: id !== null,
    refetchInterval: opts.poll ? 10_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSessionList(params: CashSessionsQuery) {
  return useQuery({
    queryKey: qk.cashSessions(params),
    queryFn: () =>
      api.get<Paginated<CashSessionRow>>('/cash-sessions', {
        date_from: params.date_from,
        date_to: params.date_to,
        cash_register_id: params.cash_register_id,
        user_id: params.user_id,
        difference: params.difference === 'all' ? undefined : params.difference,
        page: params.page,
      }),
    placeholderData: (prev) => prev,
  });
}

/** After opening/closing: refresh the top-bar pill, history and reports. */
export function invalidateCash(qc: QueryClient): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['cash-sessions'] }),
    qc.invalidateQueries({ queryKey: qk.reportToday }),
  ]);
}
