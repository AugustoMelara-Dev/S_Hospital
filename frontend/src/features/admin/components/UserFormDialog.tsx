import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SaveOutlined as Save } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input, Modal, Select, Tag } from 'antd';
import { type AuthUser, type RoleDefinition, type RolePermission, type UserPayload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/role-labels';
import { isCriticalPermission, permissionRiskLabel } from './permission-risk';

const baseUserSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  email: z.string().trim().email('Formato de correo no válido.'),
  username: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'Nombre de usuario no válido (solo letras, números, _ o -).'),
  role: z.string().min(1, 'El rol es obligatorio.'),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().refine(isPasswordPolicyCompliant, 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.'),
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

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: AuthUser | null;
  roles: RoleDefinition[];
  canManageRoles: boolean;
  canAssignAdminRole?: boolean;
  protectedRoleLocked?: boolean;
  identityOnly?: boolean;
  selectedUserPermissions: string[];
  advancedPermissionMode?: boolean;
  onAdvancedPermissionModeChange?: (enabled: boolean) => void;
  onToggleUserPermission: (permissionName: string, checked: boolean) => void;
  onRoleChange?: (roleName: string) => void;
  permissionCatalog: { module: string; label: string; permissions: PermissionOption[] }[];
  globalError: string | null;
  onSubmit: (data: UserFormData) => Promise<void> | void;
};

type PermissionOption = Pick<RolePermission, 'name' | 'label' | 'critical' | 'risk_level' | 'risk_label'>;

export function UserFormDialog({
  open,
  onOpenChange,
  editingUser,
  roles,
  canManageRoles,
  canAssignAdminRole = false,
  protectedRoleLocked = false,
  identityOnly = false,
  selectedUserPermissions,
  advancedPermissionMode = false,
  onAdvancedPermissionModeChange = () => undefined,
  onToggleUserPermission,
  onRoleChange,
  permissionCatalog,
  globalError,
  onSubmit,
}: UserFormDialogProps) {
  const [criticalAccessConfirmed, setCriticalAccessConfirmed] = useState(false);
  const schema = editingUser ? editUserSchema : createUserSchema;
  const editingRoleName = editingUser?.roles[0] ?? null;
  const assignableRoles = useMemo(() => {
    if (protectedRoleLocked && editingRoleName) {
      return roles.filter((role) => role.name === editingRoleName);
    }

    return roles.filter((role) => (
      canAssignAdminRole || !isElevatedRole(role) || role.name === editingRoleName
    ));
  }, [canAssignAdminRole, editingRoleName, protectedRoleLocked, roles]);
  const permissionsByName = useMemo(() => {
    return new Map(permissionCatalog.flatMap((group) => group.permissions.map((permission) => [permission.name, permission] as const)));
  }, [permissionCatalog]);
  const hasSelectedCriticalPermission = advancedPermissionMode
    && selectedUserPermissions.some((permissionName) => isCriticalPermission(permissionsByName.get(permissionName)));
  const {
    unregister,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaultValuesFor(editingUser, assignableRoles),
  });
  const selectedRoleName = watch('role');
  const selectedRole = assignableRoles.find((role) => role.name === selectedRoleName);
  const hasSelectedElevatedRole = Boolean(
    selectedRole
      && isElevatedRole(selectedRole)
      && selectedRole.name !== editingRoleName,
  );
  const requiresCriticalAccessConfirmation = hasSelectedCriticalPermission || hasSelectedElevatedRole;

  useLayoutEffect(() => {
    if (open) {
      setCriticalAccessConfirmed(false);
      reset(defaultValuesFor(editingUser, assignableRoles));
      if (editingUser) {
        unregister('password');
      }
    }
  }, [open, editingUser, assignableRoles, reset, unregister]);

  useEffect(() => {
    if (!requiresCriticalAccessConfirmation) {
      setCriticalAccessConfirmed(false);
    }
  }, [requiresCriticalAccessConfirmation]);

  const handleSafeSubmit = handleSubmit((data) => {
    if (requiresCriticalAccessConfirmation && !criticalAccessConfirmed) {
      return;
    }
    return onSubmit(data);
  });

  return (
    <Modal
      open={open}
      onCancel={() => { if (!isSubmitting) onOpenChange(false); }}
      title={editingUser ? 'Editar usuario' : 'Crear usuario'}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <p>Configure nombre, acceso y rol operativo.</p>
      <form onSubmit={handleSafeSubmit} className="space-y-5">
        {globalError && (
          <Alert type="error" showIcon title="No se pudo guardar" description={globalError} />
        )}

        <Alert
          type="info"
          showIcon
          title={editingUser ? 'Edicion de cuenta operativa' : 'Alta de usuario individual'}
          description={editingUser ? 'Actualice datos visibles y rol sin modificar la clave.' : 'Cree una cuenta personal para evitar usuarios compartidos.'}
        />

        {protectedRoleLocked && (
          <Alert type="warning" showIcon title="Unico administrador activo" description="Esta cuenta conserva el rol protegido porque es el unico administrador activo. Cree o active otro administrador antes de cambiar este rol." />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" id="name" error={errors.name?.message}>
            <Controller name="name" control={control} render={({ field: { ref: _ref, ...field } }) => <Input id="name" placeholder="Juan Pérez" disabled={isSubmitting} aria-invalid={Boolean(errors.name)} {...field} />} />
          </Field>
          <Field label="Correo electrónico" id="email" error={errors.email?.message}>
            <Controller name="email" control={control} render={({ field: { ref: _ref, ...field } }) => <Input id="email" type="email" placeholder="jperez@hospital.org" disabled={isSubmitting} aria-invalid={Boolean(errors.email)} {...field} />} />
          </Field>
          <Field label="Nombre de usuario" id="username" error={errors.username?.message}>
            <Controller name="username" control={control} render={({ field: { ref: _ref, ...field } }) => <Input id="username" placeholder="jperez" disabled={isSubmitting} aria-invalid={Boolean(errors.username)} {...field} />} />
          </Field>
          {!editingUser && (
            <Field label="Contraseña inicial" id="password" error={errors.password?.message}>
              <Controller name="password" control={control} render={({ field: { ref: _ref, ...field } }) => <Input.Password id="password" placeholder="Mínimo 12 caracteres" disabled={isSubmitting} aria-invalid={Boolean(errors.password)} {...field} />} />
            </Field>
          )}
        </div>

        <Field label="Rol operativo" id="role" error={errors.role?.message}>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select
                id="role"
                aria-label="Rol operativo"
                showSearch
                optionFilterProp="label"
                virtual={false}
                value={field.value}
                disabled={identityOnly}
                options={assignableRoles.map((role) => ({ value: role.name, label: `${roleLabel(role.name)}${role.protected ? ' (base protegido)' : ''}` }))}
                onChange={(value) => {
                  field.onChange(value);
                  onRoleChange?.(value);
                }}
              />
            )}
          />
        </Field>

        {identityOnly ? (
          <p className="border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Por seguridad, no puede cambiar su propio rol ni sus permisos. Puede actualizar únicamente sus datos de identidad.
          </p>
        ) : null}

        {hasSelectedElevatedRole && (
          <div className="border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Rol administrativo seleccionado
              <Tag color="warning">Rol critico</Tag>
            </p>
            <p className="mt-1 text-xs text-current/80">
              Este rol puede incluir acceso amplio a caja, facturacion, auditoria, reportes o administracion. Confirme que esta cuenta realmente lo necesita.
            </p>
            <label htmlFor="critical-user-role-confirmation" className="mt-3 flex items-start gap-2">
              <Checkbox
                id="critical-user-role-confirmation"
                checked={criticalAccessConfirmed}
                disabled={isSubmitting}
                onChange={(event) => setCriticalAccessConfirmed(event.target.checked)}
              />
              <span>Confirmo que este usuario necesita rol administrativo</span>
            </label>
          </div>
        )}

        {(!canManageRoles || !advancedPermissionMode) && (
          <p className="border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Este usuario heredara los modulos del rol seleccionado. Abra el panel avanzado solo cuando una cuenta necesite un acceso distinto a su rol operativo.
          </p>
        )}

        {canManageRoles && !identityOnly && (
          <div className="space-y-4 border border-operational-border bg-muted/40 p-4 sm:p-5">
            <Button
              aria-expanded={advancedPermissionMode}
              onClick={() => onAdvancedPermissionModeChange(!advancedPermissionMode)}
            >
              Permisos exactos avanzados
            </Button>
            {advancedPermissionMode && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Acceso por modulos</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ajuste los permisos directos de este usuario. El rol funciona como plantilla inicial.
                  </p>
                </div>
                {hasSelectedCriticalPermission && (
                  <div className="border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                    <p className="font-semibold">Permisos criticos seleccionados</p>
                    <p className="mt-1 text-xs text-current/80">
                      Estos accesos pueden modificar caja, recibos, anulaciones, respaldos o usuarios. Confirme que esta cuenta realmente los necesita.
                    </p>
                    <label htmlFor="critical-user-confirmation" className="mt-3 flex items-start gap-2">
                      <Checkbox
                        id="critical-user-confirmation"
                        checked={criticalAccessConfirmed}
                        disabled={isSubmitting}
                        onChange={(event) => setCriticalAccessConfirmed(event.target.checked)}
                      />
                      <span>Confirmo que este usuario necesita permisos criticos</span>
                    </label>
                  </div>
                )}
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {permissionCatalog.map((group) => (
                    <fieldset key={group.module} className="border border-operational-border bg-operational-surface p-4">
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
                          const critical = isCriticalPermission(permission);
                          const riskLabel = permissionRiskLabel(permission);
                          return (
                            <label key={permission.name} htmlFor={id} className="flex items-start gap-3 border border-transparent p-3 text-sm hover:border-border hover:bg-muted/50">
                              <Checkbox
                                id={id}
                                checked={checked}
                                disabled={isSubmitting}
                                onChange={(event) => onToggleUserPermission(permission.name, event.target.checked)}
                              />
                              <span>
                                <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                  {permission.label}
                                  {critical && <Tag color="warning">Permiso critico</Tag>}
                                </span>
                                {critical && riskLabel && (
                                  <span className="block text-xs text-warning-foreground">{riskLabel}</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" loading={isSubmitting} disabled={isSubmitting || (requiresCriticalAccessConfirmation && !criticalAccessConfirmed)}>
            <Save data-icon aria-hidden="true" />
            {isSubmitting ? 'Guardando...' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id}>{label} *</label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className={cn('text-xs text-destructive')}>
          {error}
        </p>
      )}
    </div>
  );
}

function defaultValuesFor(editingUser: AuthUser | null, roles: RoleDefinition[]): UserFormData {
  if (editingUser) {
    return {
      name: editingUser.name,
      email: editingUser.email,
      username: editingUser.username,
      password: '',
      role: editingUser.roles[0] || roles.find((role) => role.name === 'cajero')?.name || 'cajero',
    };
  }
  return {
    name: '',
    email: '',
    username: '',
    password: '',
    role: roles.find((role) => role.name === 'cajero')?.name || 'cajero',
  };
}

export function passwordPolicyHint(): string {
  return 'Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo';
}

export function isPasswordPolicyCompliant(password: string): boolean {
  return password.length >= 12
    && /\p{Ll}/u.test(password)
    && /\p{Lu}/u.test(password)
    && /\p{N}/u.test(password)
    && /[^\p{L}\p{N}]/u.test(password);
}

export type { UserFormData };
export { type UserPayload };

function isElevatedRole(role: RoleDefinition): boolean {
  const normalized = role.name.toLowerCase();

  return role.protected
    || normalized === 'admin'
    || normalized === 'root'
    || normalized === 'supervisor'
    || normalized === 'auditor'
    || role.permissions.some((permission) => isCriticalPermission(permission));
}
