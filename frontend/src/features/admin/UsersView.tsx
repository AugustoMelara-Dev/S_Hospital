import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AuthUser,
  type PermissionCatalogGroup,
  type RoleDefinition,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/design-system/components/PageHeader';
import { UserFormDialog, type UserFormData } from './components/UserFormDialog';
import { UserManagementOverview } from './components/UserManagementOverview';
import { RoleFormDialog } from './components/RoleFormDialog';
import { PasswordResetDialog } from './components/PasswordResetDialog';
import { UserRolesPanel } from './components/UserRolesPanel';
import { UsersDirectoryPanel } from './components/UsersDirectoryPanel';
import { UserStatusToggleDialog } from './components/UserStatusToggleDialog';
import {
  buildCreateUserPayload,
  buildUpdateUserPayload,
  hasProtectedRole,
  isHiddenPermission,
  sanitizePermissionCatalog,
  sanitizeRole,
  sanitizeRoles,
  visiblePermissionNames,
} from './users-view.helpers';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
type UsersViewProps = {
  onStatus: OperationalStatusReporter;
  canCreateUsers: boolean;
  canUpdateUsers?: boolean;
  canDisableUsers?: boolean;
  canManageRoles: boolean;
  canAssignAdminRole?: boolean;
  currentUserId?: number;
};
export function UsersView({
  onStatus,
  canCreateUsers,
  canUpdateUsers = false,
  canDisableUsers = false,
  canManageRoles,
  canAssignAdminRole = false,
  currentUserId,
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleGlobalError, setRoleGlobalError] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const saveRoleInFlightRef = useRef(false);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);
  const [advancedUserPermissionsMode, setAdvancedUserPermissionsMode] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<AuthUser | null>(null);
  const [resetGlobalError, setResetGlobalError] = useState('');
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [targetToggleUser, setTargetToggleUser] = useState<AuthUser | null>(null);
  const [isTogglingUser, setIsTogglingUser] = useState(false);
  const toggleUserInFlightRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
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
      setRoles(sanitizeRoles(roleData.roles));
      setPermissionCatalog(sanitizePermissionCatalog(roleData.permissionCatalog));
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudieron cargar los usuarios.');
      setLoadError(msg);
      onStatusRef.current({ key: 'admin:users:load', level: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }, []);
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
  const activeProtectedUsers = users.filter((user) => user.active && hasProtectedRole(user));
  const onlyActiveProtectedUserIds = activeProtectedUsers.length === 1 ? [activeProtectedUsers[0].id] : [];
  const pendingPasswordUsersCount = users.filter((user) => user.must_change_password).length;
  const editableRolesCount = roles.filter((role) => !role.protected).length;
  const handleOpenCreateModal = () => {
    const role = defaultRoleName();
    setEditingUser(null);
    setSelectedUserPermissions(canManageRoles ? permissionsForRole(role) : []);
    setAdvancedUserPermissionsMode(false);
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setSelectedPermissions([]);
    setRoleGlobalError('');
    setIsRoleModalOpen(true);
  };
  const handleOpenEditRole = (role: RoleDefinition) => {
    setEditingRole(role);
    setSelectedPermissions(role.permissions.map((permission) => permission.name));
    setRoleGlobalError('');
    setIsRoleModalOpen(true);
  };
  const togglePermission = (permissionName: string, checked: boolean) => {
    if (isHiddenPermission(permissionName)) {
      return;
    }

    setSelectedPermissions((current) => {
      if (checked) {
        return current.includes(permissionName) ? current : [...current, permissionName].sort();
      }
      return current.filter((name) => name !== permissionName);
    });
  };

  const toggleUserPermission = (permissionName: string, checked: boolean) => {
    if (isHiddenPermission(permissionName)) {
      return;
    }

    setSelectedUserPermissions((current) => {
      if (checked) {
        return current.includes(permissionName) ? current : [...current, permissionName].sort();
      }
      return current.filter((name) => name !== permissionName);
    });
  };

  const handleRoleSubmit = async (data: { name: string; permissions: string[] }) => {
    setRoleGlobalError('');

    const normalizedName = data.name.trim();
    const visiblePermissions = visiblePermissionNames(data.permissions);
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(normalizedName)) {
      setRoleGlobalError('Use un nombre de rol entre 3 y 80 caracteres, solo letras, numeros, _ o -.');
      return;
    }
    if (visiblePermissions.length === 0) {
      setRoleGlobalError('Seleccione al menos un permiso para el rol.');
      return;
    }
    if (saveRoleInFlightRef.current) return;

    saveRoleInFlightRef.current = true;
    setIsSavingRole(true);
    onStatus({
      key: 'admin:roles:save',
      level: 'info',
      message: editingRole ? 'Actualizando rol...' : 'Creando rol...',
      toast: false,
    });

    try {
      const saved = editingRole
        ? await apiClient.updateRole(editingRole.id, { name: normalizedName, permissions: visiblePermissions })
        : await apiClient.createRole({ name: normalizedName, permissions: visiblePermissions });
      const visibleSavedRole = sanitizeRole(saved);

      setRoles((current) => {
        const exists = current.some((role) => role.id === visibleSavedRole.id);
        return (exists ? current.map((role) => (role.id === visibleSavedRole.id ? visibleSavedRole : role)) : [...current, visibleSavedRole])
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsRoleModalOpen(false);
      onStatus({
        key: 'admin:roles:save',
        level: 'success',
        message: `Rol ${visibleSavedRole.name} ${editingRole ? 'actualizado' : 'creado'} correctamente.`,
      });
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo guardar el rol.');
      setRoleGlobalError(msg);
      onStatus({ key: 'admin:roles:save', level: 'error', message: msg });
    } finally {
      saveRoleInFlightRef.current = false;
      setIsSavingRole(false);
    }
  };

  const handleOpenEditModal = (user: AuthUser) => {
    setEditingUser(user);
    setSelectedUserPermissions(canManageRoles
      ? (user.uses_exact_permission_map
        ? visiblePermissionNames(user.direct_permissions ?? [])
        : permissionsForRole(user.roles[0] || defaultRoleName()))
      : []);
    setAdvancedUserPermissionsMode(Boolean(canManageRoles && user.uses_exact_permission_map));
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };

  const onUserSubmit = async (data: UserFormData) => {
    setFormGlobalError('');
    const editingSelf = Boolean(editingUser && currentUserId === editingUser.id);

    if (!editingSelf && advancedUserPermissionsMode && selectedUserPermissions.length === 0 && editingUser?.active !== false) {
      const msg = 'Seleccione al menos un modulo para un usuario activo, o desactive el usuario antes de dejarlo sin acceso.';
      setFormGlobalError(msg);
      onStatus({ key: 'admin:users:save', level: 'warning', message: msg });
      return;
    }

    onStatus({ key: 'admin:users:save', level: 'info', message: 'Guardando usuario...', toast: false });
    try {
      if (editingUser) {
        const payload = buildUpdateUserPayload(data, selectedUserPermissions, editingSelf ? false : advancedUserPermissionsMode);
        const updated = await apiClient.updateUser(editingUser.id, payload);
        setUsers((current) => current.map((u) => (u.id === editingUser.id ? updated : u)));
        onStatus({ key: 'admin:users:save', level: 'success', message: `Usuario ${updated.name} actualizado correctamente.` });
      } else {
        const payload = buildCreateUserPayload(data, selectedUserPermissions, advancedUserPermissionsMode);
        const created = await apiClient.createUser(payload);
        setUsers((current) => [...current, created]);
        onStatus({ key: 'admin:users:save', level: 'success', message: `Usuario ${created.name} creado correctamente.` });
      }
      setIsUserModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo guardar el usuario.');
      setFormGlobalError(msg);
      onStatus({ key: 'admin:users:save', level: 'error', message: msg });
    }
  };

  const handleOpenToggleDialog = (user: AuthUser) => {
    setTargetToggleUser(user);
    setIsToggleDialogOpen(true);
  };

  const handleConfirmToggle = async (reason: string | null) => {
    if (!targetToggleUser) return;
    if (toggleUserInFlightRef.current) return;
    toggleUserInFlightRef.current = true;
    setIsTogglingUser(true);
    onStatus({ key: 'admin:users:toggle', level: 'info', message: 'Cambiando estado de usuario...', toast: false });
    try {
      const updated = await apiClient.toggleUserActive(
        targetToggleUser.id,
        targetToggleUser.active ? reason : null,
      );
      setUsers((current) => current.map((u) => (u.id === targetToggleUser.id ? updated : u)));
      const action = updated.active ? 'activado' : 'desactivado';
      onStatus({ key: 'admin:users:toggle', level: 'success', message: `Usuario ${updated.name} ha sido ${action} con éxito.` });
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo cambiar el estado del usuario.');
      onStatus({ key: 'admin:users:toggle', level: 'error', message: msg });
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

  const onResetSubmit = async (data: { newPassword: string; reason: string }) => {
    if (!targetResetUser) return;
    setResetGlobalError('');
    onStatus({ key: 'admin:users:reset-password', level: 'info', message: 'Restableciendo contraseña...', toast: false });
    try {
      await apiClient.resetUserPassword(targetResetUser.id, data.newPassword, data.reason);
      onStatus({
        key: 'admin:users:reset-password',
        level: 'success',
        message: `Contraseña restablecida con éxito para ${targetResetUser.name}. Se solicitará cambio de contraseña en su siguiente inicio de sesión.`,
      });
      setIsResetModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo restablecer la contraseña.');
      setResetGlobalError(msg);
      onStatus({ key: 'admin:users:reset-password', level: 'error', message: msg });
    }
  };

  if (loading) {
    return <><PageHeader title="Cargando usuarios" description="Preparando cuentas, roles y permisos operativos." /><div role="status" className="grid gap-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /><span className="sr-only">Cargando usuarios...</span></div></>;
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Usuarios y funciones" description="Administre cuentas individuales, roles operativos y permisos por módulo." />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle><h2>No se pudieron cargar los usuarios</h2></AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
          <AlertAction><Button variant="outline" onClick={() => void fetchUsers()}>Reintentar</Button></AlertAction>
        </Alert>
      </>
    );
  }

  return (
    <>
      <UserManagementOverview
        activeUsersCount={activeUsersCount}
        editableRolesCount={editableRolesCount}
        onCreateUser={handleOpenCreateModal}
        pendingPasswordUsersCount={pendingPasswordUsersCount}
        showCreateAction={canCreateUsers}
        totalRolesCount={roles.length}
        totalUsersCount={users.length}
      />
      <UserRolesPanel
        canAssignAdminRole={canAssignAdminRole}
        canManageRoles={canManageRoles}
        onCreateRole={handleOpenCreateRole}
        onEditRole={handleOpenEditRole}
        permissionCatalog={permissionCatalog}
        roles={roles}
      />

      <UsersDirectoryPanel
        canAssignAdminRole={canAssignAdminRole}
        canDisableUsers={canDisableUsers}
        canUpdateUsers={canUpdateUsers}
        currentUserId={currentUserId}
        onEdit={handleOpenEditModal}
        onResetPassword={handleOpenResetModal}
        onSearchTermChange={setSearchTerm}
        onToggleActive={handleOpenToggleDialog}
        onlyActiveProtectedUserIds={onlyActiveProtectedUserIds}
        readOnly={!canUpdateUsers && !canDisableUsers}
        searchTerm={searchTerm}
        users={filteredUsers}
      />
      <UserFormDialog
        open={isUserModalOpen}
        onOpenChange={setIsUserModalOpen}
        editingUser={editingUser}
        roles={roles}
        canManageRoles={canManageRoles}
        canAssignAdminRole={canAssignAdminRole}
        protectedRoleLocked={editingUser ? onlyActiveProtectedUserIds.includes(editingUser.id) : false}
        identityOnly={Boolean(editingUser && currentUserId === editingUser.id)}
        selectedUserPermissions={selectedUserPermissions}
        advancedPermissionMode={advancedUserPermissionsMode}
        onAdvancedPermissionModeChange={setAdvancedUserPermissionsMode}
        onToggleUserPermission={toggleUserPermission}
        onRoleChange={(roleNameValue) => {
          if (canManageRoles) {
            setSelectedUserPermissions(permissionsForRole(roleNameValue));
          }
        }}
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

      <UserStatusToggleDialog
        open={isToggleDialogOpen}
        isToggling={isTogglingUser}
        targetUser={targetToggleUser}
        onCancel={() => {
          setIsToggleDialogOpen(false);
          setTargetToggleUser(null);
        }}
        onConfirm={handleConfirmToggle}
      />
    </>
  );
}
