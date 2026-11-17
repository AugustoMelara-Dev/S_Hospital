import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Branding } from '@/api/types';

/** Public institution branding (name, slogan, logo flag). Works before login. */
export function useBranding() {
  return useQuery({
    queryKey: qk.branding,
    queryFn: () => api.get<Branding>('/branding', undefined, { skipAuthRedirect: true }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
