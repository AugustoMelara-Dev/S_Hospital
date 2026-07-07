import { Search } from 'lucide-react';
import { type AuthUser } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UsersTable } from './UsersTable';

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
  return (
    <>
      {readOnly && (
        <p className="text-sm text-muted-foreground">Solo lectura</p>
      )}

      <Card className="border border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="space-y-4 p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre, correo o usuario..."
              className="pl-9"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
        </CardContent>
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
            searchTerm={searchTerm}
            users={users}
          />
        </CardContent>
      </Card>
    </>
  );
}