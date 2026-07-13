import { Button, Modal, Tag } from 'antd';
import { StatusTag } from '@/components/ui/status-tag';
import type { AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';

type UserDetailDialogProps = {
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
};

export function UserDetailDialog({ onOpenChange, user }: UserDetailDialogProps) {
  return (
    <Modal
      open={user !== null}
      onCancel={() => onOpenChange(false)}
      title="Detalle de usuario"
      footer={null}
      width={720}
      destroyOnHidden
    >
      <p>Cuenta, acceso operativo y estado actual.</p>
      {user ? (
        <div className="space-y-5">
          <div className="flex items-start gap-4 border border-operational-border bg-muted/40 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center bg-primary font-semibold text-white" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="break-words font-semibold text-foreground">{user.name}</p>
              <p className="break-all text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="border border-operational-border bg-white p-4">
              <dt className="text-xs font-medium text-muted-foreground">Usuario de acceso</dt>
              <dd className="mt-1 break-all font-mono text-sm">{user.username}</dd>
            </div>
            <div className="border border-operational-border bg-white p-4">
              <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
              <dd className="mt-1">
                <StatusTag kind={user.active ? 'success' : 'closed'}>
                  {user.active ? 'Activo' : 'Inactivo'}
                </StatusTag>
              </dd>
            </div>
            <div className="border border-operational-border bg-white p-4 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Roles operativos</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {user.roles.length > 0
                  ? user.roles.map((role) => <Tag key={role}>{roleLabel(role)}</Tag>)
                  : <span className="text-sm text-muted-foreground">Sin rol asignado</span>}
              </dd>
            </div>
            <div className="border border-operational-border bg-white p-4 sm:col-span-2">
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
            <Button onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
