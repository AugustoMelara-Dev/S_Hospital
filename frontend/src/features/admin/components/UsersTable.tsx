import type { AuthUser } from '@/lib/api';
import { Button, Tag } from 'antd';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
import { UserActionMenu } from './UserActionMenu';
import { roleLabel } from '@/lib/role-labels';
import { EyeOutlined as Eye } from '@ant-design/icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ICellRendererParams } from 'ag-grid-community';

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
  const columns: Array<InstitutionalColumn<AuthUser>> = [
    {
      colId: 'name',
      headerName: 'Usuario',
      flex: 2,
      minWidth: 240,
      cellRenderer: ({ data: user }: ICellRendererParams<AuthUser>) => user ? (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10 text-primary font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ) : null,
    },
    {
      colId: 'username',
      headerName: 'Usuario de acceso',
      valueGetter: ({ data }) => data?.username ?? '',
      cellRenderer: ({ data: user }: ICellRendererParams<AuthUser>) => user ? <span className="font-mono text-xs">{user.username}</span> : null,
    },
    {
      colId: 'roles',
      headerName: 'Rol',
      valueGetter: ({ data }) => data?.roles.map(roleLabel).join(', ') ?? '',
      cellRenderer: ({ data: user }: ICellRendererParams<AuthUser>) => user ? (
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && (
            <Tag>Sin rol</Tag>
          )}
          {user.roles.map((role) => {
            const label = roleLabel(role);

            return (
              <Tag
                key={role}
                color={role === 'supervisor' ? 'processing' : 'default'}
              >
                <span>{label}</span>
              </Tag>
            );
          })}
        </div>
      ) : null,
    },
    {
      colId: 'status',
      headerName: 'Estado',
      valueGetter: ({ data }) => data?.active ? 'Activo' : 'Inactivo',
      cellRenderer: ({ data: user }: ICellRendererParams<AuthUser>) => user ? (
        <Tag color={user.active ? 'success' : 'default'}>
          {user.active ? 'Activo' : 'Inactivo'}
        </Tag>
      ) : null,
    },
    {
      colId: 'actions',
      headerName: 'Acciones',
      sortable: false,
      filter: false,
      minWidth: 220,
      cellRenderer: ({ data: user }: ICellRendererParams<AuthUser>) => {
        if (!user) return null;
        const isCurrentUser = currentUserId !== undefined && user.id === currentUserId;
        const canManageProtectedTarget = !hasProtectedRole(user) || canAssignAdminRole;
        const isOnlyActiveProtectedUser = onlyActiveProtectedUserIds.includes(user.id);

        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="small"
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
            <li key={user.id} className="border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{user.username}</p>
                </div>
                <Tag color={user.active ? 'success' : 'default'}>
                  {user.active ? 'Activo' : 'Inactivo'}
                </Tag>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {user.roles.length > 0 ? user.roles.map((role) => (
                  <Tag key={role}>{roleLabel(role)}</Tag>
                )) : <Tag>Sin rol</Tag>}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button className="min-h-11" aria-label={`Ver detalle de ${user.name}`} onClick={() => onViewDetail(user)}>
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
    <InstitutionalDataGrid
      ariaLabel="Usuarios autorizados"
      regionAriaLabel="Directorio de usuarios autorizados"
      gridAriaLabel="Usuarios autorizados"
      rows={users}
      columns={columns}
      getRowId={(user) => String(user.id)}
      state={users.length > 0 ? 'ready' : 'empty'}
      emptyMessage={searchTerm ? 'Sin coincidencias. Ajuste la busqueda por nombre, correo o usuario.' : 'No hay usuarios cargados.'}
      gridOptions={{ rowSelection: undefined, pagination: false }}
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
