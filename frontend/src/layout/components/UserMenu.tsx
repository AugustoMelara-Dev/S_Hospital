import React, { useState } from 'react';
import { DownOutlined, LogoutOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps } from 'antd';
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
        <div className="border-b border-border pb-2 text-xs" style={{ minWidth: '180px' }}>
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
      label: 'Cerrar sesion',
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
      <button
        type="button"
        className="flex items-center gap-2 border border-border bg-white px-2 py-1.5 text-foreground hover:border-primary/45 cursor-pointer outline-none transition"
        aria-label="Abrir menu de usuario"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDropdownOpen((prev) => !prev);
          }
        }}
      >
        <div className="flex size-8 items-center justify-center bg-primary text-xs font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden max-w-[10rem] truncate text-xs lg:inline" title={user.name}>
          {user.name}
        </span>
        <DownOutlined className="text-[10px] text-muted-foreground" aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
