import type { AuthUser } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserActionMenu } from './UserActionMenu';
import { roleLabel } from '@/lib/role-labels';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type UsersTableProps = {
  canAssignAdminRole: boolean;
  canDisableUsers: boolean;
  canUpdateUsers: boolean;
  currentUserId?: number;
  onlyActiveProtectedUserIds?: number[];
  onEdit: (user: AuthUser) => void;
  onResetPassword: (user: AuthUser) => void;
  onToggleActive: (user: AuthUser) => void;
  onViewDetail: (user: AuthUser) => void;
  searchTerm: string;
  users: AuthUser[];
};

export function UsersTable({
  canAssignAdminRole,
  canDisableUsers,
  canUpdateUsers,
  currentUserId,
  onlyActiveProtectedUserIds = [],
  onEdit,
  onResetPassword,
  onToggleActive,
  onViewDetail,
  searchTerm,
  users,
}: UsersTableProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const columns: Array<DataTableColumn<AuthUser>> = [
    {
      key: 'name',
      header: 'Usuario',
      headerClassName: 'w-[30%]',
      cellClassName: 'font-medium',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Usuario de acceso',
      render: (user) => <span className="font-mono text-xs">{user.username}</span>,
    },
    {
      key: 'roles',
      header: 'Rol',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && (
            <Badge variant="secondary" className="font-semibold text-muted-foreground">
              Sin rol
            </Badge>
          )}
          {user.roles.map((role) => {
            const label = roleLabel(role);

            return (
              <Badge
                key={role}
                variant={role === 'admin' ? 'destructive' : role === 'supervisor' ? 'default' : 'secondary'}
                className="font-semibold"
              >
                <span>{label}</span>
              </Badge>
            );
          })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (user) => (
        <StatusBadge status={user.active ? 'active' : 'closed'}>
          {user.active ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (user) => {
        const isCurrentUser = currentUserId !== undefined && user.id === currentUserId;
        const canManageProtectedTarget = !hasProtectedRole(user) || canAssignAdminRole;
        const isOnlyActiveProtectedUser = onlyActiveProtectedUserIds.includes(user.id);

        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              aria-label={`Ver detalle de ${user.name}`}
              onClick={() => onViewDetail(user)}
            >
              <Eye data-icon aria-hidden="true" />
              <span className="hidden xl:inline">Ver detalle</span>
            </Button>
            <UserActionMenu
              canDisableUsers={canDisableUsers && canManageProtectedTarget && !isCurrentUser && !isOnlyActiveProtectedUser}
              canResetPassword={canUpdateUsers && canManageProtectedTarget && !isCurrentUser}
              canUpdateUsers={canUpdateUsers && canManageProtectedTarget}
              onEdit={onEdit}
              onResetPassword={onResetPassword}
              onToggleActive={onToggleActive}
              user={user}
            />
          </div>
        );
      },
    },
  ];

  if (isMobile) {
    return (
      <ul className="grid gap-3" aria-label="Usuarios autorizados">
        {users.map((user) => {
          const capabilities = userActionCapabilities(user, {
            canAssignAdminRole,
            canDisableUsers,
            canUpdateUsers,
            currentUserId,
            onlyActiveProtectedUserIds,
          });
          return (
            <li key={user.id} className="rounded-md border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{user.username}</p>
                </div>
                <StatusBadge status={user.active ? 'active' : 'closed'}>
                  {user.active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {user.roles.length > 0 ? user.roles.map((role) => (
                  <Badge key={role} variant={role === 'admin' ? 'destructive' : 'secondary'}>{roleLabel(role)}</Badge>
                )) : <Badge variant="secondary">Sin rol</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" className="min-h-11" aria-label={`Ver detalle de ${user.name}`} onClick={() => onViewDetail(user)}>
                  <Eye data-icon aria-hidden="true" /> Ver detalle
                </Button>
                <UserActionMenu
                  canDisableUsers={capabilities.canDisable}
                  canResetPassword={capabilities.canReset}
                  canUpdateUsers={capabilities.canUpdate}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleActive={onToggleActive}
                  user={user}
                />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <DataTable
      containerLabel="Usuarios autorizados"
      rows={users}
      columns={columns}
      getRowKey={(user) => user.id}
      emptyTitle={searchTerm ? 'Sin coincidencias' : 'No hay usuarios cargados'}
      emptyDescription={searchTerm ? 'Ajuste la busqueda por nombre, correo o usuario.' : 'Cuando se creen usuarios autorizados apareceran en este directorio.'}
    />
  );
}

function hasProtectedRole(user: AuthUser): boolean {
  return user.roles.some((role) => ['admin', 'root'].includes(role.toLowerCase()));
}

function userActionCapabilities(user: AuthUser, options: {
  canAssignAdminRole: boolean;
  canDisableUsers: boolean;
  canUpdateUsers: boolean;
  currentUserId?: number;
  onlyActiveProtectedUserIds: number[];
}) {
  const isCurrentUser = options.currentUserId !== undefined && user.id === options.currentUserId;
  const canManageProtectedTarget = !hasProtectedRole(user) || options.canAssignAdminRole;
  const isOnlyActiveProtectedUser = options.onlyActiveProtectedUserIds.includes(user.id);
  return {
    canDisable: options.canDisableUsers && canManageProtectedTarget && !isCurrentUser && !isOnlyActiveProtectedUser,
    canReset: options.canUpdateUsers && canManageProtectedTarget && !isCurrentUser,
    canUpdate: options.canUpdateUsers && canManageProtectedTarget,
  };
}
