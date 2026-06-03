import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { UsersView } from './UsersView';
import { apiClient, type AuthUser } from '../../lib/api';

describe('UsersView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getUsers').mockResolvedValue([adminUser()]);

    const { container } = render(
      <UsersView onStatus={vi.fn()} canCreateUsers />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Admin Hospital');
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

function adminUser(): AuthUser {
  return {
    id: 1,
    name: 'Admin Hospital',
    email: 'admin@hospital.test',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions: ['users.create', 'users.update'],
    must_change_password: false,
  };
}
