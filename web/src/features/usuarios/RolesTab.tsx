import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Search, ShieldCheck } from 'lucide-react';
import { api, errorMessage, isApiError } from '@/lib/api';
import { usePermissions } from '@/auth/hooks';
import type { Permission, PermissionCatalog, Role } from '@/api/types';
import { Badge, Button, Card, Checkbox, DataTable, Drawer, EmptyState, Field, Input, toast } from '@/ui';
import { FormAlert } from '@/features/catalogo/formUtils';
import { rolesKey, useRoles } from './UsersTab';

export function moduleState(perms: Set<string>, codes: string[]): 'all' | 'some' | 'none' {
  const n = codes.filter((c) => perms.has(c)).length;
  return n === 0 ? 'none' : n === codes.length ? 'all' : 'some';
}

function ModuleCheckbox({ label, state, disabled, onToggle }: { label: string; state: 'all' | 'some' | 'none'; disabled: boolean; onToggle: () => void }) {
  return (
    <Checkbox
      label={<span className="font-semibold">{label}</span>}
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'some';
      }}
      aria-label={`Seleccionar todo: ${label}`}
      disabled={disabled}
      onChange={onToggle}
    />
  );
}

export function RoleDrawer({ role, catalog, onClose }: { role: Role | null; catalog: PermissionCatalog; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const readOnly = role?.code === 'admin' || !can('users.manage');
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [perms, setPerms] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [filter, setFilter] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const f = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      catalog
        .map((m) => ({
          ...m,
          permissions: f
            ? m.permissions.filter((p) => p.label.toLowerCase().includes(f) || p.code.includes(f) || m.label.toLowerCase().includes(f))
            : m.permissions,
        }))
        .filter((m) => m.permissions.length > 0),
    [catalog, f],
  );

  const toggle = (c: string) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const toggleModule = (codes: string[]) =>
    setPerms((prev) => {
      const next = new Set(prev);
      const all = codes.every((c) => next.has(c));
      for (const c of codes) {
        if (all) next.delete(c);
        else next.add(c);
      }
      return next;
    });

  const nameError = name.trim().length === 0 ? 'Ingrese el nombre del rol.' : null;
  const codeError = !role && !/^[a-z][a-z0-9_]{1,39}$/.test(code.trim()) ? 'Use minúsculas, números o guion bajo (2–40).' : null;

  const save = useMutation({
    mutationFn: () => {
      const permissions = [...perms] as Permission[];
      if (!role) return api.post<Role>('/roles', { code: code.trim(), name: name.trim(), permissions });
      return api.patch<Role>(`/roles/${role.id}`, { name: name.trim(), permissions });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rolesKey });
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(role ? 'Rol actualizado.' : 'Rol creado.');
      onClose();
    },
    onError: (e) => {
      setError(errorMessage(e));
      if (isApiError(e)) setFields(e.fields);
    },
  });

  return (
    <Drawer
      open
      width="lg"
      onClose={onClose}
      dismissible={!save.isPending}
      title={role ? (readOnly ? role.name : 'Editar rol') : 'Nuevo rol'}
      description={role?.code === 'admin' ? 'El rol de administración tiene todos los permisos y no se puede modificar.' : `${perms.size} permisos seleccionados.`}
      onSubmit={
        readOnly
          ? undefined
          : () => {
              setTouched(true);
              setError(null);
              setFields({});
              if (nameError || codeError) return;
              save.mutate();
            }
      }
      footer={
        readOnly ? (
          <Button onClick={onClose}>Cerrar</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {role ? 'Guardar rol' : 'Crear rol'}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" required error={fields.name ?? (touched ? nameError : null)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={80} />
          </Field>
          <Field label="Código" required={!role} error={fields.code ?? (touched ? codeError : null)} hint={role ? 'No se puede cambiar.' : undefined}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={Boolean(role)} mono maxLength={40} />
          </Field>
        </div>
        <Input aria-label="Filtrar permisos" placeholder="Filtrar permisos" prefix={<Search />} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {fields.permissions && <p className="text-[12.5px] text-danger">{fields.permissions}</p>}
        <div className="flex flex-col gap-3">
          {visible.map((m) => {
            const codes = m.permissions.map((p) => p.code);
            return (
              <fieldset key={m.module} className="rounded-[var(--radius-md)] border border-line">
                <legend className="sr-only">{m.label}</legend>
                <div className="flex items-center justify-between border-b border-line bg-surface-2/50 px-3 py-2">
                  <ModuleCheckbox label={m.label} state={moduleState(perms, codes)} disabled={readOnly} onToggle={() => toggleModule(codes)} />
                  <span className="num text-[12px] text-ink-3">
                    {codes.filter((c) => perms.has(c)).length}/{codes.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-2">
                  {m.permissions.map((p) => (
                    <Checkbox
                      key={p.code}
                      label={p.label}
                      description={<span className="num text-[11.5px]">{p.code}</span>}
                      checked={perms.has(p.code)}
                      disabled={readOnly}
                      onChange={() => toggle(p.code)}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
          {visible.length === 0 && <EmptyState compact title="Sin coincidencias" description="Ningún permiso coincide con el filtro." />}
        </div>
        <FormAlert message={error} />
      </div>
    </Drawer>
  );
}

export function RolesTab() {
  const { can } = usePermissions();
  const roles = useRoles();
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const catalog = roles.data?.permission_catalog ?? [];

  return (
    <>
      <Card
        flush
        title="Roles"
        description="Cada usuario tiene un rol. Los roles del sistema no se pueden eliminar."
        actions={
          can('users.manage') && (
            <Button size="sm" variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
              Nuevo rol
            </Button>
          )
        }
      >
        <DataTable
          caption="Roles"
          rows={roles.data?.items}
          loading={roles.isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => setEditing(r)}
          empty={<EmptyState compact icon={<ShieldCheck />} title="Sin roles" />}
          columns={[
            {
              key: 'name',
              header: 'Rol',
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.is_system && <Badge tone="brand">Sistema</Badge>}
                  {r.code === 'admin' && <Lock className="size-3.5 text-ink-3" aria-label="Solo lectura" />}
                </div>
              ),
            },
            { key: 'code', header: 'Código', cell: (r) => <span className="num text-ink-2">{r.code}</span> },
            { key: 'perms', header: 'Permisos', numeric: true, cell: (r) => (r.code === 'admin' ? 'Todos' : r.permissions.length) },
            { key: 'users', header: 'Usuarios', numeric: true, cell: (r) => r.users_count ?? '—' },
          ]}
        />
      </Card>
      {editing !== null && (
        <RoleDrawer key={editing === 'new' ? 'new' : editing.id} role={editing === 'new' ? null : editing} catalog={catalog} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
