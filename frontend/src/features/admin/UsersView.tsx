import { type FormEvent, useEffect, useRef, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  type AuthUser,
  type PermissionCatalogGroup,
  type RoleDefinition,
  type UserPayload,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Card, CardContent } from '@/components/ui/card';
import { CommandPanel, InfoPanel, OperationalBanner, PermissionState, StatGrid } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  KeyRound,
  Edit2,
  Mail,
  User,
  Lock,
  ShieldCheck,
  PlusCircle,
  Users,
  UserCog,
  ShieldAlert,
} from 'lucide-react';

type UsersViewProps = {
  onStatus: (message: string) => void;
  canCreateUsers: boolean;
  canUpdateUsers?: boolean;
  canDisableUsers?: boolean;
  canManageRoles: boolean;
};

const PASSWORD_POLICY_HINT = 'Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo';
const PASSWORD_POLICY_ERROR = 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.';

function isPasswordPolicyCompliant(password: string) {
  return password.length >= 12
    && /\p{Ll}/u.test(password)
    && /\p{Lu}/u.test(password)
    && /\p{N}/u.test(password)
    && /[^\p{L}\p{N}]/u.test(password);
}

const baseUserSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  email: z.string().email('Formato de correo no válido.'),
  username: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Nombre de usuario no válido (solo letras, números, _ o -).'),
  role: z.string().min(1, 'El rol es obligatorio.'),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().refine(isPasswordPolicyCompliant, PASSWORD_POLICY_ERROR),
});

const editUserSchema = baseUserSchema.extend({
  password: z.string().optional(),
});

type UserFormData = {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: string;
};

const resetPasswordSchema = z.object({
  newPassword: z.string().refine(isPasswordPolicyCompliant, PASSWORD_POLICY_ERROR),
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

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

  // User Modal (Create/Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [formGlobalError, setFormGlobalError] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);
  const [roleGlobalError, setRoleGlobalError] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const saveRoleInFlightRef = useRef(false);

  const {
    register: registerUser,
    handleSubmit: handleSubmitUser,
    control: userControl,
    reset: resetUserForm,
    formState: { errors: userErrors, isSubmitting: isSavingUser },
  } = useForm<UserFormData>({
    resolver: zodResolver(editingUser ? editUserSchema : createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'cajero',
    },
  });

  // Reset Password Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<AuthUser | null>(null);
  const [resetGlobalError, setResetGlobalError] = useState('');

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    reset: resetResetForm,
    formState: { errors: resetErrors, isSubmitting: isResettingPassword },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
    },
  });

  // Toggle Status Confirm Dialog
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [targetToggleUser, setTargetToggleUser] = useState<AuthUser | null>(null);
  const [isTogglingUser, setIsTogglingUser] = useState(false);
  const toggleUserInFlightRef = useRef(false);

  const roleLabel = useCallback((role: string) => {
    return role
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, []);

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

  // Filter users based on search term
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });
  const activeUsersCount = users.filter((user) => user.active).length;
  const pendingPasswordUsersCount = users.filter((user) => user.must_change_password).length;
  const editableRolesCount = roles.filter((role) => !role.protected).length;
  const totalPermissionCount = permissionCatalog.reduce((total, group) => total + group.permissions.length, 0);

  const handleOpenCreateModal = () => {
    const role = defaultRoleName();
    setEditingUser(null);
    resetUserForm({
      name: '',
      email: '',
      username: '',
      password: '',
      role,
    });
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
    resetUserForm({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '', // Password is not modified via edit details modal
      role: user.roles[0] || defaultRoleName(),
    });
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
        setUsers(users.map((u) => (u.id === editingUser.id ? updated : u)));
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
        setUsers([...users, created]);
        onStatus(`Usuario ${created.name} creado correctamente.`);
      }
      setIsUserModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo guardar el usuario.');
      onStatus(msg);
      setFormGlobalError(msg);
    }
  };

  // Toggle user status
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
      setUsers(users.map((u) => (u.id === targetToggleUser.id ? updated : u)));
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

  // Reset Password
  const handleOpenResetModal = (user: AuthUser) => {
    setTargetResetUser(user);
    resetResetForm({ newPassword: '' });
    setResetGlobalError('');
    setIsResetModalOpen(true);
  };

  const onResetSubmit = async (data: ResetPasswordForm) => {
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
        <PageHeader
          title="Usuarios"
          description="Administre el personal autorizado para facturar, cobrar y supervisar."
        />
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

  return (
    <>
      <OperationalBanner
        title="Usuarios y permisos"
        meta="Administracion segura"
        description="Administre cuentas individuales, roles operativos y permisos por modulo sin cambiar la politica de acceso del servidor."
        status={(
          <Badge variant="info">
            <ShieldCheck data-icon aria-hidden="true" />
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
        className="mb-6 mt-6 xl:grid-cols-4"
        items={[
          {
            label: 'Usuarios activos',
            value: activeUsersCount,
            helper: `${users.length} cuenta${users.length === 1 ? '' : 's'} registrada${users.length === 1 ? '' : 's'}`,
            icon: <Users aria-hidden="true" />,
            tone: 'success',
          },
          {
            label: 'Cambio pendiente',
            value: pendingPasswordUsersCount,
            helper: 'Usuarios que deberan cambiar clave al ingresar.',
            icon: <KeyRound aria-hidden="true" />,
            tone: pendingPasswordUsersCount > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Roles editables',
            value: editableRolesCount,
            helper: `${roles.length} rol${roles.length === 1 ? '' : 'es'} disponible${roles.length === 1 ? '' : 's'} en total.`,
            icon: <UserCog aria-hidden="true" />,
          },
          {
            label: 'Permisos agrupados',
            value: totalPermissionCount,
            helper: `${permissionCatalog.length} modulo${permissionCatalog.length === 1 ? '' : 's'} de acceso.`,
            icon: <ShieldCheck aria-hidden="true" />,
          },
        ]}
      />

      {canManageRoles && (
        <Card className="mb-6 border border-operational-border bg-operational-surface shadow-operational">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Roles y modulos</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Defina que modulos puede usar cada tipo de usuario. Los roles base protegidos se conservan para no perder acceso administrativo.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={handleOpenCreateRole}>
                <PlusCircle data-icon aria-hidden="true" />
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
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[...new Set(role.permissions.map((permission) => permission.module))].slice(0, 4).map((module) => (
                      <Badge key={module} variant="outline">
                        {module}
                      </Badge>
                    ))}
                    {role.permissions.length === 0 ? (
                      <Badge variant="warning">Sin permisos</Badge>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleOpenEditRole(role)}
                    disabled={role.protected}
                    aria-label={`Editar permisos de ${roleLabel(role.name)}`}
                  >
                    Editar permisos
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!canManageRoles ? (
        <PermissionState
          state="readonly"
          className="mb-6"
          title="Roles en modo consulta"
          description="Su usuario puede revisar cuentas autorizadas, pero la asignacion directa de permisos requiere permiso de administracion de roles."
        />
      ) : null}

      <CommandPanel
        className="mb-6"
        title="Directorio de usuarios"
        description="Busque por nombre, correo o usuario para revisar estado, rol y acciones disponibles."
      >
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
      </CommandPanel>

      <Card className="border border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="p-0">
          <Table containerLabel="Usuarios autorizados">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Usuario</TableHead>
                <TableHead>Usuario / Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6">
                    <InfoPanel
                      title={searchTerm ? 'Sin coincidencias' : 'No hay usuarios cargados'}
                      description={searchTerm ? 'Ajuste la busqueda por nombre, correo o usuario.' : 'Cuando se creen usuarios autorizados apareceran en este directorio.'}
                      tone="neutral"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className={!user.active ? 'bg-muted/20' : undefined}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {user.must_change_password ? (
                              <Badge variant="warning" className="text-[10px]">
                                <ShieldAlert data-icon aria-hidden="true" className="size-3" />
                                Requiere cambio de clave
                              </Badge>
                            ) : null}
                            {user.uses_exact_permission_map ? (
                              <Badge variant="info" className="text-[10px]">
                                Permisos directos
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{user.username}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={
                              role === 'admin'
                                ? 'destructive'
                                : role === 'supervisor'
                                ? 'default'
                                : 'secondary'
                            }
                            className="capitalize font-semibold"
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.active ? 'active' : 'closed'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdateUsers && (
                          <>
                            <Button
                              variant="secondary"
                              size="icon"
                              title="Editar detalles"
                              aria-label={`Editar usuario ${user.name}`}
                              onClick={() => handleOpenEditModal(user)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              title="Restablecer clave"
                              aria-label={`Restablecer clave de ${user.name}`}
                              onClick={() => handleOpenResetModal(user)}
                            >
                              <KeyRound className="h-3.5 w-3.5 text-orange-500" />
                            </Button>
                          </>
                        )}
                        {canDisableUsers && (
                          <Button
                            variant="secondary"
                            size="icon"
                            title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                            aria-label={user.active ? `Desactivar usuario ${user.name}` : `Activar usuario ${user.name}`}
                            onClick={() => handleOpenToggleDialog(user)}
                          >
                            {user.active ? (
                              <UserX className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-success" />
                            )}
                          </Button>
                        )}
                        {!canUpdateUsers && !canDisableUsers && (
                          <span className="text-xs text-muted-foreground">Solo lectura</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={isRoleModalOpen}
        onOpenChange={(open) => {
          if (!isSavingRole) setIsRoleModalOpen(open);
        }}
        size="lg"
        title={editingRole ? 'Editar rol' : 'Nuevo rol'}
        description="Seleccione los permisos exactos que tendra este rol operativo."
      >
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          {roleGlobalError && (
            <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {roleGlobalError}
            </div>
          )}

          <InfoPanel
            title="Permisos por modulo"
            description="Seleccione exactamente los accesos que tendra el rol. Los nombres tecnicos se muestran solo para trazabilidad administrativa."
            tone="info"
          />

          <div className="rounded-md border border-operational-border bg-operational-panel/50 p-3 space-y-1">
            <Label htmlFor="role-name">Nombre del rol *</Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="ejemplo: caja_turno_tarde"
              disabled={isSavingRole}
            />
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border border-operational-border bg-operational-panel/40 p-3">
            {permissionCatalog.map((group) => (
              <fieldset key={group.module} className="rounded-md border border-operational-border bg-operational-surface p-3">
                <legend className="px-1 text-sm font-semibold text-foreground">
                  {group.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {group.permissions.length} permiso{group.permissions.length === 1 ? '' : 's'}
                  </span>
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const id = `permission-${permission.name.replace(/[^A-Za-z0-9_-]/g, '-')}`;
                    const checked = selectedPermissions.includes(permission.name);

                    return (
                      <label key={permission.name} htmlFor={id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/50">
                        <Checkbox
                          id={id}
                          checked={checked}
                          disabled={isSavingRole}
                          onCheckedChange={(value) => togglePermission(permission.name, value === true)}
                        />
                        <span>
                          <span className="block font-medium text-foreground">{permission.label}</span>
                          <span className="block text-xs text-muted-foreground">{permission.name}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsRoleModalOpen(false)} disabled={isSavingRole}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSavingRole}>
              {isSavingRole ? 'Guardando...' : editingRole ? 'Guardar rol' : 'Crear rol'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* User Create/Edit Dialog */}
      <Dialog
        open={isUserModalOpen}
        onOpenChange={(open) => {
          if (!isSavingUser) setIsUserModalOpen(open);
        }}
        size="md"
        title={editingUser ? 'Editar usuario' : 'Crear usuario'}
        description="Configure nombre, acceso y rol operativo."
      >
        <form onSubmit={handleSubmitUser(onUserSubmit)} className="space-y-4">
          {formGlobalError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20" role="alert">
              {formGlobalError}
            </div>
          )}

          <InfoPanel
            title={editingUser ? 'Edicion de cuenta operativa' : 'Alta de usuario individual'}
            description={editingUser ? 'Actualice datos visibles y rol sin modificar la clave desde este formulario.' : 'Cree una cuenta personal para evitar usuarios compartidos en caja o administracion.'}
            tone="info"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
            <Label htmlFor="name">Nombre completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                className="pl-9"
                placeholder="Juan Pérez Celaya"
                aria-invalid={Boolean(userErrors.name)}
                aria-describedby={userErrors.name ? 'name-error' : undefined}
                {...registerUser('name')}
              />
            </div>
            {userErrors.name && <p id="name-error" className="text-xs text-destructive" role="alert">{userErrors.name.message}</p>}
            </div>

            <div className="space-y-1">
            <Label htmlFor="email">Correo electrónico *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="pl-9"
                placeholder="jperez@hospital.org"
                aria-invalid={Boolean(userErrors.email)}
                aria-describedby={userErrors.email ? 'email-error' : undefined}
                {...registerUser('email')}
              />
            </div>
            {userErrors.email && <p id="email-error" className="text-xs text-destructive" role="alert">{userErrors.email.message}</p>}
            </div>

            <div className="space-y-1">
            <Label htmlFor="username">Nombre de usuario *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                className="pl-9"
                placeholder="jperez"
                aria-invalid={Boolean(userErrors.username)}
                aria-describedby={userErrors.username ? 'username-error' : undefined}
                {...registerUser('username')}
              />
            </div>
            {userErrors.username && <p id="username-error" className="text-xs text-destructive" role="alert">{userErrors.username.message}</p>}
            </div>

          {!editingUser && (
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña inicial *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9"
                  placeholder={PASSWORD_POLICY_HINT}
                  aria-invalid={Boolean(userErrors.password)}
                  aria-describedby={userErrors.password ? 'password-error' : undefined}
                  {...registerUser('password')}
                />
              </div>
              {userErrors.password && <p id="password-error" className="text-xs text-destructive" role="alert">{userErrors.password.message}</p>}
            </div>
          )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="role">Rol operativo *</Label>
            <Controller
              name="role"
              control={userControl}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedUserPermissions(canManageRoles ? permissionsForRole(value) : []);
                  }}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {roleLabel(role.name)}
                        {role.protected ? ' (base protegido)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {userErrors.role && <p className="text-xs text-destructive">{userErrors.role.message}</p>}
          </div>

          {canManageRoles ? (
            <div className="space-y-3 rounded-md border border-operational-border bg-operational-panel/45 p-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Acceso por modulos</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste los permisos directos de este usuario. El rol funciona como plantilla inicial.
                </p>
              </div>
              <div className="max-h-[320px] space-y-3 overflow-y-auto">
                {permissionCatalog.map((group) => (
                  <fieldset key={group.module} className="rounded-md border border-operational-border bg-operational-surface p-3">
                    <legend className="px-1 text-sm font-semibold text-foreground">
                      {group.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {group.permissions.length} permiso{group.permissions.length === 1 ? '' : 's'}
                      </span>
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const id = `user-permission-${permission.name.replace(/[^A-Za-z0-9_-]/g, '-')}`;
                        const checked = selectedUserPermissions.includes(permission.name);

                        return (
                          <label key={permission.name} htmlFor={id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/50">
                            <Checkbox
                              id={id}
                              checked={checked}
                              disabled={isSavingUser}
                              onCheckedChange={(value) => toggleUserPermission(permission.name, value === true)}
                            />
                            <span>
                              <span className="block font-medium text-foreground">{permission.label}</span>
                              <span className="block text-xs text-muted-foreground">{permission.name}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Este usuario heredara los modulos del rol seleccionado. Solo una cuenta con permiso para administrar roles puede ajustar permisos directos.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsUserModalOpen(false)} disabled={isSavingUser}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSavingUser}>
              {isSavingUser ? 'Guardando...' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={isResetModalOpen}
        onOpenChange={(open) => {
          if (!isResettingPassword) setIsResetModalOpen(open);
        }}
        size="md"
        title={`Restablecer clave para ${targetResetUser?.name}`}
        description="Establezca una nueva clave temporal. El usuario estará obligado a cambiarla en su próximo ingreso."
      >
        <form onSubmit={handleSubmitReset(onResetSubmit)} className="space-y-4">
          {resetGlobalError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20" role="alert">
              {resetGlobalError}
            </div>
          )}

          <InfoPanel
            title="Clave temporal"
            description="No se muestra ni se guarda la clave en pantalla despues de enviarla. El usuario debera cambiarla en el proximo ingreso."
            tone="warning"
          />

          <div className="space-y-1">
            <Label htmlFor="new-password">Nueva contraseña temporal *</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                className="pl-9"
                placeholder={PASSWORD_POLICY_HINT}
                aria-invalid={Boolean(resetErrors.newPassword)}
                aria-describedby={resetErrors.newPassword ? 'new-password-error' : undefined}
                {...registerReset('newPassword')}
              />
            </div>
            {resetErrors.newPassword && <p id="new-password-error" className="text-xs text-destructive" role="alert">{resetErrors.newPassword.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)} disabled={isResettingPassword}>
              Cancelar
            </Button>
            <Button type="submit" variant="default" disabled={isResettingPassword}>
              {isResettingPassword ? 'Restableciendo...' : 'Restablecer clave'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Toggle Status Confirmation Alert */}
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
