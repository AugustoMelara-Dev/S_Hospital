import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function shouldRetryOperationalQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && [401, 403, 419, 422, 429].includes(error.status)) {
    return false;
  }

  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: shouldRetryOperationalQuery,
    },
  },
});
