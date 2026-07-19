import { ShieldCheck, UserPlus, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/design-system/components/PageHeader';

type Props = { activeUsersCount: number; editableRolesCount: number; onCreateUser: () => void; pendingPasswordUsersCount: number; showCreateAction: boolean; totalRolesCount: number; totalUsersCount: number };

export function UserManagementOverview({ activeUsersCount, editableRolesCount, onCreateUser, pendingPasswordUsersCount, showCreateAction, totalRolesCount, totalUsersCount }: Props) {
  const stats = [
    { title: 'Usuarios activos', value: activeUsersCount, description: `${totalUsersCount} cuenta${totalUsersCount === 1 ? '' : 's'} registrada${totalUsersCount === 1 ? '' : 's'}`, icon: Users },
    { title: 'Cambio pendiente', value: pendingPasswordUsersCount, description: 'Usuarios que deberán cambiar clave al ingresar.', icon: ShieldCheck },
    { title: 'Roles editables', value: editableRolesCount, description: `${totalRolesCount} rol${totalRolesCount === 1 ? '' : 'es'} disponible${totalRolesCount === 1 ? '' : 's'} en total.`, icon: UsersRound },
  ];
  return <><PageHeader title="Usuarios y funciones" description="Administre cuentas individuales, roles operativos y permisos por módulo sin cambiar la política de acceso del servidor." actions={<div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><ShieldCheck />RBAC activo</Badge>{showCreateAction ? <Button onClick={onCreateUser}><UserPlus data-icon="inline-start" />Crear usuario</Button> : null}</div>} />
    <div className="grid gap-3 sm:grid-cols-3">{stats.map(({ title, value, description, icon: Icon }) => <Card key={title} size="sm"><CardHeader className="flex-row items-center justify-between"><CardDescription>{title}</CardDescription><Icon aria-hidden="true" /></CardHeader><CardContent><CardTitle className="text-2xl tabular-nums">{value}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{description}</p></CardContent></Card>)}</div>
  </>;
}
