import { useState } from 'react';
import { DownOutlined, LogoutOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { type AuthUser } from '../../lib/api';

type UserMenuProps = {
  hospitalName: string;
  onLogout: () => void;
  onOpenGuide: () => void;
  roleLabel: string;
  user: AuthUser;
};

export function UserMenu({
  hospitalName,
  onLogout,
  onOpenGuide,
  roleLabel,
  user,
}: UserMenuProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const menuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="min-w-44 border-b border-border pb-2 text-xs">
          <p className="font-semibold text-foreground">{user.name}</p>
          <p className="truncate font-medium text-secondary" title={roleLabel}>
            {roleLabel}
          </p>
          <p className="truncate text-muted-foreground" title={hospitalName}>
            {hospitalName}
          </p>
        </div>
      ),
      type: 'group',
    },
    {
      key: 'help',
      label: 'Ayuda',
      icon: <QuestionCircleOutlined />,
      onClick: () => {
        onOpenGuide();
        setDropdownOpen(false);
      },
      className: 'sm:hidden',
    },
    {
      type: 'divider',
      className: 'sm:hidden',
    },
    {
      key: 'logout',
      label: 'Cerrar sesión',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        onLogout();
        setDropdownOpen(false);
      },
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
    >
      <Button
        htmlType="button"
        type="default"
        className="flex cursor-pointer items-center gap-2 border border-border bg-surface px-2 py-1.5 text-foreground outline-none transition hover:border-primary"
        aria-label="Abrir menu de usuario"
      >
        <span className="flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-40 truncate text-xs lg:inline" title={user.name}>
          {user.name}
        </span>
        <DownOutlined className="text-xs text-muted-foreground" aria-hidden="true" />
      </Button>
    </Dropdown>
  );
}
