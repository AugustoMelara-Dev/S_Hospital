import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

type UseCashSessionOptions = {
  enabled?: boolean;
};

export function useCashSession(options: UseCashSessionOptions | boolean = {}) {
  const enabled = typeof options === 'boolean' ? options : options.enabled ?? true;

  return useQuery({
    queryKey: queryKeys.cashSessions.current(),
    queryFn: () => apiClient.getCurrentCashSession(),
    enabled,
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) => {
      idempotencyKeyRef.current ??= createClientIdempotencyKey();

      return apiClient.openCashSession(payload, {
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      return invalidateBillingQueries(queryClient);
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) => {
      idempotencyKeyRef.current ??= createClientIdempotencyKey();

      return apiClient.closeCashSession(id, payload, {
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      return invalidateBillingQueries(queryClient);
    },
  });
}
