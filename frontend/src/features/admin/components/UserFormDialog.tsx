import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCallout, AdminDialog, AdminField } from '@/design-system/admin/components';
import { type AuthUser, type RoleDefinition, type RolePermission, type UserPayload } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, SELECT_CLASS } from '../adminUi';
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
  const initializedFormRef = useRef<string | null>(null);
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
  // Mismo predicado que el envío usa para abortar en silencio. Se nombrara
  // aquí para poder explicarlo junto al botón en lugar de dejar un submit
  // mudo: el usuario ve «Crear usuario» apagado sin saber qué falta.
  const submitBlocked = requiresCriticalAccessConfirmation && !criticalAccessConfirmed;

  useLayoutEffect(() => {
    if (!open) {
      initializedFormRef.current = null;
      return;
    }

    const formIdentity = editingUser ? `edit:${editingUser.id}` : 'create';
    if (initializedFormRef.current === formIdentity) {
      return;
    }

    initializedFormRef.current = formIdentity;
    setCriticalAccessConfirmed(false);
    reset(defaultValuesFor(editingUser, assignableRoles));
    if (editingUser) {
      unregister('password');
    }
  }, [open, editingUser, assignableRoles, reset, unregister]);

  useEffect(() => {
    if (!requiresCriticalAccessConfirmation) {
      setCriticalAccessConfirmed(false);
    }
  }, [requiresCriticalAccessConfirmation]);

  const handleSafeSubmit = handleSubmit((data) => {
    if (submitBlocked) {
      return;
    }
    return onSubmit(data);
  });

  const textField = (name: 'name' | 'email' | 'username' | 'password', label: string, props: { type?: string; placeholder?: string } = {}) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AdminField htmlFor={name} label={label} required error={errors[name]?.message}>
          <input
            {...field}
            id={name}
            type={props.type}
            placeholder={props.placeholder}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors[name])}
            className={INPUT_CLASS}
          />
        </AdminField>
      )}
    />
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}
      className="sm:max-w-2xl"
      title={editingUser ? 'Editar usuario' : 'Crear usuario'}
      description="Configure nombre, acceso y rol operativo."
      footer={(
        <>
          {submitBlocked ? (
            <p id="user-form-submit-hint" className="mr-auto max-w-full text-[length:var(--ui-text-xs)] leading-snug text-[color:var(--ui-warn)]">
              Falta confirmar el acceso administrativo: marque la casilla «Confirmo que este usuario necesita rol administrativo» para habilitar
              {' «'}{editingUser ? 'Guardar cambios' : 'Crear usuario'}{'»'}.
            </p>
          ) : null}
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form"
            data-ui-press
            className={PRIMARY_BUTTON}
            aria-describedby={submitBlocked ? 'user-form-submit-hint' : undefined}
            disabled={isSubmitting || submitBlocked}
          >
            {isSubmitting ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </>
      )}
    >
      <form id="user-form" onSubmit={handleSafeSubmit} className="grid gap-5">
        {globalError ? (
          <AdminCallout tone="error" title="No se pudo guardar">{globalError}</AdminCallout>
        ) : null}

        <AdminCallout tone="info" title={editingUser ? 'Edición de cuenta operativa' : 'Alta de usuario individual'}>
          {editingUser ? 'Actualice datos visibles y rol sin modificar la clave.' : 'Cree una cuenta personal para evitar usuarios compartidos.'}
        </AdminCallout>

        {protectedRoleLocked ? (
          <AdminCallout tone="warn" title="Único administrador activo">
            Esta cuenta conserva el rol protegido porque es el único administrador activo. Cree o active otro administrador antes de cambiar este rol.
          </AdminCallout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {textField('name', 'Nombre completo', { placeholder: 'Juan Pérez' })}
          {textField('email', 'Correo electrónico', { type: 'email', placeholder: 'jperez@hospital.org' })}
          {textField('username', 'Nombre de usuario', { placeholder: 'jperez' })}
          {!editingUser ? textField('password', 'Contraseña inicial', { type: 'password', placeholder: 'Mínimo 12 caracteres' }) : null}
        </div>

        <AdminField htmlFor="role" label="Rol operativo" required error={errors.role?.message}>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <select
                id="role"
                aria-label="Rol operativo"
                className={SELECT_CLASS}
                value={field.value}
                disabled={identityOnly}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  onRoleChange?.(event.target.value);
                }}
              >
                {assignableRoles.map((role) => <option key={role.id} value={role.name}>{roleLabel(role.name)}{role.protected ? ' (base protegido)' : ''}</option>)}
              </select>
            )}
          />
        </AdminField>

        {identityOnly ? (
          <p className="border-l-2 border-[var(--ui-line-strong)] pl-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Por seguridad, no puede cambiar su propio rol ni sus permisos. Puede actualizar únicamente sus datos de identidad.
          </p>
        ) : null}

        {hasSelectedElevatedRole ? (
          <div className="rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] p-4 text-[length:var(--ui-text-sm)]">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-[color:var(--ui-ink)]">
              Rol administrativo seleccionado
              <span className="inline-flex items-center rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-warn)]">Rol critico</span>
            </p>
            <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              Este rol puede incluir acceso amplio a caja, facturacion, auditoria, reportes o administracion. Confirme que esta cuenta realmente lo necesita.
            </p>
            <label htmlFor="critical-user-role-confirmation" className="mt-3 flex items-start gap-2">
              <input
                id="critical-user-role-confirmation"
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={criticalAccessConfirmed}
                disabled={isSubmitting}
                onChange={(event) => setCriticalAccessConfirmed(event.target.checked)}
              />
              <span>Confirmo que este usuario necesita rol administrativo</span>
            </label>
          </div>
        ) : null}

        {(!canManageRoles || !advancedPermissionMode) ? (
          <p className="border-l-2 border-[var(--ui-line-strong)] pl-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Este usuario heredara los modulos del rol seleccionado. Abra el panel avanzado solo cuando una cuenta necesite un acceso distinto a su rol operativo.
          </p>
        ) : null}

        {canManageRoles && !identityOnly ? (
          <div className="space-y-4 border-t border-[var(--ui-line)] pt-4">
            <button
              type="button"
              data-ui-press
              className={SECONDARY_BUTTON}
              aria-expanded={advancedPermissionMode}
              onClick={() => onAdvancedPermissionModeChange(!advancedPermissionMode)}
            >
              Permisos exactos avanzados
            </button>
            {advancedPermissionMode ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Acceso por modulos</h3>
                  <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                    Ajuste los permisos directos de este usuario. El rol funciona como plantilla inicial.
                  </p>
                </div>
                {hasSelectedCriticalPermission ? (
                  <div className="rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] p-4 text-[length:var(--ui-text-sm)]">
                    <p className="font-semibold text-[color:var(--ui-ink)]">Permisos criticos seleccionados</p>
                    <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                      Estos accesos pueden modificar caja, recibos, anulaciones, respaldos o usuarios. Confirme que esta cuenta realmente los necesita.
                    </p>
                    <label htmlFor="critical-user-confirmation" className="mt-3 flex items-start gap-2">
                      <input
                        id="critical-user-confirmation"
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={criticalAccessConfirmed}
                        disabled={isSubmitting}
                        onChange={(event) => setCriticalAccessConfirmed(event.target.checked)}
                      />
                      <span>Confirmo que este usuario necesita permisos criticos</span>
                    </label>
                  </div>
                ) : null}
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {permissionCatalog.map((group) => (
                    <fieldset key={group.module} className="border-t border-[var(--ui-line)] pt-3 first:border-t-0 first:pt-0">
                      <legend className="px-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
                        {group.label}
                        <span className="ml-2 text-[length:var(--ui-text-xs)] font-normal text-[color:var(--ui-ink-soft)]">
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
                            <label key={permission.name} htmlFor={id} className="flex items-start gap-3 rounded-[var(--ui-radius)] border border-transparent p-3 text-[length:var(--ui-text-sm)] hover:bg-[var(--ui-surface-alt)]">
                              <input
                                id={id}
                                type="checkbox"
                                className={CHECKBOX_CLASS}
                                checked={checked}
                                disabled={isSubmitting}
                                onChange={(event) => onToggleUserPermission(permission.name, event.target.checked)}
                              />
                              <span>
                                <span className="flex flex-wrap items-center gap-2 font-medium text-[color:var(--ui-ink)]">
                                  {permission.label}
                                  {critical ? <span className="inline-flex items-center rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-warn)]">Permiso critico</span> : null}
                                </span>
                                {critical && riskLabel ? (
                                  <span className="block text-[length:var(--ui-text-xs)] text-[color:var(--ui-warn)]">{riskLabel}</span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

      </form>
    </AdminDialog>
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
