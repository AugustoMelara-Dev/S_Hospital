import { useEffect, useRef, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  type AuthUser,
  type UserPayload,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
} from 'lucide-react';

type UsersViewProps = {
  onStatus: (message: string) => void;
  canCreateUsers: boolean;
};

const PASSWORD_POLICY_HINT = 'Mínimo 10 caracteres, con letras y números';
const PASSWORD_POLICY_ERROR = 'La contraseña debe tener al menos 10 caracteres e incluir letras y números.';

function isPasswordPolicyCompliant(password: string) {
  return password.length >= 10 && /\p{L}/u.test(password) && /\p{N}/u.test(password);
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

export function UsersView({ onStatus, canCreateUsers }: UsersViewProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // User Modal (Create/Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [formGlobalError, setFormGlobalError] = useState('');

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
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

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    resetUserForm({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'cajero',
    });
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditModal = (user: AuthUser) => {
    setEditingUser(user);
    resetUserForm({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '', // Password is not modified via edit details modal
      role: user.roles[0] || 'cajero',
    });
    setFormGlobalError('');
    setIsUserModalOpen(true);
  };

  const onUserSubmit = async (data: UserFormData) => {
    setFormGlobalError('');
    onStatus('Guardando usuario...');
    try {
      if (editingUser) {
        const payload: Omit<UserPayload, 'password'> = {
          name: data.name,
          email: data.email,
          username: data.username,
          role: data.role,
        };
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
      <PageHeader
        title="Usuarios"
        description="Administre el personal autorizado para facturar, cobrar y supervisar."
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar usuarios"
            placeholder="Buscar por nombre, correo o usuario..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreateUsers && (
          <Button onClick={handleOpenCreateModal} className="w-full md:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Crear usuario
          </Button>
        )}
      </div>

      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
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
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.name}</p>
                          {user.must_change_password && (
                            <Badge variant="warning" className="text-[10px] px-1 py-0 mt-0.5">
                              Requiere cambio de clave
                            </Badge>
                          )}
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
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Editar detalles"
                          aria-label={`Editar usuario ${user.name}`}
                          onClick={() => handleOpenEditModal(user)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Restablecer clave"
                          aria-label={`Restablecer clave de ${user.name}`}
                          onClick={() => handleOpenResetModal(user)}
                        >
                          <KeyRound className="h-3.5 w-3.5 text-orange-500" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

          <div className="space-y-1">
            <Label htmlFor="role">Rol operativo *</Label>
            <Controller
              name="role"
              control={userControl}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cajero">Cajero (POS y cobros diarios)</SelectItem>
                    <SelectItem value="supervisor">Supervisor (Auditoría, caja general y anulaciones)</SelectItem>
                    <SelectItem value="admin">Administrador (control completo)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {userErrors.role && <p className="text-xs text-destructive">{userErrors.role.message}</p>}
          </div>

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
