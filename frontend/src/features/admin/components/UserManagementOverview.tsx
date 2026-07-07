import { UserCog, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OperationalBanner, StatGrid } from '@/components/shared';

type UserManagementOverviewProps = {
  activeUsersCount: number;
  editableRolesCount: number;
  onCreateUser: () => void;
  pendingPasswordUsersCount: number;
  showCreateAction: boolean;
  totalRolesCount: number;
  totalUsersCount: number;
};

export function UserManagementOverview({
  activeUsersCount,
  editableRolesCount,
  onCreateUser,
  pendingPasswordUsersCount,
  showCreateAction,
  totalRolesCount,
  totalUsersCount,
}: UserManagementOverviewProps) {
  return (
    <>
      <OperationalBanner
        title="Usuarios y permisos"
        meta="Administracion segura"
        description="Administre cuentas individuales, roles operativos y permisos por modulo sin cambiar la politica de acceso del servidor."
        status={(
          <Badge variant="info">
            <Users data-icon aria-hidden="true" />
            RBAC activo
          </Badge>
        )}
        actions={showCreateAction ? (
          <Button onClick={onCreateUser}>
            <UserPlus data-icon aria-hidden="true" />
            Crear usuario
          </Button>
        ) : undefined}
      />

      <StatGrid
        className="xl:grid-cols-3"
        items={[
          {
            label: 'Usuarios activos',
            value: activeUsersCount,
            helper: `${totalUsersCount} cuenta${totalUsersCount === 1 ? '' : 's'} registrada${totalUsersCount === 1 ? '' : 's'}`,
            icon: <Users aria-hidden="true" className="size-4" />,
            tone: 'success',
          },
          {
            label: 'Cambio pendiente',
            value: pendingPasswordUsersCount,
            helper: 'Usuarios que deberan cambiar clave al ingresar.',
            tone: pendingPasswordUsersCount > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Roles editables',
            value: editableRolesCount,
            helper: `${totalRolesCount} rol${totalRolesCount === 1 ? '' : 'es'} disponible${totalRolesCount === 1 ? '' : 's'} en total.`,
            icon: <UserCog aria-hidden="true" className="size-4" />,
          },
        ]}
      />
    </>
  );
}