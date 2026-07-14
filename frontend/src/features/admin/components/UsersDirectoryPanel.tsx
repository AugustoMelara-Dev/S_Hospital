import { SearchOutlined as Search } from '@ant-design/icons';
import { useState } from 'react';
import { type AuthUser } from '@/lib/api';
import { Card, Input } from 'antd';
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
      {readOnly && (
        <p className="text-sm text-muted-foreground">Solo lectura</p>
      )}

      <Card className="overflow-hidden border border-operational-border bg-operational-surface">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Directorio de usuarios</h2>
            <p className="mt-1 text-sm text-muted-foreground">Identidades, acceso y estado operativo de cada cuenta.</p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Input
              prefix={<Search aria-hidden="true" />}
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre, correo o usuario..."
              className="min-h-12 pl-10"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
        </div>
        <div className="p-4 sm:p-5">
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
      </Card>
      <UserDetailDialog
        user={detailUser}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
      />
    </>
  );
}
