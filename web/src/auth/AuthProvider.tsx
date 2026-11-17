import { createContext, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { api, isApiError, setApiHandlers } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { LoginRequest, Me } from '@/api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  me: Me | null;
  status: AuthStatus;
  login: (input: LoginRequest) => Promise<Me>;
  logout: () => Promise<void>;
  /** Re-reads GET /api/auth/me (e.g. after changing the password). */
  refresh: () => Promise<Me | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<Me | null> {
  try {
    return await api.get<Me>('/auth/me', undefined, { skipAuthRedirect: true });
  } catch (e) {
    if (isApiError(e) && e.status === 401) return null;
    throw e;
  }
}

/** Where a user lands after login (TERMINOLOGIA: cajero → /cobrar). */
export function landingPath(me: Pick<Me, 'role' | 'permissions'>): string {
  if (me.role.code === 'cajero' && me.permissions.includes('invoices.create')) return '/cobrar';
  return '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const query = useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 60_000, retry: 1 });

  const goLogin = useCallback(() => {
    qc.setQueryData(qk.me, null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'branding' });
    if (location.pathname !== '/login') {
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
    }
  }, [qc, navigate, location.pathname, location.search]);

  useEffect(() => {
    setApiHandlers({
      onUnauthorized: goLogin,
      onPasswordChangeRequired: () => {
        void qc.invalidateQueries({ queryKey: qk.me });
        navigate('/cambiar-clave', { replace: true });
      },
    });
  }, [goLogin, navigate, qc]);

  const login = useCallback(
    async (input: LoginRequest) => {
      const me = await api.post<Me>('/auth/login', input, { skipAuthRedirect: true });
      qc.setQueryData(qk.me, me);
      return me;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { skipAuthRedirect: true });
    } catch {
      /* session may already be gone; leave anyway */
    }
    qc.clear();
    qc.setQueryData(qk.me, null);
    navigate('/login', { replace: true });
  }, [qc, navigate]);

  const { refetch } = query;
  const refresh = useCallback(async () => {
    const res = await refetch();
    return res.data ?? null;
  }, [refetch]);

  const value = useMemo<AuthContextValue>(() => {
    const me = query.data ?? null;
    const status: AuthStatus = query.isPending ? 'loading' : me ? 'authenticated' : 'anonymous';
    return { me, status, login, logout, refresh };
  }, [query.data, query.isPending, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
