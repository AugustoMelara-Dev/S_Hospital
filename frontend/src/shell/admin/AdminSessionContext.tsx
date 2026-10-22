import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AuthUser, CashSession } from '@/lib/api';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

/**
 * Contexto de sesión para las superficies "Panel administrativo".
 *
 * Las vistas lazy de AppRoutes no reciben props; este contexto les entrega el
 * usuario, sus permisos, la sesión de caja vigente y el reporter de estado sin
 * volver a consultar/duplicar la sesión del backend.
 */
export type AdminSessionValue = {
  user: AuthUser;
  permissions: readonly string[];
  has: (permission: string) => boolean;
  cashSession: CashSession | null;
  cashSessionLoading: boolean;
  onStatus: OperationalStatusReporter;
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({
  user,
  cashSession,
  cashSessionLoading,
  onStatus,
  children,
}: {
  user: AuthUser;
  cashSession: CashSession | null;
  cashSessionLoading: boolean;
  onStatus: OperationalStatusReporter;
  children: ReactNode;
}) {
  const value = useMemo<AdminSessionValue>(() => {
    const granted = new Set(user.permissions);
    return {
      user,
      permissions: user.permissions,
      has: (permission: string) => granted.has(permission),
      cashSession,
      cashSessionLoading,
      onStatus,
    };
  }, [user, cashSession, cashSessionLoading, onStatus]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error('useAdminSession debe usarse dentro de <AdminSessionProvider>.');
  }
  return value;
}
