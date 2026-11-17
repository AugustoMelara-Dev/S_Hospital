import { useDeferredValue, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { KeyRound, Pencil, Plus, Power, Search, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { useMe, usePermissions } from '@/auth/hooks';
import type { Paginated, RolesResponse, User } from '@/api/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Textarea,
  toast,
} from '@/ui';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from '@/features/catalogo/formUtils';
import { Count, LedgerFact, LedgerSection, Sheet, SheetHead, StateMark, Toolbar, ledgerRow } from '@/features/catalogo/ledger';
import { PasswordChecklist, passwordOk } from './password';

export const usersKey = ['users'] as const;
export const rolesKey = ['roles'] as const;

export function useRoles() {
  return useQuery({
    queryKey: rolesKey,
    queryFn: () => api.get<RolesResponse>('/roles'),
  });
}

// ---------- Crear / Editar ----------

function UserDrawer({ user, onClose }: { user: User | null; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const roles = useRoles();
  const isEdit = user !== null;
  const isSelf = user?.id === me.id;
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, 'Ingrese el nombre completo.').max(120, 'Máximo 120 caracteres.'),
          username: z
            .string()
            .trim()
            .min(3, 'Mínimo 3 caracteres.')
            .max(60, 'Máximo 60 caracteres.')
            .regex(/^[a-zA-Z0-9._-]+$/, 'Use letras, números, punto, guion o guion bajo.'),
          email: z.union([z.literal(''), z.email('Correo no válido.').max(160)]),
          password: z.string(),
          role_id: z.string().min(1, 'Seleccione un rol.'),
        })
        .superRefine((v, ctx) => {
          if (!isEdit && !passwordOk(v.password)) {
            ctx.addIssue({
              code: 'custom',
              path: ['password'],
              message: 'La contraseña no cumple los requisitos.',
            });
          }
        }),
    [isEdit],
  );
  type V = z.infer<typeof schema>;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      password: '',
      role_id: user ? String(user.role.id) : '',
    },
  });
  const password = useWatch({ control, name: 'password' });

  const save = useMutation({
    mutationFn: (v: V) => {
      const body: Record<string, unknown> = {
        name: v.name.trim(),
        username: v.username.trim(),
        email: v.email.trim() || null,
      };
      if (!isSelf) body.role_id = Number(v.role_id);
      if (!user) return api.post<User>('/users', { ...body, password: v.password });
      return api.patch<User>(`/users/${user.id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: usersKey });
      toast.success(isEdit ? 'Usuario actualizado.' : 'Usuario creado. Deberá cambiar la contraseña al ingresar.');
      onClose();
    },
    onError: (e) => setFormError(applyServerErrors(e, setError, ['name', 'username', 'email', 'password', 'role_id'], { role: 'role_id' })),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={isEdit ? 'Editar usuario' : 'Crear usuario'}
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col">
        <LedgerSection title="Cuenta">
          <Field label="Nombre completo" required error={errors.name?.message} className={ledgerRow('sm')}>
            <Input {...register('name')} autoComplete="off" maxLength={120} />
          </Field>
          <Field label="Usuario" required error={errors.username?.message} className={ledgerRow('sm')}>
            <Input {...register('username')} autoComplete="off" spellCheck={false} maxLength={60} mono />
          </Field>
          <Field label="Correo" hint="Opcional." error={errors.email?.message} className={ledgerRow('sm')}>
            <Input {...register('email')} type="email" autoComplete="off" maxLength={160} />
          </Field>
          <Field
            label="Rol"
            required
            error={errors.role_id?.message}
            hint={isSelf ? 'No puede cambiar su propio rol.' : undefined}
            className={ledgerRow('sm')}
          >
            <Select
              {...register('role_id')}
              disabled={isSelf}
              placeholder={roles.isLoading ? 'Cargando…' : 'Seleccione…'}
              options={(roles.data?.items ?? []).map((r) => ({
                value: String(r.id),
                label: r.name,
              }))}
            />
          </Field>
        </LedgerSection>
        {!isEdit && (
          <LedgerSection title="Acceso" aside="El usuario deberá cambiarla al ingresar.">
            <Field label="Contraseña inicial" required error={errors.password?.message} className={ledgerRow('sm')}>
              <Input {...register('password')} type="password" autoComplete="new-password" />
            </Field>
            <div className={ledgerRow('sm')}>
              <span aria-hidden="true" />
              <PasswordChecklist password={password ?? ''} />
            </div>
          </LedgerSection>
        )}
        <div className="mt-3">
          <FormAlert message={formError} />
        </div>
      </div>
    </Drawer>
  );
}

// ---------- Restablecer clave ----------

function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const reasonError = reason.trim().length < REASON_MIN ? REASON_MESSAGE : null;
  const pwError = passwordOk(password) ? null : 'La contraseña no cumple los requisitos.';

  const mut = useMutation({
    mutationFn: () =>
      api.post(`/users/${user.id}/reset-password`, {
        password,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(`Clave restablecida. ${user.name} deberá cambiarla al ingresar.`);
      onClose();
    },
    onError: (e) => {
      setError(errorMessage(e));
      setFieldErr((e as { fields?: Record<string, string> }).fields ?? {});
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mut.isPending}
      title="Restablecer clave"
      description={`Asigne una contraseña temporal a ${user.name}.`}
      onSubmit={() => {
        setTouched(true);
        setError(null);
        if (pwError || reasonError) return;
        mut.mutate();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={mut.isPending}>
            Restablecer clave
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Contraseña temporal" required error={fieldErr.password ?? (touched ? pwError : null)}>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <PasswordChecklist password={password} />
        <Field label="Motivo" required error={fieldErr.reason ?? (touched ? reasonError : null)}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <FormAlert message={error} />
      </div>
    </Dialog>
  );
}

// ---------- Tabla ----------

export function UsersTab() {
  const me = useMe();
  const { can } = usePermissions();
  const canManage = can('users.manage');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...usersKey, deferred],
    queryFn: async () =>
      (
        await api.get<Paginated<User>>('/users', {
          search: deferred,
          per_page: 200,
        })
      ).items,
    placeholderData: (p) => p,
  });
  // Client-side filter as well, in case the API ignores `search`.
  const rows = useMemo(() => {
    const s = deferred.toLowerCase();
    if (!s) return q.data;
    return q.data?.filter((u) => `${u.name} ${u.username} ${u.email ?? ''}`.toLowerCase().includes(s));
  }, [q.data, deferred]);

  async function toggle(reason: string) {
    if (!toggling) return;
    setToggleError(null);
    try {
      await api.post(`/users/${toggling.id}/toggle-active`, { reason });
      void qc.invalidateQueries({ queryKey: usersKey });
      toast.success(toggling.active ? 'Usuario desactivado.' : 'Usuario activado.');
      setToggling(null);
    } catch (e) {
      setToggleError(errorMessage(e));
    }
  }

  const all = q.data ?? [];
  const byRole = useMemo(() => {
    const m = new Map<string, { name: string; total: number; active: number }>();
    for (const u of q.data ?? []) {
      const e = m.get(u.role.code) ?? {
        name: u.role.name,
        total: 0,
        active: 0,
      };
      e.total += 1;
      if (u.active) e.active += 1;
      m.set(u.role.code, e);
    }
    return [...m.entries()].sort((x, y) => x[1].name.localeCompare(y[1].name, 'es'));
  }, [q.data]);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Sheet>
          <Toolbar>
            <Input
              aria-label="Buscar usuario"
              placeholder="Buscar por nombre, usuario o correo"
              prefix={<Search />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="w-full sm:w-80"
            />
            <span className="px-1">
              <Count n={rows?.length} one="usuario" many="usuarios" />
            </span>
            {canManage && (
              <Button className="ml-auto" variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
                Crear usuario
              </Button>
            )}
          </Toolbar>
          <DataTable
            caption="Usuarios"
            rows={rows}
            loading={q.isLoading}
            rowKey={(u) => u.id}
            density="compact"
            empty={
              <EmptyState compact icon={<Users />} title="Sin usuarios" description="No hay usuarios que coincidan con la búsqueda." />
            }
            columns={[
              {
                key: 'user',
                header: 'Nombre',
                cell: (u) => (
                  <span className={u.active ? 'font-medium whitespace-nowrap text-ink' : 'font-medium whitespace-nowrap text-ink-2'}>
                    {u.name}
                    {u.id === me.id && <span className="ml-1.5 text-[12px] font-normal text-ink-3">(usted)</span>}
                  </span>
                ),
              },
              {
                key: 'username',
                header: 'Usuario',
                width: '120px',
                cell: (u) => <span className="num text-ink-2">{u.username}</span>,
              },
              {
                key: 'role',
                header: 'Rol',
                width: '140px',
                cell: (u) => u.role.name,
              },
              {
                key: 'status',
                header: 'Estado',
                width: '160px',
                cell: (u) => (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {u.active ? (
                      <StateMark shape="filled" tone="ok">
                        Activo
                      </StateMark>
                    ) : (
                      <StateMark shape="hollow">Inactivo</StateMark>
                    )}
                    {u.must_change_password && <Badge tone="warn">Cambio de clave pendiente</Badge>}
                  </div>
                ),
              },
              {
                key: 'last',
                header: 'Último acceso',
                width: '140px',
                align: 'right',
                cell: (u) =>
                  u.last_login_at ? (
                    <span className="num">{formatDateTime(u.last_login_at)}</span>
                  ) : (
                    <span className="text-ink-3">Nunca</span>
                  ),
              },
            ]}
            rowActions={
              canManage
                ? (u) => {
                    const self = u.id === me.id;
                    return (
                      <>
                        <IconButton size="sm" label={`Editar ${u.name}`} icon={<Pencil />} onClick={() => setEditing(u)} />
                        <IconButton
                          size="sm"
                          label={`Restablecer clave de ${u.name}`}
                          icon={<KeyRound />}
                          onClick={() => setResetting(u)}
                        />
                        <IconButton
                          size="sm"
                          label={self ? 'No puede desactivar su propia cuenta' : u.active ? `Desactivar ${u.name}` : `Activar ${u.name}`}
                          icon={<Power />}
                          disabled={self}
                          className={u.active ? 'hover:enabled:text-danger' : 'hover:enabled:text-ok'}
                          onClick={() => {
                            setToggleError(null);
                            setToggling(u);
                          }}
                        />
                      </>
                    );
                  }
                : undefined
            }
          />
        </Sheet>
        <Sheet aria-label="Resumen de cuentas">
          <SheetHead title="Resumen de cuentas" />
          <div className="flex flex-col px-4 py-1">
            <LedgerFact label="Activas" labelWidth="sm" className="grid-cols-[minmax(0,1fr)_auto] [&>*:not(:first-child)]:col-start-auto">
              <span className="num font-semibold">{all.filter((u) => u.active).length}</span>
            </LedgerFact>
            <LedgerFact label="Inactivas" labelWidth="sm" className="grid-cols-[minmax(0,1fr)_auto] [&>*:not(:first-child)]:col-start-auto">
              <span className="num font-semibold">{all.filter((u) => !u.active).length}</span>
            </LedgerFact>
            <LedgerFact
              label="Cambio de clave pendiente"
              labelWidth="sm"
              className="grid-cols-[minmax(0,1fr)_auto] [&>*:not(:first-child)]:col-start-auto"
            >
              <span className="num font-semibold">{all.filter((u) => u.must_change_password).length}</span>
            </LedgerFact>
          </div>
          <table className="w-full border-collapse border-t border-junta text-[13.5px] leading-5">
            <caption className="sr-only">Usuarios por rol</caption>
            <thead>
              <tr className="bg-ground text-[12px] text-ink-2">
                <th scope="col" className="h-8 border-b border-junta px-4 text-left font-semibold">
                  Rol
                </th>
                <th scope="col" className="h-8 w-20 border-b border-l border-junta px-3 text-right font-semibold">
                  Activas
                </th>
                <th scope="col" className="h-8 w-20 border-b border-l border-junta px-4 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {byRole.map(([code, r]) => (
                <tr key={code} className="[&:last-child>*]:border-b-0">
                  <th scope="row" className="h-9 border-b border-junta px-4 text-left font-medium">
                    {r.name}
                  </th>
                  <td className="num h-9 border-b border-l border-junta px-3 text-right">{r.active}</td>
                  <td className="num h-9 border-b border-l border-junta px-4 text-right">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sheet>
      </div>
      {editing !== null && (
        <UserDrawer
          key={editing === 'new' ? 'new' : editing.id}
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={toggling?.active ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          toggling?.active
            ? `${toggling.name} no podrá iniciar sesión hasta que se reactive.`
            : `${toggling?.name ?? ''} podrá iniciar sesión de nuevo.`
        }
        tone={toggling?.active ? 'danger' : 'primary'}
        confirmLabel={toggling?.active ? 'Desactivar' : 'Activar'}
        reason={{ label: 'Motivo' }}
        error={toggleError}
        onConfirm={toggle}
      />
    </>
  );
}
