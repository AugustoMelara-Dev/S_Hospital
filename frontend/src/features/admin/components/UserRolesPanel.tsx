import { type PermissionCatalogGroup, type RoleDefinition } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PermissionState } from '@/components/shared';
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
      <PermissionState
        state="readonly"
        className="mb-6"
        title="Roles en modo consulta"
        description="Su usuario puede revisar cuentas autorizadas, pero la asignacion directa de permisos requiere permiso de administracion de roles."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden border border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Roles y modulos</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Defina que modulos puede usar cada tipo de usuario. Los roles base protegidos se conservan para no perder acceso administrativo.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onCreateRole}>
              Nuevo rol
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <div key={role.id} className="relative overflow-hidden rounded-xl border border-operational-border bg-operational-panel/45 p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary/65">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{roleLabel(role.name)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge variant={role.protected ? 'warning' : 'secondary'}>
                    {role.protected ? 'Base' : 'Editable'}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onEditRole(role)}
                  disabled={role.protected}
                  aria-label={`Editar permisos de ${roleLabel(role.name)}`}
                >
                  Editar permisos
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canAssignAdminRole && (
        <PermissionMatrix roles={roles} permissionCatalog={permissionCatalog} />
      )}
    </>
  );
}
