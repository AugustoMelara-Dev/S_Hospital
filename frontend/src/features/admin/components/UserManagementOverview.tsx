import { ShieldCheck, UserPlus } from 'lucide-react';
import { AdminChip, AdminPageHeader, AdminStat, AdminStatBand } from '@/design-system/admin/components';
import { PRIMARY_BUTTON } from '../adminUi';

type Props = { activeUsersCount: number; canManageRoles: boolean; editableRolesCount: number; onCreateUser: () => void; pendingPasswordUsersCount: number; showCreateAction: boolean; totalRolesCount: number; totalUsersCount: number };

/**
 * Cabecera del directorio de usuarios: título y propósito, marca de política de
 * acceso y la acción de alta; debajo, una única banda de indicadores con
 * divisores (no tres tarjetas). El conteo de roles vive en el pie de su
 * indicador, no en párrafos separados.
 */
export function UserManagementOverview({ activeUsersCount, canManageRoles, editableRolesCount, onCreateUser, pendingPasswordUsersCount, showCreateAction, totalRolesCount, totalUsersCount }: Props) {
  const usersHint = `${totalUsersCount} cuenta${totalUsersCount === 1 ? '' : 's'} registrada${totalUsersCount === 1 ? '' : 's'}`;
  const rolesHint = `${totalRolesCount} rol${totalRolesCount === 1 ? '' : 'es'} en total.`;

  return (
    <section aria-labelledby="users-overview-title" className="flex flex-col gap-3">
      <AdminPageHeader
        headingId="users-overview-title"
        title="Usuarios y roles"
        description="Administre cuentas, accesos y permisos del personal."
        meta={
          <AdminChip tone="accent">
            <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.5} />Permisos por módulo
          </AdminChip>
        }
        actions={showCreateAction ? (
            <button type="button" data-ui-press className={PRIMARY_BUTTON} onClick={onCreateUser}>
              <UserPlus aria-hidden="true" className="size-4" strokeWidth={1.5} />Crear usuario
            </button>
          ) : null}
      />

      <AdminStatBand columns={3}>
        <AdminStat label="Usuarios activos" value={activeUsersCount} hint={usersHint} />
        <AdminStat label="Cambio pendiente" value={pendingPasswordUsersCount} hint="Usuarios que deberán cambiar clave al ingresar." />
        <AdminStat label={canManageRoles ? 'Roles editables' : 'Roles en consulta'} value={editableRolesCount} hint={rolesHint} />
      </AdminStatBand>
    </section>
  );
}
