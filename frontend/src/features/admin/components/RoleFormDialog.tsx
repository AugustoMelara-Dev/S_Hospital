import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Info, Save, Search, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { type RoleDefinition, type RolePermission } from '@/lib/api';
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
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next); }}>
      <DialogContent className="max-h-svh overflow-y-auto sm:max-w-3xl" onInteractOutside={(event) => { if (isSaving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{editingRole ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          <DialogDescription>Seleccione los permisos exactos que tendrá este rol operativo.</DialogDescription>
        </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4">
        {globalError && (
          <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{globalError}</AlertDescription></Alert>
        )}

        <Alert><Info /><AlertTitle>Permisos por módulo</AlertTitle><AlertDescription>Seleccione exactamente los accesos del rol para evitar asignaciones accidentales.</AlertDescription></Alert>

        {requiresCriticalConfirmation && (
          <div className="border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
            <p className="font-semibold">Permisos criticos seleccionados</p>
            <p className="mt-1 text-xs text-current/80">
              Estos accesos pueden modificar caja, recibos, anulaciones, respaldos o usuarios. Confirme que el rol realmente los necesita.
            </p>
            {criticalAdded.length > 0 ? (
              <div className="mt-3" role="region" aria-label="Permisos críticos añadidos">
                <p className="text-xs font-semibold uppercase tracking-wide">Accesos añadidos</p>
                <ul className="mt-1 space-y-1">
                  {criticalAdded.map((permission) => (
                    <li key={permission.name}><strong>{permission.label}</strong>{permissionRiskLabel(permission) ? ` — ${permissionRiskLabel(permission)}` : ''}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {criticalRemoved.length > 0 ? (
              <div className="mt-3" role="region" aria-label="Permisos críticos retirados">
                <p className="text-xs font-semibold uppercase tracking-wide">Accesos retirados</p>
                <ul className="mt-1 space-y-1">
                  {criticalRemoved.map((permission) => (
                    <li key={permission.name}><strong>{permission.label}</strong>{permissionRiskLabel(permission) ? ` — ${permissionRiskLabel(permission)}` : ''}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label htmlFor="critical-role-confirmation" className="mt-3 flex items-start gap-2">
              <Checkbox
                id="critical-role-confirmation"
                checked={criticalAccessConfirmed}
                disabled={isSaving}
                onCheckedChange={(checked) => setCriticalAccessConfirmed(Boolean(checked))}
              />
              <span>Confirmo que este rol necesita permisos criticos</span>
            </label>
          </div>
        )}

        <Field className="rounded-xl border bg-muted/40 p-4">
          <FieldLabel htmlFor="role-name">Nombre del rol *</FieldLabel>
          <Input
            id="role-name"
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            placeholder="ejemplo: caja_turno_tarde"
            disabled={isSaving || isProtected}
            autoComplete="off"
          />
          {isProtected && (
            <FieldDescription>
              Los roles protegidos no pueden renombrarse para preservar la asignacion administrativa.
            </FieldDescription>
          )}
        </Field>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={permissionFilter}
            onChange={(event) => setPermissionFilter(event.target.value)}
            placeholder="Buscar permiso por nombre visible o descripcion..."
            aria-label="Buscar permiso"
            className="pl-9"
            disabled={isSaving}
            autoComplete="off"
          />
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto border border-operational-border bg-muted/40 p-4">
          {filteredCatalog.length === 0 ? (
            <p className="border border-dashed border-operational-border bg-operational-surface p-4 text-center text-sm text-muted-foreground">
              No se encontraron permisos para «{permissionFilter}».
            </p>
          ) : (
            filteredCatalog.map((group) => (
              <fieldset key={group.module} className="border border-operational-border bg-operational-surface p-4">
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
                    const critical = isCriticalPermission(permission);
                    const riskLabel = permissionRiskLabel(permission);
                    return (
                      <label key={permission.name} htmlFor={id} className="flex items-start gap-3 border border-transparent p-3 text-sm hover:border-border hover:bg-accent/35">
                        <Checkbox
                          id={id}
                          checked={checked}
                          disabled={isSaving}
                          onCheckedChange={(checked) => onTogglePermission(permission.name, Boolean(checked))}
                        />
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                            {permission.label}
                            {critical && <Badge variant="secondary">Permiso critico</Badge>}
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
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving || (requiresCriticalConfirmation && !criticalAccessConfirmed)}>
            {isSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSaving ? 'Guardando…' : editingRole ? 'Guardar rol' : 'Crear rol'}
          </Button>
        </DialogFooter>
      </form>
      </DialogContent>
    </Dialog>
  );
}
