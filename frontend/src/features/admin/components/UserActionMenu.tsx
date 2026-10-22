import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from 'lucide-react';
import { AdminMenuContent, AdminMenuItem, AdminMenuRoot, AdminMenuSeparator, AdminMenuTrigger } from '@/design-system/admin/AdminMenu';
import type { AuthUser } from '@/lib/api';
import { ICON_BUTTON } from '../adminUi';

type UserActionMenuProps = { canDisableUsers: boolean; canResetPassword: boolean; canUpdateUsers: boolean; onEdit: (user: AuthUser) => void; onResetPassword: (user: AuthUser) => void; onToggleActive: (user: AuthUser) => void; user: AuthUser };

export function UserActionMenu({ canDisableUsers, canResetPassword, canUpdateUsers, onEdit, onResetPassword, onToggleActive, user }: UserActionMenuProps) {
  if (!canUpdateUsers && !canResetPassword && !canDisableUsers) return null;
  return (
    <AdminMenuRoot>
      <AdminMenuTrigger asChild>
        <button type="button" data-ui-press className={ICON_BUTTON} aria-label={`Acciones de usuario ${user.name}`}>
          <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </AdminMenuTrigger>
      <AdminMenuContent>
          {canUpdateUsers ? <AdminMenuItem onSelect={() => onEdit(user)}><Pencil aria-hidden="true" />Editar</AdminMenuItem> : null}
          {canResetPassword ? <AdminMenuItem onSelect={() => onResetPassword(user)}><KeyRound aria-hidden="true" />Restablecer clave</AdminMenuItem> : null}
        {canDisableUsers ? (
          <>
            <AdminMenuSeparator />
              <AdminMenuItem destructive={user.active} onSelect={() => onToggleActive(user)}>
                {user.active ? <UserX aria-hidden="true" data-icon="inline-start" /> : <UserCheck aria-hidden="true" data-icon="inline-start" />}
                {user.active ? 'Desactivar' : 'Activar'}
              </AdminMenuItem>
          </>
        ) : null}
      </AdminMenuContent>
    </AdminMenuRoot>
  );
}
