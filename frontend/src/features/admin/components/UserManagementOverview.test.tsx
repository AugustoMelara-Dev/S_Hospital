import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserManagementOverview } from './UserManagementOverview';

describe('UserManagementOverview', () => {
  it.each([
    [false, 'Roles en consulta', 'Roles editables'],
    [true, 'Roles editables', 'Roles en consulta'],
  ])('describes role capabilities when management permission is %s', (canManageRoles, label, unavailableLabel) => {
    render(
      <UserManagementOverview
        activeUsersCount={5}
        canManageRoles={canManageRoles}
        editableRolesCount={4}
        onCreateUser={vi.fn()}
        pendingPasswordUsersCount={0}
        showCreateAction={false}
        totalRolesCount={5}
        totalUsersCount={5}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5 roles en total.')).toBeInTheDocument();
    expect(screen.queryByText(unavailableLabel)).not.toBeInTheDocument();
  });
});
