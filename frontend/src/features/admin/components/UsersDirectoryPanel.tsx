import { Search } from 'lucide-react';
import { useState } from 'react';
import { type AuthUser } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle><h2>Directorio de usuarios</h2></CardTitle>
            <CardDescription>Identidades, acceso y estado operativo de cada cuenta.</CardDescription>
          </div>
          <div className="relative w-full sm:max-w-md">
            <Input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre, correo o usuario..."
              className="min-h-12 pl-10"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
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
