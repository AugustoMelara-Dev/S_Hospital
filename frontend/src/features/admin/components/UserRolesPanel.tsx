import { Info, Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
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

export function UserRolesPanel({ canAssignAdminRole, canManageRoles, onCreateRole, onEditRole, permissionCatalog, roles }: UserRolesPanelProps) {
  if (!canManageRoles) {
    return (
      <Alert>
        <Info />
        <AlertTitle>Roles en modo consulta</AlertTitle>
        <AlertDescription>
          Su usuario puede revisar cuentas autorizadas, pero asignar permisos requiere administración de roles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Roles y módulos</CardTitle>
            <CardDescription>
              Defina qué módulos puede usar cada tipo de usuario. Los roles base conservan el acceso administrativo.
            </CardDescription>
          </div>
          <Button onClick={onCreateRole}>
            <Plus data-icon="inline-start" />
            Nuevo rol
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <article key={role.id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{roleLabel(role.name)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Badge variant={role.protected ? 'secondary' : 'outline'}>{role.protected ? 'Base' : 'Editable'}</Badge>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onEditRole(role)}
                disabled={role.protected}
                aria-label={`Editar permisos de ${roleLabel(role.name)}`}
              >
                Editar permisos
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>

      {canAssignAdminRole ? <PermissionMatrix roles={roles} permissionCatalog={permissionCatalog} /> : null}
    </div>
  );
}
