import type { AuthUser } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserActionMenu } from './UserActionMenu';
import { roleLabel } from './roleLabels';

type UsersTableProps = {
  canDisableUsers: boolean;
  canUpdateUsers: boolean;
  onEdit: (user: AuthUser) => void;
  onResetPassword: (user: AuthUser) => void;
  onToggleActive: (user: AuthUser) => void;
  searchTerm: string;
  users: AuthUser[];
};

export function UsersTable({
  canDisableUsers,
  canUpdateUsers,
  onEdit,
  onResetPassword,
  onToggleActive,
  searchTerm,
  users,
}: UsersTableProps) {
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
          {user.roles.map((role) => {
            const label = roleLabel(role);
            const showTechnicalName = label !== role;

            return (
              <Badge
                key={role}
                variant={role === 'admin' ? 'destructive' : role === 'supervisor' ? 'default' : 'secondary'}
                className="font-semibold"
              >
                <span>{label}</span>
                {showTechnicalName && (
                  <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground">
                    {role}
                  </span>
                )}
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
      render: (user) => (
        <UserActionMenu
          canDisableUsers={canDisableUsers}
          canUpdateUsers={canUpdateUsers}
          onEdit={onEdit}
          onResetPassword={onResetPassword}
          onToggleActive={onToggleActive}
          user={user}
        />
      ),
    },
  ];

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
