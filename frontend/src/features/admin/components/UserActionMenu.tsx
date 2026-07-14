import { KeyOutlined as KeyRound, EditOutlined as Pencil, MoreOutlined, UserSwitchOutlined as UserCheck, UserDeleteOutlined as UserX } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
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
  const items: MenuProps['items'] = [];

  if (canUpdateUsers) {
    items.push({
      key: 'edit',
      label: 'Editar',
      icon: <Pencil aria-hidden="true" className="size-4" />,
      onClick: () => onEdit(user),
    });
  }

  if (canResetPassword) {
    items.push({
      key: 'reset-password',
      label: 'Restablecer clave',
      icon: <KeyRound aria-hidden="true" className="size-4" />,
      onClick: () => onResetPassword(user),
    });
  }

  if (canDisableUsers) {
    if (items.length > 0) items.push({ type: 'divider' });
    items.push({
      key: user.active ? 'disable' : 'enable',
      label: user.active ? 'Desactivar' : 'Activar',
      icon: user.active
        ? <UserX aria-hidden="true" className="size-4" />
        : <UserCheck aria-hidden="true" className="size-4" />,
      danger: user.active,
      onClick: () => onToggleActive(user),
    });
  }

  if (items.length === 0) return null;

  return <Dropdown menu={{ items }} trigger={['click']}>
    <Button aria-label={`Acciones de usuario ${user.name}`} icon={<MoreOutlined aria-hidden="true" />} />
  </Dropdown>;
}
