import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { AdminCallout, AdminDialog, AdminEmpty, AdminField } from '@/design-system/admin/components';
import { type RoleDefinition, type RolePermission } from '@/lib/api';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../adminUi';
import { isCriticalPermission, permissionRiskLabel } from './permission-risk';

export type RoleFormPayload = {
  name: string;
  permissions: string[];
};

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole: RoleDefinition | null;
  permissionCatalog: { module: string; label: string; permissions: PermissionOption[] }[];
  selectedPermissions: string[];
  onTogglePermission: (permissionName: string, checked: boolean) => void;
  globalError: string | null;
  onSubmit: (data: RoleFormPayload) => void;
  isSaving: boolean;
};

type PermissionOption = Pick<RolePermission, 'name' | 'label' | 'critical' | 'risk_level' | 'risk_label'>;

export function RoleFormDialog({
  open,
  onOpenChange,
  editingRole,
  permissionCatalog,
  selectedPermissions,
  onTogglePermission,
  globalError,
  onSubmit,
  isSaving,
}: RoleFormDialogProps) {
  const [roleName, setRoleName] = useState(editingRole?.name ?? '');
  const [permissionFilter, setPermissionFilter] = useState('');
  const [criticalAccessConfirmed, setCriticalAccessConfirmed] = useState(false);
  const isProtected = editingRole?.protected === true;
  const permissionsByName = useMemo(() => {
    return new Map(permissionCatalog.flatMap((group) => group.permissions.map((permission) => [permission.name, permission] as const)));
  }, [permissionCatalog]);
  const hasSelectedCriticalPermission = selectedPermissions.some((permissionName) => isCriticalPermission(permissionsByName.get(permissionName)));
  const originalPermissionNames = useMemo(
    () => new Set(editingRole?.permissions.map((permission) => permission.name) ?? []),
    [editingRole],
  );
  const criticalAdded = selectedPermissions
    .filter((name) => !originalPermissionNames.has(name))
    .map((name) => permissionsByName.get(name))
    .filter((permission): permission is PermissionOption => isCriticalPermission(permission));
  const criticalRemoved = [...originalPermissionNames]
    .filter((name) => !selectedPermissions.includes(name))
    .map((name) => editingRole?.permissions.find((permission) => permission.name === name) ?? permissionsByName.get(name))
    .filter((permission): permission is PermissionOption => isCriticalPermission(permission));
  const requiresCriticalConfirmation = hasSelectedCriticalPermission || criticalAdded.length > 0 || criticalRemoved.length > 0;

  useEffect(() => {
    setRoleName(editingRole?.name ?? '');
  }, [editingRole]);

  useEffect(() => {
    if (!open) {
      setPermissionFilter('');
      setCriticalAccessConfirmed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!requiresCriticalConfirmation) {
      setCriticalAccessConfirmed(false);
    }
  }, [requiresCriticalConfirmation]);

  const filteredCatalog = useMemo(() => {
    const query = permissionFilter.trim().toLowerCase();
    if (!query) {
      return permissionCatalog;
    }
    return permissionCatalog
      .map((group) => {
        const groupMatches = group.label.toLowerCase().includes(query);
        return {
          ...group,
          permissions: group.permissions.filter((permission) => (
            groupMatches
            || permission.label.toLowerCase().includes(query)
            || permission.risk_label?.toLowerCase().includes(query)
          )),
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [permissionCatalog, permissionFilter]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiresCriticalConfirmation && !criticalAccessConfirmed) {
      return;
    }
    onSubmit({ name: roleName.trim(), permissions: [...selectedPermissions] });
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!isSaving) onOpenChange(next); }}
      className="sm:max-w-3xl"
      title={editingRole ? 'Editar rol' : 'Nuevo rol'}
      description="Seleccione los permisos exactos que tendrá este rol operativo."
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="role-form"
            data-ui-press
            className={PRIMARY_BUTTON}
            disabled={isSaving || (requiresCriticalConfirmation && !criticalAccessConfirmed)}
          >
            {isSaving ? 'Guardando…' : editingRole ? 'Guardar rol' : 'Crear rol'}
          </button>
        </>
      )}
    >
      <form id="role-form" onSubmit={handleSubmit} className="grid gap-4">
        {globalError ? (
          <AdminCallout tone="error" title="No se pudo guardar">{globalError}</AdminCallout>
        ) : null}

        <AdminCallout tone="info" title="Permisos por módulo">
          Seleccione exactamente los accesos del rol para evitar asignaciones accidentales.
        </AdminCallout>

        {requiresCriticalConfirmation ? (
          <div className="rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] p-4 text-[length:var(--ui-text-sm)]">
            <p className="font-semibold text-[color:var(--ui-ink)]">Permisos criticos seleccionados</p>
            <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              Estos accesos pueden modificar caja, recibos, anulaciones, respaldos o usuarios. Confirme que el rol realmente los necesita.
            </p>
            {criticalAdded.length > 0 ? (
              <div className="mt-3" role="region" aria-label="Permisos críticos añadidos">
                <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Accesos añadidos</p>
                <ul className="mt-1 space-y-1">
                  {criticalAdded.map((permission) => (
                    <li key={permission.name}><strong>{permission.label}</strong>{permissionRiskLabel(permission) ? ` — ${permissionRiskLabel(permission)}` : ''}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {criticalRemoved.length > 0 ? (
              <div className="mt-3" role="region" aria-label="Permisos críticos retirados">
                <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Accesos retirados</p>
                <ul className="mt-1 space-y-1">
                  {criticalRemoved.map((permission) => (
                    <li key={permission.name}><strong>{permission.label}</strong>{permissionRiskLabel(permission) ? ` — ${permissionRiskLabel(permission)}` : ''}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label htmlFor="critical-role-confirmation" className="mt-3 flex items-start gap-2">
              <input
                id="critical-role-confirmation"
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={criticalAccessConfirmed}
                disabled={isSaving}
                onChange={(event) => setCriticalAccessConfirmed(event.target.checked)}
              />
              <span>Confirmo que este rol necesita permisos criticos</span>
            </label>
          </div>
        ) : null}

        <div className="border-y border-[var(--ui-line)] py-4">
          <AdminField
            htmlFor="role-name"
            label="Nombre del rol"
            required
            hint={isProtected ? 'Los roles protegidos no pueden renombrarse para preservar la asignacion administrativa.' : undefined}
          >
            <input
              id="role-name"
              type="text"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="ejemplo: caja_turno_tarde"
              disabled={isSaving || isProtected}
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </AdminField>
        </div>

        <div className="relative">
          <label htmlFor="role-permission-filter" className="sr-only">Buscar permiso</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
          <input
            id="role-permission-filter"
            type="search"
            value={permissionFilter}
            onChange={(event) => setPermissionFilter(event.target.value)}
            placeholder="Buscar permiso por nombre visible o descripcion..."
            className={`${INPUT_CLASS} pl-9`}
            disabled={isSaving}
            autoComplete="off"
          />
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto border-y border-[var(--ui-line)] py-3">
          {filteredCatalog.length === 0 ? (
            <AdminEmpty title="Sin coincidencias" description={`No se encontraron permisos para «${permissionFilter}».`} />
          ) : (
            filteredCatalog.map((group) => (
              <fieldset key={group.module} className="border-t border-[var(--ui-line)] pt-3 first:border-t-0 first:pt-0">
                <legend className="px-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
                  {group.label}
                  <span className="ml-2 text-[length:var(--ui-text-xs)] font-normal text-[color:var(--ui-ink-soft)]">
                    {group.permissions.length} permiso{group.permissions.length === 1 ? '' : 's'}
                  </span>
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const id = `permission-${permission.name.replace(/[^A-Za-z0-9_-]/g, '-')}`;
                    const checked = selectedPermissions.includes(permission.name);
                    const critical = isCriticalPermission(permission);
                    const riskLabel = permissionRiskLabel(permission);
                    return (
                      <label key={permission.name} htmlFor={id} className="flex items-start gap-3 rounded-[var(--ui-radius)] border border-transparent p-3 text-[length:var(--ui-text-sm)] hover:bg-[var(--ui-surface-alt)]">
                        <input
                          id={id}
                          type="checkbox"
                          className={CHECKBOX_CLASS}
                          checked={checked}
                          disabled={isSaving}
                          onChange={(event) => onTogglePermission(permission.name, event.target.checked)}
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
            ))
          )}
        </div>

      </form>
    </AdminDialog>
  );
}
