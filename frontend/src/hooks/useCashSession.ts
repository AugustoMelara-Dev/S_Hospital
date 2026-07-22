import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
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
  const idempotencySignatureRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) => {
      const idempotencyKey = payloadScopedIdempotencyKey(idempotencyKeyRef, idempotencySignatureRef, payload);

      return apiClient.openCashSession(payload, {
        idempotencyKey,
      });
    },
    onSuccess: (opened) => {
      resetPayloadScopedIdempotencyKey(idempotencyKeyRef, idempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current('own'), opened);
      queryClient.setQueryData(queryKeys.cashSessions.current('closable'), opened);
      return invalidateBillingQueries(queryClient);
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencySignatureRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) => {
      const idempotencyKey = payloadScopedIdempotencyKey(idempotencyKeyRef, idempotencySignatureRef, { id, payload });

      return apiClient.closeCashSession(id, payload, {
        idempotencyKey,
      });
    },
    onSuccess: (closed) => {
      resetPayloadScopedIdempotencyKey(idempotencyKeyRef, idempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current('own'), null);
      queryClient.setQueryData(queryKeys.cashSessions.current('closable'), null);
      return invalidateBillingQueries(queryClient);
    },
  });
}
