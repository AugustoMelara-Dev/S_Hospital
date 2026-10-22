import { Plus } from 'lucide-react';

import { AdminCallout, AdminEmpty, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { ADMIN_TAG, SECONDARY_BUTTON } from '../adminUi';
import { PermissionMatrix } from './PermissionMatrix';

type UserRolesPanelProps = {
  canAssignAdminRole: boolean;
  canManageRoles: boolean;
  onCreateRole: () => void;
  onEditRole: (role: RoleDefinition) => void;
  permissionCatalog: PermissionCatalogGroup[];
  roles: RoleDefinition[];
};

export function UserRolesPanel({ canAssignAdminRole, canManageRoles, onCreateRole, onEditRole, permissionCatalog, roles }: UserRolesPanelProps) {
  if (!canManageRoles) {
    return (
      <AdminCallout tone="info" title="Roles en modo consulta">
        Su usuario puede revisar cuentas autorizadas, pero asignar permisos requiere administración de roles.
      </AdminCallout>
    );
  }

  return (
    <div className="grid gap-4">
      <AdminPanel as="section" aria-labelledby="user-roles-title">
        <AdminPanelHeader
          id="user-roles-title"
          title="Roles y módulos"
          description="Defina qué módulos puede usar cada tipo de usuario. Los roles base conservan el acceso administrativo."
          actions={(
            <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={onCreateRole}>
              <Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />Nuevo rol
            </button>
          )}
        />
        {roles.length === 0 ? (
          <div className="p-4">
            <AdminEmpty title="Sin roles" description="Cree el primer rol operativo para asignar módulos a las cuentas." />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--ui-line)]">
            {roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[color:var(--ui-ink)]">{roleLabel(role.name)}</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                    {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={ADMIN_TAG}>{role.protected ? 'Base' : 'Editable'}</span>
                  <button
                    type="button"
                    data-ui-press
                    className={SECONDARY_BUTTON}
                    onClick={() => onEditRole(role)}
                    disabled={role.protected}
                    aria-label={`Editar permisos de ${roleLabel(role.name)}`}
                  >
                    Editar permisos
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      {canAssignAdminRole ? <PermissionMatrix roles={roles} permissionCatalog={permissionCatalog} /> : null}
    </div>
  );
}
