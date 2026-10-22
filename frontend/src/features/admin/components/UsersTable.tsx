import { Eye } from 'lucide-react';
import {
  AdminEmpty,
  AdminTable,
  type AdminColumn,
} from '@/design-system/admin/components';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { ICON_BUTTON, SECONDARY_BUTTON } from '../adminUi';
import { UserActionMenu } from './UserActionMenu';

type UsersTableProps = { canAssignAdminRole: boolean; canDisableUsers: boolean; canUpdateUsers: boolean; currentUserId?: number; onlyActiveProtectedUserIds?: number[]; onEdit: (user: AuthUser) => void; onResetPassword: (user: AuthUser) => void; onToggleActive: (user: AuthUser) => void; onViewDetail: (user: AuthUser) => void; searchTerm: string; users: AuthUser[] };

export function UsersTable(props: UsersTableProps) {
  const { canAssignAdminRole, canDisableUsers, canUpdateUsers, currentUserId, onlyActiveProtectedUserIds = [], onEdit, onResetPassword, onToggleActive, onViewDetail, searchTerm, users } = props;
  const isMobile = useMediaQuery('(max-width: 767px)');
  const capabilitiesFor = (user: AuthUser) => userActionCapabilities(user, { canAssignAdminRole, canDisableUsers, canUpdateUsers, currentUserId, onlyActiveProtectedUserIds });
  const actions = (user: AuthUser, showLabel = false) => {
    const capabilities = capabilitiesFor(user);
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          data-ui-press
          className={showLabel ? SECONDARY_BUTTON : ICON_BUTTON}
          aria-label={`Ver detalle de ${user.name}`}
          onClick={() => onViewDetail(user)}
        >
          <Eye aria-hidden="true" className="size-4" strokeWidth={1.5} />{showLabel ? 'Ver detalle' : null}
        </button>
        <UserActionMenu canDisableUsers={capabilities.canDisable} canResetPassword={capabilities.canReset} canUpdateUsers={capabilities.canUpdate} onEdit={onEdit} onResetPassword={onResetPassword} onToggleActive={onToggleActive} user={user} />
      </div>
    );
  };

  const columns: Array<AdminColumn<AuthUser>> = [
    { key: 'name', header: 'Usuario', mobilePrimary: true, cell: (user) => <UserIdentity user={user} /> },
    { key: 'username', header: 'Usuario de acceso', cell: (user) => <span className="font-mono text-[length:var(--ui-text-xs)]">{user.username}</span> },
    { key: 'roles', header: 'Rol', cell: (user) => <RoleBadges user={user} /> },
    { key: 'status', header: 'Estado', cell: (user) => <ActiveState active={user.active} /> },
    { key: 'actions', header: 'Acciones', align: 'right', cell: (user) => actions(user) },
  ];

  const emptyTitle = searchTerm ? 'Sin coincidencias' : 'No hay usuarios cargados';
  const emptyDescription = searchTerm ? 'Ajuste la búsqueda por nombre, correo o usuario.' : 'Los usuarios autorizados aparecerán aquí.';

  if (isMobile) {
    return users.length === 0
      ? (
        <div role="status" aria-label="Usuarios autorizados" className="rounded-[var(--ui-radius)] border border-dashed border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] px-4 py-10 text-center">
          <p className="font-semibold text-[color:var(--ui-ink)]">{emptyTitle}</p>
          <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{emptyDescription}</p>
        </div>
      )
      : (
        <ul className="grid gap-3" aria-label="Usuarios autorizados">
          {users.map((user) => (
            <li key={user.id} className="flex flex-col gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[color:var(--ui-ink)] [overflow-wrap:anywhere] break-words">{user.name}</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] break-words">{user.email}</p>
                  <p className="mt-1 font-mono text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)] break-words">{user.username}</p>
                </div>
                <ActiveState active={user.active} />
              </div>
              <RoleBadges user={user} />
              {actions(user, true)}
            </li>
          ))}
        </ul>
      );
  }

  return (
    <AdminTable<AuthUser>
      caption="Directorio de usuarios autorizados"
      columns={columns}
      rows={users}
      getRowKey={(user) => String(user.id)}
      empty={(
        <AdminEmpty title={emptyTitle} description={emptyDescription} />
      )}
    />
  );
}

function UserIdentity({ user }: { user: AuthUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
        {user.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="font-semibold [overflow-wrap:anywhere] break-words">{user.name}</p>
        <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)] break-words">{user.email}</p>
      </div>
    </div>
  );
}

function ActiveState({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
      <span aria-hidden="true" className={active ? 'size-2 rounded-full bg-[var(--ui-success)]' : 'size-2 rounded-full bg-[var(--ui-line-strong)]'} />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function RoleBadges({ user }: { user: AuthUser }) { return <div className="flex flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <span key={role} className="inline-flex items-center rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]">{roleLabel(role)}</span>) : <span className="inline-flex items-center rounded-[var(--ui-radius)] border border-dashed border-[var(--ui-line-strong)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]">Sin rol</span>}</div>; }
function hasProtectedRole(user: AuthUser) { return user.roles.some((role) => ['admin', 'root'].includes(role.toLowerCase())); }
function userActionCapabilities(user: AuthUser, options: { canAssignAdminRole: boolean; canDisableUsers: boolean; canUpdateUsers: boolean; currentUserId?: number; onlyActiveProtectedUserIds: number[] }) {
  const isCurrentUser = options.currentUserId !== undefined && user.id === options.currentUserId;
  const canManageProtectedTarget = !hasProtectedRole(user) || options.canAssignAdminRole;
  const isOnlyActiveProtectedUser = options.onlyActiveProtectedUserIds.includes(user.id);
  return { canDisable: options.canDisableUsers && canManageProtectedTarget && !isCurrentUser && !isOnlyActiveProtectedUser, canReset: options.canUpdateUsers && canManageProtectedTarget && !isCurrentUser, canUpdate: options.canUpdateUsers && canManageProtectedTarget };
}
