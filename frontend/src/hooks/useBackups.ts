import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useBackups(filters: { page?: number; perPage?: number } = {}) {
  return useQuery({
    queryKey: ['backups', filters],
    queryFn: () => apiClient.getBackups(filters),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.createBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}