import { Search } from 'lucide-react';
import { useState } from 'react';
import { type AuthUser } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

      <Card className="overflow-hidden border border-operational-border bg-operational-surface shadow-operational">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Directorio de usuarios</h2>
            <p className="text-xs text-muted-foreground">Identidades, acceso y estado operativo de cada cuenta.</p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre, correo o usuario..."
              className="pl-9"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
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
        </CardContent>
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
