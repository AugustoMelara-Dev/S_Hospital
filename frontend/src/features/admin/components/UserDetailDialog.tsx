import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import type { AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';

type UserDetailDialogProps = {
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
};

export function UserDetailDialog({ onOpenChange, user }: UserDetailDialogProps) {
  return (
    <Dialog
      open={user !== null}
      onOpenChange={onOpenChange}
      title="Detalle de usuario"
      description="Cuenta, acceso operativo y estado actual."
    >
      {user ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-md border border-operational-border bg-operational-panel p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="break-words font-semibold text-foreground">{user.name}</p>
              <p className="break-all text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-operational-border p-3">
              <dt className="text-xs font-medium text-muted-foreground">Usuario de acceso</dt>
              <dd className="mt-1 break-all font-mono text-sm">{user.username}</dd>
            </div>
            <div className="rounded-md border border-operational-border p-3">
              <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
              <dd className="mt-1">
                <StatusBadge status={user.active ? 'active' : 'closed'}>
                  {user.active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
              </dd>
            </div>
            <div className="rounded-md border border-operational-border p-3 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Roles operativos</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {user.roles.length > 0
                  ? user.roles.map((role) => <Badge key={role} variant="secondary">{roleLabel(role)}</Badge>)
                  : <span className="text-sm text-muted-foreground">Sin rol asignado</span>}
              </dd>
            </div>
            <div className="rounded-md border border-operational-border p-3 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Acceso efectivo</dt>
              <dd className="mt-1 text-sm text-foreground">
                {user.permissions.length} permiso{user.permissions.length === 1 ? '' : 's'} habilitado{user.permissions.length === 1 ? '' : 's'} por el servidor.
              </dd>
              {user.must_change_password ? (
                <p className="mt-2 text-sm font-medium text-warning-foreground">Debe cambiar su contraseña en el próximo ingreso.</p>
              ) : null}
            </div>
          </dl>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
