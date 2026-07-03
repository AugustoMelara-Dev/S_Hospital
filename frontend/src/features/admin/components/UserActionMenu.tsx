import { KeyRound, Pencil, UserCheck, UserX } from 'lucide-react';
import { ActionMenu, type ActionMenuGroup } from '@/components/ui/action-menu';
import type { AuthUser } from '@/lib/api';

type UserActionMenuProps = {
  canDisableUsers: boolean;
  canResetPassword: boolean;
  canUpdateUsers: boolean;
  onEdit: (user: AuthUser) => void;
  onResetPassword: (user: AuthUser) => void;
  onToggleActive: (user: AuthUser) => void;
  user: AuthUser;
};

export function UserActionMenu({
  canDisableUsers,
  canResetPassword,
  canUpdateUsers,
  onEdit,
  onResetPassword,
  onToggleActive,
  user,
}: UserActionMenuProps) {
  const groups: ActionMenuGroup[] = [];

  const accountItems: ActionMenuGroup['items'] = [];

  if (canUpdateUsers) {
    accountItems.push({
      key: 'edit',
      label: 'Editar',
      icon: <Pencil aria-hidden="true" className="size-4" />,
      onSelect: () => onEdit(user),
    });
  }

  if (canResetPassword) {
    accountItems.push({
      key: 'reset-password',
      label: 'Restablecer clave',
      icon: <KeyRound aria-hidden="true" className="size-4" />,
      onSelect: () => onResetPassword(user),
    });
  }

  if (accountItems.length > 0) {
    groups.push({
      key: 'account',
      items: accountItems,
    });
  }

  if (canDisableUsers) {
    groups.push({
      key: 'access',
      items: [
        {
          key: user.active ? 'disable' : 'enable',
          label: user.active ? 'Desactivar' : 'Activar',
          icon: user.active
            ? <UserX aria-hidden="true" className="size-4" />
            : <UserCheck aria-hidden="true" className="size-4" />,
          destructive: user.active,
          onSelect: () => onToggleActive(user),
        },
      ],
    });
  }

  return (
    <ActionMenu
      ariaLabel={`Acciones de usuario ${user.name}`}
      groups={groups}
    />
  );
}
