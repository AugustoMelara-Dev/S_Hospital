import { useState } from 'react';
import {
  AdminChip,
  AdminPanel,
  AdminPanelHeader,
  AdminSearch,
  AdminToolbar,
} from '@/design-system/admin/components';
import { type AuthUser } from '@/lib/api';
import { UsersTable } from './UsersTable';
import { UserDetailDialog } from './UserDetailDialog';

type UsersDirectoryPanelProps = {
  canAssignAdminRole: boolean;
  canDisableUsers: boolean;
  canUpdateUsers: boolean;
  currentUserId?: number;
  onEdit: (user: AuthUser) => void;
  onResetPassword: (user: AuthUser) => void;
  onSearchTermChange: (value: string) => void;
  onToggleActive: (user: AuthUser) => void;
  onlyActiveProtectedUserIds: number[];
  readOnly: boolean;
  searchTerm: string;
  users: AuthUser[];
};

/**
 * Directorio: una sola superficie con encabezado (título + búsqueda) y una
 * banda de trabajo con el conteo visible y el estado de permiso. La tabla no se
 * envuelve en tarjetas anidadas.
 */
export function UsersDirectoryPanel({
  canAssignAdminRole,
  canDisableUsers,
  canUpdateUsers,
  currentUserId,
  onEdit,
  onResetPassword,
  onSearchTermChange,
  onToggleActive,
  onlyActiveProtectedUserIds,
  readOnly,
  searchTerm,
  users,
}: UsersDirectoryPanelProps) {
  const [detailUser, setDetailUser] = useState<AuthUser | null>(null);

  return (
    <>
      <AdminPanel as="section" aria-labelledby="users-directory-title">
        <AdminPanelHeader
          id="users-directory-title"
          title="Directorio de usuarios"
          description="Identidades, acceso y estado operativo de cada cuenta."
          actions={(
            <AdminSearch
              id="users-search"
              label="Buscar usuarios"
              value={searchTerm}
              onValueChange={onSearchTermChange}
              placeholder="Buscar por nombre, correo o usuario..."
              className="w-full sm:max-w-md"
            />
          )}
        />
        <AdminToolbar className="justify-between border-b border-[var(--ui-line)] px-3 py-2">
          <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            {users.length} cuenta{users.length === 1 ? '' : 's'} visible{users.length === 1 ? '' : 's'}
          </span>
          {readOnly ? (
            <AdminChip tone="neutral">Solo lectura</AdminChip>
          ) : (
            <AdminChip tone="neutral">Edición autorizada</AdminChip>
          )}
        </AdminToolbar>
        <div className="p-3">
          <UsersTable
            canAssignAdminRole={canAssignAdminRole}
            canDisableUsers={canDisableUsers}
            canUpdateUsers={canUpdateUsers}
            currentUserId={currentUserId}
            onlyActiveProtectedUserIds={onlyActiveProtectedUserIds}
            onEdit={onEdit}
            onResetPassword={onResetPassword}
            onToggleActive={onToggleActive}
            onViewDetail={setDetailUser}
            searchTerm={searchTerm}
            users={users}
          />
        </div>
      </AdminPanel>
      <UserDetailDialog
        user={detailUser}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
      />
    </>
  );
}
