import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserCog, UserPlus, Users } from 'lucide-react';
import {
  type AuthUser,
  type PermissionCatalogGroup,
  type RoleDefinition,
  type UserPayload,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Input } from '@/components/ui/input';
import { OperationalBanner, PermissionState, StatGrid } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserFormDialog, roleLabel, type UserFormData } from './components/UserFormDialog';
import { RoleFormDialog } from './components/RoleFormDialog';
import { PasswordResetDialog } from './components/PasswordResetDialog';

type UsersViewProps = {
  onStatus: (message: string) => void;
  canCreateUsers: boolean;
  canUpdateUsers?: boolean;
  canDisableUsers?: boolean;
  canManageRoles: boolean;
};

export function UsersView({
  onStatus,
  canCreateUsers,
  canUpdateUsers = false,
  canDisableUsers = false,
  canManageRoles,
}: UsersViewProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [formGlobalError, setFormGlobalError] = useState('');

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleGlobalError, setRoleGlobalError] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const saveRoleInFlightRef = useRef(false);

  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<AuthUser | null>(null);
  const [resetGlobalError, setResetGlobalError] = useState('');

  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [targetToggleUser, setTargetToggleUser] = useState<AuthUser | null>(null);
  const [isTogglingUser, setIsTogglingUser] = useState(false);
  const toggleUserInFlightRef = useRef(false);

  const defaultRoleName = useCallback(() => {
    return roles.find((role) => role.name === 'cajero')?.name
      ?? roles.find((role) => !role.protected)?.name
      ?? roles[0]?.name
      ?? 'cajero';
  }, [roles]);

  const permissionsForRole = useCallback((roleNameValue: string) => {
    return roles
      .find((role) => role.name === roleNameValue)
      ?.permissions
      .map((permission) => permission.name)
      .sort() ?? [];
  }, [roles]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, roleData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getRoles(),
      ]);
      setUsers(data);
      setRoles(roleData.roles);
      setPermissionCatalog(roleData.permissionCatalog);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudieron cargar los usuarios.');
      setLoadError(msg);
      onStatus(msg);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(term)
      || user.username.toLowerCase().includes(term)
      || user.email.toLowerCase().includes(term)
    );
  }), [users, searchTerm]);

  const activeUsersCount = users.filter((user) => user.active).length;
  const pendingPasswordUsersCount = users.filter((user) => user.must_change_password).length;
  const editableRolesCount = roles.filter((role) => !role.protected).length;

  const handleOpenCreateModal = () => {
    const role = defaultRoleName();
    setEditingUser(null);
    setSelectedUserPermissions(canManageRoles ? permissionsForRole(role) : []);
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName('');
    setSelectedPermissions([]);
    setRoleGlobalError('');
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: RoleDefinition) => {
    setEditingRole(role);
    setRoleName(role.name);
    setSelectedPermissions(role.permissions.map((permission) => permission.name));
    setRoleGlobalError('');
    setIsRoleModalOpen(true);
  };

  const togglePermission = (permissionName: string, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) {
        return current.includes(permissionName) ? current : [...current, permissionName].sort();
      }
      return current.filter((name) => name !== permissionName);
    });
  };

  const toggleUserPermission = (permissionName: string, checked: boolean) => {
    setSelectedUserPermissions((current) => {
      if (checked) {
        return current.includes(permissionName) ? current : [...current, permissionName].sort();
      }
      return current.filter((name) => name !== permissionName);
    });
  };

  const handleRoleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoleGlobalError('');

    const normalizedName = roleName.trim();
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(normalizedName)) {
      setRoleGlobalError('Use un nombre de rol entre 3 y 80 caracteres, solo letras, numeros, _ o -.');
      return;
    }
    if (selectedPermissions.length === 0) {
      setRoleGlobalError('Seleccione al menos un permiso para el rol.');
      return;
    }
    if (saveRoleInFlightRef.current) return;

    saveRoleInFlightRef.current = true;
    setIsSavingRole(true);
    onStatus(editingRole ? 'Actualizando rol...' : 'Creando rol...');

    try {
      const saved = editingRole
        ? await apiClient.updateRole(editingRole.id, { name: normalizedName, permissions: selectedPermissions })
        : await apiClient.createRole({ name: normalizedName, permissions: selectedPermissions });

      setRoles((current) => {
        const exists = current.some((role) => role.id === saved.id);
        return (exists ? current.map((role) => (role.id === saved.id ? saved : role)) : [...current, saved])
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsRoleModalOpen(false);
      onStatus(`Rol ${saved.name} ${editingRole ? 'actualizado' : 'creado'} correctamente.`);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo guardar el rol.');
      setRoleGlobalError(msg);
      onStatus(msg);
    } finally {
      saveRoleInFlightRef.current = false;
      setIsSavingRole(false);
    }
  };

  const handleOpenEditModal = (user: AuthUser) => {
    setEditingUser(user);
    setSelectedUserPermissions(canManageRoles
      ? (user.uses_exact_permission_map
        ? [...(user.direct_permissions ?? [])].sort()
        : permissionsForRole(user.roles[0] || defaultRoleName()))
      : []);
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };

  const onUserSubmit = async (data: UserFormData) => {
    setFormGlobalError('');

    if (canManageRoles && selectedUserPermissions.length === 0 && editingUser?.active !== false) {
      const msg = 'Seleccione al menos un modulo para un usuario activo, o desactive el usuario antes de dejarlo sin acceso.';
      setFormGlobalError(msg);
      onStatus(msg);
      return;
    }

    onStatus('Guardando usuario...');
    try {
      if (editingUser) {
        const payload: Omit<UserPayload, 'password'> = {
          name: data.name,
          email: data.email,
          username: data.username,
          role: data.role,
        };
        if (canManageRoles) {
          payload.permissions = selectedUserPermissions;
        }
        const updated = await apiClient.updateUser(editingUser.id, payload);
        setUsers((current) => current.map((u) => (u.id === editingUser.id ? updated : u)));
        onStatus(`Usuario ${updated.name} actualizado correctamente.`);
      } else {
        const payload: UserPayload = {
          name: data.name,
          email: data.email,
          username: data.username,
          password: data.password || '',
          role: data.role,
          active: true,
        };
        if (canManageRoles) {
          payload.permissions = selectedUserPermissions;
        }
        const created = await apiClient.createUser(payload);
        setUsers((current) => [...current, created]);
        onStatus(`Usuario ${created.name} creado correctamente.`);
      }
      setIsUserModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo guardar el usuario.');
      setFormGlobalError(msg);
      onStatus(msg);
    }
  };

  const handleOpenToggleDialog = (user: AuthUser) => {
    setTargetToggleUser(user);
    setIsToggleDialogOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!targetToggleUser) return;
    if (toggleUserInFlightRef.current) return;
    toggleUserInFlightRef.current = true;
    setIsTogglingUser(true);
    onStatus('Cambiando estado de usuario...');
    try {
      const updated = await apiClient.toggleUserActive(targetToggleUser.id);
      setUsers((current) => current.map((u) => (u.id === targetToggleUser.id ? updated : u)));
      const action = updated.active ? 'activado' : 'desactivado';
      onStatus(`Usuario ${updated.name} ha sido ${action} con éxito.`);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo cambiar el estado del usuario.');
      onStatus(msg);
    } finally {
      toggleUserInFlightRef.current = false;
      setIsTogglingUser(false);
      setIsToggleDialogOpen(false);
      setTargetToggleUser(null);
    }
  };

  const handleOpenResetModal = (user: AuthUser) => {
    setTargetResetUser(user);
    setResetGlobalError('');
    setIsResetModalOpen(true);
  };

  const onResetSubmit = async (data: { newPassword: string }) => {
    if (!targetResetUser) return;
    setResetGlobalError('');
    onStatus('Restableciendo contraseña...');
    try {
      await apiClient.resetUserPassword(targetResetUser.id, data.newPassword);
      onStatus(`Contraseña restablecida con éxito para ${targetResetUser.name}. Se solicitará cambio de contraseña en su siguiente inicio de sesión.`);
      setIsResetModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo restablecer la contraseña.');
      setResetGlobalError(msg);
      onStatus(msg);
    }
  };

  if (loading) {
    return <LoadingState label="Cargando usuarios..." />;
  }

  if (loadError) {
    return (
      <>
        <h1 className="text-2xl font-semibold leading-tight">Usuarios</h1>
        <ErrorState
          title="No se pudieron cargar los usuarios"
          description={loadError}
          action={(
            <Button type="button" variant="secondary" onClick={() => void fetchUsers()}>
              Reintentar
            </Button>
          )}
        />
      </>
    );
  }

  const userColumns: Array<DataTableColumn<AuthUser>> = [
    {
      key: 'name',
      header: 'Usuario',
      headerClassName: 'w-[30%]',
      cellClassName: 'font-medium',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Usuario de acceso',
      render: (user) => <span className="font-mono text-xs">{user.username}</span>,
    },
    {
      key: 'roles',
      header: 'Rol',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <Badge
              key={role}
              variant={role === 'admin' ? 'destructive' : role === 'supervisor' ? 'default' : 'secondary'}
              className="capitalize font-semibold"
            >
              {role}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (user) => (
        <StatusBadge status={user.active ? 'active' : 'closed'}>
          {user.active ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (user) => (
        <div className="flex flex-wrap justify-end gap-2">
          {canUpdateUsers && (
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Editar usuario ${user.name}`}
              onClick={() => handleOpenEditModal(user)}
            >
              Editar
            </Button>
          )}
          {canUpdateUsers && (
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Restablecer clave de ${user.name}`}
              onClick={() => handleOpenResetModal(user)}
            >
              Restablecer clave
            </Button>
          )}
          {canDisableUsers && (
            <Button
              variant="secondary"
              size="sm"
              aria-label={user.active ? `Desactivar usuario ${user.name}` : `Activar usuario ${user.name}`}
              className={user.active ? 'text-destructive' : 'text-success-foreground'}
              onClick={() => handleOpenToggleDialog(user)}
            >
              {user.active ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        </div>
      ),
    },
  ];

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
        actions={canCreateUsers ? (
          <Button onClick={handleOpenCreateModal}>
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
            helper: `${users.length} cuenta${users.length === 1 ? '' : 's'} registrada${users.length === 1 ? '' : 's'}`,
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
            helper: `${roles.length} rol${roles.length === 1 ? '' : 'es'} disponible${roles.length === 1 ? '' : 's'} en total.`,
            icon: <UserCog aria-hidden="true" className="size-4" />,
          },
        ]}
      />

      {canManageRoles && (
        <Card className="border border-operational-border bg-operational-surface shadow-operational">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Roles y modulos</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Defina que modulos puede usar cada tipo de usuario. Los roles base protegidos se conservan para no perder acceso administrativo.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleOpenCreateRole}>
                Nuevo rol
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <div key={role.id} className="rounded-md border border-operational-border bg-operational-panel/55 p-4">
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
                    onClick={() => handleOpenEditRole(role)}
                    disabled={role.protected}
                  >
                    Editar permisos
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!canManageRoles && (
        <PermissionState
          state="readonly"
          className="mb-6"
          title="Roles en modo consulta"
          description="Su usuario puede revisar cuentas autorizadas, pero la asignacion directa de permisos requiere permiso de administracion de roles."
        />
      )}

      {!canUpdateUsers && !canDisableUsers && (
        <p className="text-sm text-muted-foreground">Solo lectura</p>
      )}

      <Card className="border border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="space-y-4 p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre, correo o usuario..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            containerLabel="Usuarios autorizados"
            rows={filteredUsers}
            columns={userColumns}
            getRowKey={(user) => user.id}
            emptyTitle={searchTerm ? 'Sin coincidencias' : 'No hay usuarios cargados'}
            emptyDescription={searchTerm ? 'Ajuste la busqueda por nombre, correo o usuario.' : 'Cuando se creen usuarios autorizados apareceran en este directorio.'}
          />
        </CardContent>
      </Card>

      <UserFormDialog
        open={isUserModalOpen}
        onOpenChange={setIsUserModalOpen}
        editingUser={editingUser}
        roles={roles}
        canManageRoles={canManageRoles}
        selectedUserPermissions={selectedUserPermissions}
        onToggleUserPermission={toggleUserPermission}
        permissionCatalog={permissionCatalog}
        globalError={formGlobalError}
        onSubmit={onUserSubmit}
      />

      <RoleFormDialog
        open={isRoleModalOpen}
        onOpenChange={setIsRoleModalOpen}
        editingRole={editingRole}
        permissionCatalog={permissionCatalog}
        selectedPermissions={selectedPermissions}
        onTogglePermission={togglePermission}
        globalError={roleGlobalError}
        onSubmit={handleRoleSubmit}
        isSaving={isSavingRole}
      />

      <PasswordResetDialog
        open={isResetModalOpen}
        onOpenChange={setIsResetModalOpen}
        targetUser={targetResetUser}
        globalError={resetGlobalError}
        onSubmit={onResetSubmit}
      />

      <ConfirmDialog
        open={isToggleDialogOpen}
        title={targetToggleUser?.active ? '¿Desactivar usuario?' : '¿Activar usuario?'}
        confirmLabel={isTogglingUser ? 'Cambiando...' : targetToggleUser?.active ? 'Desactivar' : 'Activar'}
        confirmDisabled={isTogglingUser}
        cancelDisabled={isTogglingUser}
        danger={targetToggleUser?.active}
        onCancel={() => {
          setIsToggleDialogOpen(false);
          setTargetToggleUser(null);
        }}
        onConfirm={handleConfirmToggle}
      >
        {targetToggleUser?.active ? (
          <p>
            Al desactivar a <strong>{targetToggleUser?.name}</strong>, este no podrá iniciar sesión ni operar en el sistema. Las transacciones y reportes de caja históricos del usuario permanecerán intactos para fines de auditoría.
          </p>
        ) : (
          <p>
            Al reactivar a <strong>{targetToggleUser?.name}</strong>, el usuario volverá a tener acceso operativo al sistema con sus credenciales habituales.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}