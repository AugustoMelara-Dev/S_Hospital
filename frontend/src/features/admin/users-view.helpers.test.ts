import { describe, expect, it } from 'vitest';
import { buildCreateUserPayload, buildUpdateUserPayload } from './users-view.helpers';

const formData = {
  name: 'Ana Caja',
  email: 'ana@example.test',
  username: 'ana.caja',
  password: 'Temporal123!',
  role: 'cajero',
};

describe('users view payload helpers', () => {
  it('builds a create payload with the operational user defaults', () => {
    expect(buildCreateUserPayload(formData, ['cash.view'], false)).toEqual({
      name: 'Ana Caja',
      email: 'ana@example.test',
      username: 'ana.caja',
      password: 'Temporal123!',
      role: 'cajero',
      active: true,
    });
  });

  it('builds an update payload without password or active status fields', () => {
    expect(buildUpdateUserPayload(formData, ['cash.view'], false)).toEqual({
      name: 'Ana Caja',
      email: 'ana@example.test',
      username: 'ana.caja',
      role: 'cajero',
    });
  });

  it('only sends visible direct permissions in advanced mode', () => {
    const permissions = ['reports.view', 'cash.view', 'backups.restore', 'cash.view'];

    expect(buildCreateUserPayload(formData, permissions, true)).toMatchObject({
      permissions: ['cash.view'],
    });
    expect(buildUpdateUserPayload(formData, permissions, true)).toMatchObject({
      permissions: ['cash.view'],
    });
    expect(buildCreateUserPayload(formData, permissions, false)).not.toHaveProperty('permissions');
    expect(buildUpdateUserPayload(formData, permissions, false)).not.toHaveProperty('permissions');
  });
});
