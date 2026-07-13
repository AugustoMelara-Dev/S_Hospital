import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/lib/api';
import { UsersTable } from './UsersTable';

const activeUser: AuthUser = {
  id: 1,
  name: 'Caja Principal',
  email: 'caja@hospital.test',
  username: 'caja',
  active: true,
  roles: ['cajero'],
  permissions: ['cash.view'],
  must_change_password: false,
};

const customRoleUser: AuthUser = {
  ...activeUser,
  id: 2,
  name: 'Catalogo Turno',
  email: 'catalogo@hospital.test',
  username: 'catalogo',
  roles: ['catalog_manager'],
};

const userWithoutRole: AuthUser = {
  ...activeUser,
  id: 3,
  name: 'Usuario Sin Rol',
  email: 'sinrol@hospital.test',
  username: 'sinrol',
  roles: [],
};

async function openUserActions(userName: string) {
  const user = userEvent.setup();
  const trigger = await screen.findByRole('button', { name: new RegExp(`acciones de usuario ${userName}`, 'i') });
  trigger.focus();
  await user.click(trigger);
}

describe('UsersTable', () => {
  it.each([320, 375])('renders an actionable mobile directory at %ipx without the desktop table', (width) => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('max-width') && width <= 767,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const onViewDetail = vi.fn();

    render(
      <UsersTable
        canAssignAdminRole={false}
        canDisableUsers
        canUpdateUsers
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        onViewDetail={onViewDetail}
        searchTerm=""
        users={[activeUser]}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /usuarios autorizados/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver detalle de caja principal/i }));
    expect(onViewDetail).toHaveBeenCalledWith(activeUser);
    expect(screen.getByRole('button', { name: /acciones de usuario caja principal/i })).toBeInTheDocument();
  });

  it('renders authorized row actions through the shared action menu', async () => {
    render(
      <UsersTable
        canAssignAdminRole={false}
        canDisableUsers
        canUpdateUsers
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        onViewDetail={vi.fn()}
        searchTerm=""
        users={[activeUser]}
      />,
    );

    await openUserActions('Caja Principal');

    expect(screen.queryByRole('button', { name: /editar usuario caja principal/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
  });

  it('does not render row actions for read-only operators', () => {
    render(
      <UsersTable
        canAssignAdminRole={false}
        canDisableUsers={false}
        canUpdateUsers={false}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        onViewDetail={vi.fn()}
        searchTerm=""
        users={[activeUser]}
      />,
    );

    expect(screen.getByText('Caja Principal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acciones de usuario caja principal/i })).not.toBeInTheDocument();
  });

  it('shows human role names without exposing technical role slugs', () => {
    render(
      <UsersTable
        canAssignAdminRole={false}
        canDisableUsers={false}
        canUpdateUsers={false}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        onViewDetail={vi.fn()}
        searchTerm=""
        users={[customRoleUser]}
      />,
    );

    expect(screen.getByText('Catalog Manager')).toBeInTheDocument();
    expect(screen.queryByText('catalog_manager')).not.toBeInTheDocument();
  });

  it('shows an explicit role fallback when a user has no assigned roles', () => {
    render(
      <UsersTable
        canAssignAdminRole={false}
        canDisableUsers={false}
        canUpdateUsers={false}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        onViewDetail={vi.fn()}
        searchTerm=""
        users={[userWithoutRole]}
      />,
    );

    expect(screen.getByText('Sin rol')).toBeInTheDocument();
  });
});
