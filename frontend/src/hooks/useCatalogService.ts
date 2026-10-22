import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useCatalogService(id: number | null) {
  return useQuery({
    queryKey: ['services', 'detail', id ?? 'none'],
    queryFn: () => apiClient.getService(id as number),
    enabled: id !== null,
  });
}

export function useCatalogServiceHistory(id: number | null, open: boolean, page = 1) {
  return useQuery({
    queryKey: ['services', 'history', id ?? 'none', page],
    queryFn: () => apiClient.getServiceHistory(id as number, page),
    enabled: open && id !== null,
  });
}
