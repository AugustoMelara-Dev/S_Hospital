import { useEffect, useState } from 'react';
import {
  type AuthUser,
  type UserPayload,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/states';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  KeyRound,
  Edit2,
  Mail,
  User,
  ShieldCheck,
  Lock,
} from 'lucide-react';

type UsersViewProps = {
  onStatus: (message: string) => void;
};

export function UsersView({ onStatus }: UsersViewProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // User Modal (Create/Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'cajero',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Reset Password Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  // Toggle Status Confirm Dialog
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [targetToggleUser, setTargetToggleUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudieron cargar los usuarios.');
      onStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  // Filter users based on search term
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!userForm.name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!userForm.email.trim()) {
      errors.email = 'El correo es obligatorio.';
    } else if (!/\S+@\S+\.\S+/.test(userForm.email)) {
      errors.email = 'Formato de correo no válido.';
    }
    
    if (!userForm.username.trim()) {
      errors.username = 'El nombre de usuario es obligatorio.';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(userForm.username)) {
      errors.username = 'Nombre de usuario no válido (solo letras, números, _ o -).';
    }

    if (!editingUser && !userForm.password) {
      errors.password = 'La contraseña es obligatoria para nuevos usuarios.';
    } else if (!editingUser && userForm.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'cajero',
    });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const handleOpenEditModal = (user: AuthUser) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '', // Password is not modified via edit details modal
      role: user.roles[0] || 'cajero',
    });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onStatus('Guardando usuario...');
    try {
      if (editingUser) {
        const payload: Omit<UserPayload, 'password'> = {
          name: userForm.name,
          email: userForm.email,
          username: userForm.username,
          role: userForm.role,
        };
        const updated = await apiClient.updateUser(editingUser.id, payload);
        setUsers(users.map((u) => (u.id === editingUser.id ? updated : u)));
        onStatus(`Usuario ${updated.name} actualizado correctamente.`);
      } else {
        const payload: UserPayload = {
          name: userForm.name,
          email: userForm.email,
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
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
      setFormErrors({ form: msg });
    }
  };

  // Toggle user status
  const handleOpenToggleDialog = (user: AuthUser) => {
    setTargetToggleUser(user);
    setIsToggleDialogOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!targetToggleUser) return;
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
      setIsToggleDialogOpen(false);
      setTargetToggleUser(null);
    }
  };

  // Reset Password
  const handleOpenResetModal = (user: AuthUser) => {
    setTargetResetUser(user);
    setNewPassword('');
    setResetError('');
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResetUser) return;
    if (newPassword.length < 6) {
      setResetError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    onStatus('Restableciendo contraseña...');
    try {
      await apiClient.resetUserPassword(targetResetUser.id, newPassword);
      onStatus(`Contraseña restablecida con éxito para ${targetResetUser.name}. Se solicitará cambio de contraseña en su siguiente inicio de sesión.`);
      setIsResetModalOpen(false);
    } catch (err) {
      const msg = userSafeErrorMessage(err, 'No se pudo restablecer la contraseña.');
      setResetError(msg);
      onStatus(msg);
    }
  };

  if (loading) {
    return <LoadingState label="Cargando usuarios..." />;
  }

  return (
    <>
      <PageHeader
        title="Gestión de Usuarios"
        description="Administre el personal médico, cajeros y supervisores autorizados para operar el sistema."
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, correo o usuario..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={handleOpenCreateModal} className="w-full md:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Crear Usuario
        </Button>
      </div>

      <Card className="border border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" role="table">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                <tr role="row">
                  <th scope="col" className="px-6 py-4">Usuario</th>
                  <th scope="col" className="px-6 py-4">Username / Email</th>
                  <th scope="col" className="px-6 py-4">Rol / Permisos</th>
                  <th scope="col" className="px-6 py-4">Estado</th>
                  <th scope="col" className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border" role="rowgroup">
                {filteredUsers.length === 0 ? (
                  <tr role="row">
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      No se encontraron usuarios que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors" role="row">
                      <td className="px-6 py-4">
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
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs">{user.username}</span>
                          <span className="text-xs">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
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
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                          user.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Editar detalles"
                            onClick={() => handleOpenEditModal(user)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Restablecer clave"
                            onClick={() => handleOpenResetModal(user)}
                          >
                            <KeyRound className="h-3.5 w-3.5 text-orange-500" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                            onClick={() => handleOpenToggleDialog(user)}
                          >
                            {user.active ? (
                              <UserX className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Create/Edit Dialog */}
      <Dialog
        open={isUserModalOpen}
        onOpenChange={setIsUserModalOpen}
        size="md"
        title={editingUser ? 'Editar detalles del usuario' : 'Crear nuevo usuario'}
        description="Configure la información personal, credenciales y rol operativo del usuario."
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {formErrors.form && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20">
              {formErrors.form}
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
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
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
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="username">Nombre de usuario (Login) *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                className="pl-9 font-mono"
                placeholder="jperez"
                value={userForm.username}
                onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </div>
            {formErrors.username && <p className="text-xs text-destructive">{formErrors.username}</p>}
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
                  placeholder="****** (mínimo 6 caracteres)"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="role">Rol operativo *</Label>
            <Select
              value={userForm.role}
              onValueChange={(val: string) => setUserForm((prev) => ({ ...prev, role: val }))}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cajero">Cajero (POS y cobros diarios)</SelectItem>
                <SelectItem value="supervisor">Supervisor (Auditoría, caja general y anulaciones)</SelectItem>
                <SelectItem value="admin">Administrador (Control total del sistema)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={isResetModalOpen}
        onOpenChange={setIsResetModalOpen}
        size="md"
        title={`Restablecer clave para ${targetResetUser?.name}`}
        description="Establezca una nueva clave temporal. El usuario estará obligado a cambiarla en su próximo ingreso."
      >
        <form onSubmit={handleConfirmReset} className="space-y-4">
          {resetError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20">
              {resetError}
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
                placeholder="****** (mínimo 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="default">
              Restablecer Contraseña
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Toggle Status Confirmation Alert */}
      <ConfirmDialog
        open={isToggleDialogOpen}
        title={targetToggleUser?.active ? '¿Desactivar usuario?' : '¿Activar usuario?'}
        confirmLabel={targetToggleUser?.active ? 'Desactivar' : 'Activar'}
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
