import { PageHeader, Tabs } from '@/ui';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';

export default function UsuariosPage() {
  return (
    <>
      <PageHeader eyebrow="Administración" title="Usuarios y permisos" description="Cuentas de acceso, roles y permisos por módulo." />
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
