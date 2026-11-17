import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Plus, Search, ShieldCheck } from 'lucide-react';
import { api, errorMessage, isApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/auth/hooks';
import type { Permission, PermissionCatalog, Role } from '@/api/types';
import { Badge, Button, Checkbox, DataTable, Drawer, EmptyState, Field, Input, toast } from '@/ui';
import { FormAlert } from '@/features/catalogo/formUtils';
import { Dash, Sheet, SheetHead, ledgerRow } from '@/features/catalogo/ledger';
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <Field label="Nombre" required error={fields.name ?? (touched ? nameError : null)} className={ledgerRow('sm')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={80} />
          </Field>
          <Field
            label="Código"
            required={!role}
            error={fields.code ?? (touched ? codeError : null)}
            hint={role ? 'No se puede cambiar.' : undefined}
            className={ledgerRow('sm')}
          >
            <Input className="w-60" value={code} onChange={(e) => setCode(e.target.value)} disabled={Boolean(role)} mono maxLength={40} />
          </Field>
        </div>
        <Input aria-label="Filtrar permisos" placeholder="Filtrar permisos" prefix={<Search />} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {fields.permissions && <p className="text-[12.5px] text-danger">{fields.permissions}</p>}
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-junta">
          {visible.map((m) => {
            const codes = m.permissions.map((p) => p.code);
            return (
              <fieldset key={m.module} className="border-b border-junta last:border-b-0">
                <legend className="sr-only">{m.label}</legend>
                <div className="flex items-center justify-between border-b border-junta bg-ground px-3 py-2">
                  <ModuleCheckbox label={m.label} state={moduleState(perms, codes)} disabled={readOnly} onToggle={() => toggleModule(codes)} />
                  <span className="num text-[12px] font-semibold text-ink-2">
                    {codes.filter((c) => perms.has(c)).length}/{codes.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-px bg-junta sm:grid-cols-2">
                  {m.permissions.map((p) => (
                    <Checkbox
                      key={p.code}
                      className="bg-surface px-3 py-2"
                      label={p.label}
                      description={<span className="num text-[11.5px]">{p.code}</span>}
                      checked={perms.has(p.code)}
                      disabled={readOnly}
                      onChange={() => toggle(p.code)}
                    />
                  ))}
                  {m.permissions.length % 2 === 1 && <span aria-hidden="true" className="hidden bg-surface sm:block" />}
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

function CellCheck({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <span className="relative inline-flex size-[18px] align-middle">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={cn(
          'peer size-[18px] appearance-none rounded-[3px] border border-junta-strong bg-field',
          'transition-[background-color,border-color] duration-[120ms] ease-out',
          'checked:border-slate checked:bg-slate enabled:cursor-pointer enabled:hover:border-slate',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:checked:border-ink-3 disabled:checked:bg-ink-3',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
        )}
      />
      <Check
        aria-hidden="true"
        strokeWidth={2.6}
        className="pointer-events-none absolute inset-0 m-auto size-3 text-slate-ink opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}

const sameSet = (a: Set<string>, b: readonly string[]) => a.size === b.length && b.every((c) => a.has(c));

/**
 * Roles × permissions as one junta grid. Administración is fixed (all
 * permissions); other columns are edited in place and saved together.
 */
export function PermissionMatrix({
  roles,
  catalog,
  canManage,
  onOpenRole,
}: {
  roles: Role[];
  catalog: PermissionCatalog;
  canManage: boolean;
  onOpenRole: (r: Role) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<number, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);
  const isAdmin = (r: Role) => r.code === 'admin';
  const editable = (r: Role) => canManage && !isAdmin(r);
  const permsOf = (r: Role): Set<string> => draft[r.id] ?? new Set(r.permissions);
  const has = (r: Role, code: string) => isAdmin(r) || permsOf(r).has(code);
  const dirty = roles.filter((r) => {
    const d = draft[r.id];
    return d !== undefined && !sameSet(d, r.permissions);
  });

  const toggle = (r: Role, code: string) =>
    setDraft((prev) => {
      const next = new Set(prev[r.id] ?? r.permissions);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, [r.id]: next };
    });

  const save = useMutation({
    mutationFn: () =>
      Promise.all(dirty.map((r) => api.patch<Role>(`/roles/${r.id}`, { name: r.name, permissions: [...permsOf(r)] as Permission[] }))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rolesKey });
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(dirty.length === 1 ? 'Rol actualizado.' : 'Roles actualizados.');
      setDraft({});
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Sheet>
      <SheetHead
        title="Permisos por rol"
        meta={
          dirty.length > 0 ? (
            <span className="font-semibold text-slate-text">{dirty.length === 1 ? '1 rol con cambios sin guardar' : `${dirty.length} roles con cambios sin guardar`}</span>
          ) : canManage ? (
            'Marque o desmarque para cambiar los permisos de cada rol.'
          ) : undefined
        }
        actions={
          canManage && (
            <>
              <Button variant="ghost" disabled={dirty.length === 0 || save.isPending} onClick={() => setDraft({})}>
                Descartar
              </Button>
              <Button variant="primary" disabled={dirty.length === 0} loading={save.isPending} onClick={() => save.mutate()}>
                Guardar permisos
              </Button>
            </>
          )
        }
      />
      {error && (
        <div className="border-b border-junta px-4 py-2">
          <FormAlert message={error} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px] leading-5">
          <caption className="sr-only">Permisos por rol</caption>
          <thead>
            <tr className="bg-ground">
              <th scope="col" className="h-10 min-w-[320px] border-b border-junta px-4 text-left text-[12px] font-semibold text-ink-2">
                Permiso
              </th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="h-10 w-[128px] border-b border-l border-junta px-2 text-center align-middle text-[12.5px] font-semibold text-ink">
                  <button
                    type="button"
                    onClick={() => onOpenRole(r)}
                    title={`Abrir el rol ${r.name}`}
                    className="inline-flex max-w-full items-center justify-center gap-1 rounded-[2px] px-1 hover:text-slate-text hover:underline"
                  >
                    {isAdmin(r) && <Lock className="size-3 shrink-0 text-ink-3" aria-label="Solo lectura" />}
                    <span className="truncate">{r.name}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {catalog.map((m) => {
            const codes = m.permissions.map((p) => p.code);
            return (
              <tbody key={m.module}>
                <tr className="bg-surface-2">
                  <th scope="rowgroup" className="h-8 border-b border-junta px-4 text-left text-[12.5px] font-bold text-ink">
                    {m.label}
                  </th>
                  {roles.map((r) => {
                    const n = codes.filter((c) => has(r, c)).length;
                    return (
                      <td
                        key={r.id}
                        className={cn('num h-8 border-b border-l border-junta text-center text-[12px] font-semibold', n === 0 ? 'text-ink-3' : 'text-ink-2')}
                      >
                        {n}/{codes.length}
                      </td>
                    );
                  })}
                </tr>
                {m.permissions.map((p) => (
                  <tr key={p.code}>
                    <th scope="row" className="h-9 border-b border-junta px-4 py-1 text-left font-normal">
                      <span className="text-ink">{p.label}</span>
                      <span className="num ml-2 text-[11.5px] text-ink-3">{p.code}</span>
                    </th>
                    {roles.map((r) => {
                      const d = draft[r.id];
                      const changed = d !== undefined && d.has(p.code) !== r.permissions.includes(p.code);
                      return (
                        <td key={r.id} className={cn('h-9 border-b border-l border-junta text-center', changed && 'bg-slate-soft')}>
                          <CellCheck
                            label={`${p.label}: ${r.name}`}
                            checked={has(r, p.code)}
                            disabled={!editable(r) || save.isPending}
                            onChange={() => toggle(r, p.code)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </Sheet>
  );
}

export function RolesTab() {
  const { can } = usePermissions();
  const roles = useRoles();
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const catalog = roles.data?.permission_catalog ?? [];
  const items = roles.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Sheet>
        <SheetHead
          title="Roles"
          meta="Cada usuario tiene un rol. Los roles del sistema no se pueden eliminar."
          actions={
            can('users.manage') && (
              <Button leftIcon={<Plus />} onClick={() => setEditing('new')}>
                Nuevo rol
              </Button>
            )
          }
        />
        <DataTable
          caption="Roles"
          rows={roles.data?.items}
          loading={roles.isLoading}
          rowKey={(r) => r.id}
          density="compact"
          onRowClick={(r) => setEditing(r)}
          empty={<EmptyState compact icon={<ShieldCheck />} title="Sin roles" />}
          columns={[
            {
              key: 'name',
              header: 'Rol',
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.is_system && <Badge tone="neutral">Sistema</Badge>}
                  {r.code === 'admin' && <Lock className="size-3.5 text-ink-3" aria-label="Solo lectura" />}
                </div>
              ),
            },
            { key: 'code', header: 'Código', width: '200px', cell: (r) => <span className="num text-ink-2">{r.code}</span> },
            { key: 'perms', header: 'Permisos', numeric: true, width: '120px', cell: (r) => (r.code === 'admin' ? 'Todos' : r.permissions.length) },
            { key: 'users', header: 'Usuarios', numeric: true, width: '120px', cell: (r) => r.users_count ?? <Dash /> },
          ]}
        />
      </Sheet>
      {items.length > 0 && catalog.length > 0 && (
        <PermissionMatrix roles={items} catalog={catalog} canManage={can('users.manage')} onOpenRole={(r) => setEditing(r)} />
      )}
      {editing !== null && (
        <RoleDrawer key={editing === 'new' ? 'new' : editing.id} role={editing === 'new' ? null : editing} catalog={catalog} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
