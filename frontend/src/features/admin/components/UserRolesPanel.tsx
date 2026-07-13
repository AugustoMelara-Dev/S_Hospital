import { type PermissionCatalogGroup, type RoleDefinition } from '@/lib/api';
import { Alert, Button, Card, Tag } from 'antd';
import { roleLabel } from '@/lib/role-labels';
import { PermissionMatrix } from './PermissionMatrix';

type UserRolesPanelProps = {
  canAssignAdminRole: boolean;
  canManageRoles: boolean;
  onCreateRole: () => void;
  onEditRole: (role: RoleDefinition) => void;
  permissionCatalog: PermissionCatalogGroup[];
  roles: RoleDefinition[];
};

export function UserRolesPanel({
  canAssignAdminRole,
  canManageRoles,
  onCreateRole,
  onEditRole,
  permissionCatalog,
  roles,
}: UserRolesPanelProps) {
  if (!canManageRoles) {
    return (
      <Alert
        type="info"
        showIcon
        title="Roles en modo consulta"
        description="Su usuario puede revisar cuentas autorizadas, pero la asignacion directa de permisos requiere permiso de administracion de roles."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden border border-operational-border bg-operational-surface">
        <div className="border-b border-border bg-muted/40 p-5 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Roles y modulos</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Defina que modulos puede usar cada tipo de usuario. Los roles base protegidos se conservan para no perder acceso administrativo.
              </p>
            </div>
            <Button onClick={onCreateRole}>
              Nuevo rol
            </Button>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <article key={role.id} className="relative overflow-hidden border border-operational-border bg-white p-5 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-secondary/65">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{roleLabel(role.name)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Tag color={role.protected ? 'warning' : 'default'}>
                    {role.protected ? 'Base' : 'Editable'}
                  </Tag>
                </div>
                <Button
                  size="small"
                  className="mt-3 w-full"
                  onClick={() => onEditRole(role)}
                  disabled={role.protected}
                  aria-label={`Editar permisos de ${roleLabel(role.name)}`}
                >
                  Editar permisos
                </Button>
              </article>
            ))}
          </div>
        </div>
      </Card>

      {canAssignAdminRole && (
        <PermissionMatrix roles={roles} permissionCatalog={permissionCatalog} />
      )}
    </>
  );
}
