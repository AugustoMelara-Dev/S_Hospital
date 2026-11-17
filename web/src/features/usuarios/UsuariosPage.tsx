import { PageHeader, Tabs } from '@/ui';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';

export default function UsuariosPage() {
  return (
    <>
      <PageHeader title="Usuarios y permisos" description="Cuentas de acceso, roles y permisos por módulo." className="pb-3" />
      <Tabs
        label="Usuarios y roles"
        items={[
          { value: 'usuarios', label: 'Usuarios', content: <UsersTab /> },
          { value: 'roles', label: 'Roles', content: <RolesTab /> },
        ]}
      />
    </>
  );
}
