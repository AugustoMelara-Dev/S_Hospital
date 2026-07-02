import { fireEvent, render, screen } from '@testing-library/react';
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

async function openUserActions(userName: string) {
  const trigger = await screen.findByRole('button', { name: new RegExp(`acciones de usuario ${userName}`, 'i') });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });
  fireEvent.click(trigger);
}

describe('UsersTable', () => {
  it('renders authorized row actions through the shared action menu', async () => {
    render(
      <UsersTable
        canDisableUsers
        canUpdateUsers
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        searchTerm=""
        users={[activeUser]}
      />,
    );

    await openUserActions('Caja Principal');

    expect(screen.queryByRole('button', { name: /editar usuario caja principal/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
  });

  it('does not render row actions for read-only operators', () => {
    render(
      <UsersTable
        canDisableUsers={false}
        canUpdateUsers={false}
        onEdit={vi.fn()}
        onResetPassword={vi.fn()}
        onToggleActive={vi.fn()}
        searchTerm=""
        users={[activeUser]}
      />,
    );

    expect(screen.getByText('Caja Principal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acciones de usuario caja principal/i })).not.toBeInTheDocument();
  });
});
