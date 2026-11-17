import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          // Never retry client errors (auth, permission, validation, not found).
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/** Shared query keys so features invalidate consistently. */
export const qk = {
  me: ['auth', 'me'] as const,
  branding: ['branding'] as const,
  currentCash: ['cash-sessions', 'current'] as const,
  cashSessions: (params?: object) => ['cash-sessions', 'list', params ?? {}] as const,
  invoices: (params?: object) => ['invoices', 'list', params ?? {}] as const,
  invoice: (id: number) => ['invoices', 'detail', id] as const,
  reportToday: ['reports', 'today'] as const,
  settings: ['settings'] as const,
  services: (params?: object) => ['services', params ?? {}] as const,
  categories: ['categories'] as const,
  areas: ['areas'] as const,
};
