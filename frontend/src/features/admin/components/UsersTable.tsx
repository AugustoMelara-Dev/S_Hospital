import type { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/design-system/patterns/DataTable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { UserActionMenu } from './UserActionMenu';

type UsersTableProps = { canAssignAdminRole: boolean; canDisableUsers: boolean; canUpdateUsers: boolean; currentUserId?: number; onlyActiveProtectedUserIds?: number[]; onEdit: (user: AuthUser) => void; onResetPassword: (user: AuthUser) => void; onToggleActive: (user: AuthUser) => void; onViewDetail: (user: AuthUser) => void; searchTerm: string; users: AuthUser[] };

export function UsersTable(props: UsersTableProps) {
  const { canAssignAdminRole, canDisableUsers, canUpdateUsers, currentUserId, onlyActiveProtectedUserIds = [], onEdit, onResetPassword, onToggleActive, onViewDetail, searchTerm, users } = props;
  const isMobile = useMediaQuery('(max-width: 767px)');
  const capabilitiesFor = (user: AuthUser) => userActionCapabilities(user, { canAssignAdminRole, canDisableUsers, canUpdateUsers, currentUserId, onlyActiveProtectedUserIds });
  const actions = (user: AuthUser, showLabel = false) => { const capabilities = capabilitiesFor(user); return <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" aria-label={`Ver detalle de ${user.name}`} onClick={() => onViewDetail(user)}><Eye data-icon="inline-start" />{showLabel ? 'Ver detalle' : null}</Button><UserActionMenu canDisableUsers={capabilities.canDisable} canResetPassword={capabilities.canReset} canUpdateUsers={capabilities.canUpdate} onEdit={onEdit} onResetPassword={onResetPassword} onToggleActive={onToggleActive} user={user} /></div>; };
  const columns: ColumnDef<AuthUser>[] = [
    { id: 'name', header: 'Usuario', accessorFn: (user) => user.name, cell: ({ row }) => <div className="flex items-center gap-3"><Avatar><AvatarFallback>{row.original.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div><p className="font-semibold">{row.original.name}</p><p className="text-xs text-muted-foreground">{row.original.email}</p></div></div> },
    { accessorKey: 'username', header: 'Usuario de acceso', cell: ({ row }) => <span className="font-mono text-xs">{row.original.username}</span> },
    { id: 'roles', header: 'Rol', accessorFn: (user) => user.roles.map(roleLabel).join(', '), cell: ({ row }) => <RoleBadges user={row.original} /> },
    { id: 'status', header: 'Estado', accessorFn: (user) => user.active ? 'Activo' : 'Inactivo', cell: ({ row }) => <Badge variant={row.original.active ? 'default' : 'secondary'}>{row.original.active ? 'Activo' : 'Inactivo'}</Badge> },
    { id: 'actions', header: 'Acciones', enableSorting: false, cell: ({ row }) => actions(row.original) },
  ];

  if (isMobile) return <ul className="grid gap-3" aria-label="Usuarios autorizados">{users.map((user) => <li key={user.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{user.name}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{user.username}</p></div><Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Activo' : 'Inactivo'}</Badge></div><RoleBadges user={user} />{actions(user, true)}</li>)}</ul>;

  return <DataTable ariaLabel="Usuarios autorizados" caption="Directorio de usuarios autorizados" columns={columns} data={users} getRowId={(user) => String(user.id)} emptyTitle={searchTerm ? 'Sin coincidencias' : 'No hay usuarios cargados'} emptyDescription={searchTerm ? 'Ajuste la búsqueda por nombre, correo o usuario.' : 'Los usuarios autorizados aparecerán aquí.'} />;
}

function RoleBadges({ user }: { user: AuthUser }) { return <div className="flex flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <Badge key={role} variant={role === 'supervisor' ? 'default' : 'secondary'}>{roleLabel(role)}</Badge>) : <Badge variant="outline">Sin rol</Badge>}</div>; }
function hasProtectedRole(user: AuthUser) { return user.roles.some((role) => ['admin', 'root'].includes(role.toLowerCase())); }
function userActionCapabilities(user: AuthUser, options: { canAssignAdminRole: boolean; canDisableUsers: boolean; canUpdateUsers: boolean; currentUserId?: number; onlyActiveProtectedUserIds: number[] }) {
  const isCurrentUser = options.currentUserId !== undefined && user.id === options.currentUserId;
  const canManageProtectedTarget = !hasProtectedRole(user) || options.canAssignAdminRole;
  const isOnlyActiveProtectedUser = options.onlyActiveProtectedUserIds.includes(user.id);
  return { canDisable: options.canDisableUsers && canManageProtectedTarget && !isCurrentUser && !isOnlyActiveProtectedUser, canReset: options.canUpdateUsers && canManageProtectedTarget && !isCurrentUser, canUpdate: options.canUpdateUsers && canManageProtectedTarget };
}
