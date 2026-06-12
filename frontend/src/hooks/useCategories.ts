import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { invalidateCatalogQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';

export function useCategories(active?: boolean) {
  return useQuery({
    queryKey: queryKeys.categories.list(active),
    queryFn: () => apiClient.getCategories(active),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof apiClient.saveCategory>[0]) => apiClient.saveCategory(payload),
    onSuccess: () => {
      return invalidateCatalogQueries(queryClient);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof apiClient.saveCategory>[0] }) =>
      apiClient.saveCategory(payload, id),
    onSuccess: () => {
      return invalidateCatalogQueries(queryClient);
    },
  });
}
