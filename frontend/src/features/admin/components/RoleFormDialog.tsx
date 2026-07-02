import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { InfoPanel } from '@/components/shared';
import { type RoleDefinition } from '@/lib/api';

export type RoleFormPayload = {
  name: string;
  permissions: string[];
};

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole: RoleDefinition | null;
  permissionCatalog: { module: string; label: string; permissions: { name: string; label: string }[] }[];
  selectedPermissions: string[];
  onTogglePermission: (permissionName: string, checked: boolean) => void;
  globalError: string | null;
  onSubmit: (data: RoleFormPayload) => void;
  isSaving: boolean;
};

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
  const isProtected = editingRole?.protected === true;

  useEffect(() => {
    setRoleName(editingRole?.name ?? '');
  }, [editingRole]);

  useEffect(() => {
    if (!open) {
      setPermissionFilter('');
    }
  }, [open]);

  const filteredCatalog = useMemo(() => {
    const query = permissionFilter.trim().toLowerCase();
    if (!query) {
      return permissionCatalog;
    }
    return permissionCatalog
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            permission.label.toLowerCase().includes(query) ||
            permission.name.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [permissionCatalog, permissionFilter]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name: roleName.trim(), permissions: [...selectedPermissions] });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!isSaving) onOpenChange(value);
      }}
      size="lg"
      title={editingRole ? 'Editar rol' : 'Nuevo rol'}
      description="Seleccione los permisos exactos que tendra este rol operativo."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {globalError && (
          <Alert variant="destructive" title="No se pudo guardar">
            {globalError}
          </Alert>
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
            disabled={isSaving || isProtected}
            autoComplete="off"
          />
          {isProtected && (
            <p className="text-xs text-muted-foreground">
              Los roles protegidos no pueden renombrarse para preservar la asignacion administrativa.
            </p>
          )}
        </div>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={permissionFilter}
            onChange={(event) => setPermissionFilter(event.target.value)}
            placeholder="Buscar permiso por nombre o descripción..."
            aria-label="Buscar permiso"
            className="pl-9"
            disabled={isSaving}
            autoComplete="off"
          />
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border border-operational-border bg-operational-panel/40 p-3">
          {filteredCatalog.length === 0 ? (
            <p className="rounded-md border border-dashed border-operational-border bg-operational-surface p-4 text-center text-sm text-muted-foreground">
              No se encontraron permisos para «{permissionFilter}».
            </p>
          ) : (
            filteredCatalog.map((group) => (
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
                          disabled={isSaving}
                          onCheckedChange={(value) => onTogglePermission(permission.name, value === true)}
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
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save data-icon aria-hidden="true" />
            {isSaving ? 'Guardando...' : editingRole ? 'Guardar rol' : 'Crear rol'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}