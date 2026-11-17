import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ShieldX } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';
import { Spinner } from '@/ui/Spinner';
import { useAuth, usePermissions, type PermissionQuery } from './hooks';

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-ink-3" role="status">
      <Spinner className="size-5" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Requires a session; enforces the forced password change. */
export function RequireAuth({ children, allowPasswordChange = false }: { children: ReactNode; allowPasswordChange?: boolean }) {
  const { me, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (me.must_change_password && !allowPasswordChange) return <Navigate to="/cambiar-clave" replace />;
  return <>{children}</>;
}

export function Forbidden() {
  return (
    <EmptyState
      icon={<ShieldX />}
      title="No tiene permiso para ver esta sección"
      description="Si necesita acceso, solicítelo a la administración del sistema."
    />
  );
}

/** Route guard: renders children only if the user has ANY of `perm`. */
export function RequirePermission({ perm, children }: { perm?: PermissionQuery; children: ReactNode }) {
  const { can } = usePermissions();
  if (perm && !can(perm)) return <Forbidden />;
  return <>{children}</>;
}

/** Conditional UI: `<Can perm="invoices.void"><Button…/></Can>`. */
export function Can({ perm, children, fallback = null }: { perm: PermissionQuery; children: ReactNode; fallback?: ReactNode }) {
  const { can } = usePermissions();
  return <>{can(perm) ? children : fallback}</>;
}
