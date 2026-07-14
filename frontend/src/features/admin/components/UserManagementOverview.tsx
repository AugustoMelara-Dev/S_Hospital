import { TeamOutlined, UserAddOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { Button, Card, Statistic, Tag } from 'antd';
import { PageHeader } from '@/design-system/components/PageHeader';

type UserManagementOverviewProps = {
  activeUsersCount: number;
  editableRolesCount: number;
  onCreateUser: () => void;
  pendingPasswordUsersCount: number;
  showCreateAction: boolean;
  totalRolesCount: number;
  totalUsersCount: number;
};

export function UserManagementOverview({ activeUsersCount, editableRolesCount, onCreateUser, pendingPasswordUsersCount, showCreateAction, totalRolesCount, totalUsersCount }: UserManagementOverviewProps) {
  return <>
    <PageHeader
      title="Usuarios y funciones"
      description="Administre cuentas individuales, roles operativos y permisos por módulo sin cambiar la política de acceso del servidor."
      actions={<><Tag color="processing" icon={<TeamOutlined aria-hidden="true" />}>RBAC activo</Tag>{showCreateAction ? <Button type="primary" icon={<UserAddOutlined aria-hidden="true" />} onClick={onCreateUser}>Crear usuario</Button> : null}</>}
    />
    <div className="grid gap-3 sm:grid-cols-3">
      <Card title="Usuarios activos" extra={<TeamOutlined aria-hidden="true" />}><Statistic value={activeUsersCount} /><p>{totalUsersCount} cuenta{totalUsersCount === 1 ? '' : 's'} registrada{totalUsersCount === 1 ? '' : 's'}</p></Card>
      <Card title="Cambio pendiente"><Statistic value={pendingPasswordUsersCount} /><p>Usuarios que deberan cambiar clave al ingresar.</p></Card>
      <Card title="Roles editables" extra={<UserSwitchOutlined aria-hidden="true" />}><Statistic value={editableRolesCount} /><p>{totalRolesCount} rol{totalRolesCount === 1 ? '' : 'es'} disponible{totalRolesCount === 1 ? '' : 's'} en total.</p></Card>
    </div>
  </>;
}
