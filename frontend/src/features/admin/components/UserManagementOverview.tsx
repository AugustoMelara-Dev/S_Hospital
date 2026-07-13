import { TeamOutlined, UserAddOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Statistic, Tag } from 'antd';

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
    <Alert
      type="info"
      title={<h1>Usuarios y funciones</h1>}
      description={<><p>Administre cuentas individuales, roles operativos y permisos por modulo sin cambiar la politica de acceso del servidor.</p><Tag color="processing" icon={<TeamOutlined aria-hidden="true" />}>RBAC activo</Tag></>}
      action={showCreateAction ? <Button type="primary" icon={<UserAddOutlined aria-hidden="true" />} onClick={onCreateUser}>Crear usuario</Button> : undefined}
    />
    <div className="grid gap-3 sm:grid-cols-3">
      <Card title="Usuarios activos" extra={<TeamOutlined aria-hidden="true" />}><Statistic value={activeUsersCount} /><p>{totalUsersCount} cuenta{totalUsersCount === 1 ? '' : 's'} registrada{totalUsersCount === 1 ? '' : 's'}</p></Card>
      <Card title="Cambio pendiente"><Statistic value={pendingPasswordUsersCount} /><p>Usuarios que deberan cambiar clave al ingresar.</p></Card>
      <Card title="Roles editables" extra={<UserSwitchOutlined aria-hidden="true" />}><Statistic value={editableRolesCount} /><p>{totalRolesCount} rol{totalRolesCount === 1 ? '' : 'es'} disponible{totalRolesCount === 1 ? '' : 's'} en total.</p></Card>
    </div>
  </>;
}
