import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { usePermissions } from '@/auth/hooks';
import type { Area, Category } from '@/api/types';
import { cn } from '@/lib/cn';
import { Button, DataTable, Drawer, EmptyState, Field, IconButton, Input, Switch, Textarea, toast } from '@/ui';
import { useAreas, useCategories } from './api';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from './formUtils';
import { Count, Dash, Sheet, SheetHead, StateMark, ledgerRow } from './ledger';

type Group = (Category | Area) & { services_count?: number };
type Kind = 'categories' | 'areas';

const COPY: Record<Kind, { one: string; new: string; edit: string; empty: string }> = {
  categories: { one: 'categoría', new: 'Nueva categoría', edit: 'Editar categoría', empty: 'Sin categorías' },
  areas: { one: 'área', new: 'Nueva área', edit: 'Editar área', empty: 'Sin áreas' },
};

function GroupDrawer({ kind, group, onClose }: { kind: Kind; group: Group | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const initialActive = group?.active ?? true;
  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, 'Ingrese el nombre.').max(120, 'Máximo 120 caracteres.'),
          sort_order: z.string().regex(/^\d{1,6}$/, 'Ingrese un número entero (0 o mayor).'),
          active: z.boolean(),
          reason: z.string(),
        })
        .superRefine((v, ctx) => {
          if (group && v.active !== initialActive && v.reason.trim().length < REASON_MIN) {
            ctx.addIssue({ code: 'custom', path: ['reason'], message: REASON_MESSAGE });
          }
        }),
    [group, initialActive],
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
    defaultValues: { name: group?.name ?? '', sort_order: String(group?.sort_order ?? 0), active: initialActive, reason: '' },
  });
  const active = useWatch({ control, name: 'active' });
  const activeChanged = group !== null && active !== initialActive;

  const save = useMutation({
    mutationFn: (v: V) => {
      const body: Record<string, unknown> = { name: v.name.trim(), sort_order: Number(v.sort_order), active: v.active };
      if (!group) return api.post<Group>(`/${kind}`, body);
      if (activeChanged) body.reason = v.reason.trim();
      return api.patch<Group>(`/${kind}/${group.id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [kind] });
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(group ? 'Cambios guardados.' : `${COPY[kind].one[0]!.toUpperCase()}${COPY[kind].one.slice(1)} creada.`);
      onClose();
    },
    onError: (e) => setFormError(applyServerErrors(e, setError, ['name', 'sort_order', 'active', 'reason'])),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={group ? COPY[kind].edit : COPY[kind].new}
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
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col">
        <Field label="Nombre" required error={errors.name?.message} className={ledgerRow('sm')}>
          <Input {...register('name')} autoComplete="off" maxLength={120} />
        </Field>
        <Field label="Orden" hint="Menor número aparece primero." error={errors.sort_order?.message} className={ledgerRow('sm')}>
          <Input className="w-28" {...register('sort_order')} inputMode="numeric" mono />
        </Field>
        <div className="border-b border-junta py-3">
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                label="Activa"
                description={kind === 'categories' ? 'Inactiva: sus conceptos no se pueden facturar.' : undefined}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        {activeChanged && (
          <Field label="Motivo del cambio de disponibilidad" required error={errors.reason?.message} className={cn(ledgerRow('sm'), 'anim-fade-in items-start')}>
            <Textarea {...register('reason')} rows={2} maxLength={500} />
          </Field>
        )}
        <div className="mt-3">
          <FormAlert message={formError} />
        </div>
      </div>
    </Drawer>
  );
}

export function GroupsTab({ kind }: { kind: Kind }) {
  const { can } = usePermissions();
  const canManage = can('catalog.manage');
  const categories = useCategories();
  const areas = useAreas();
  const q = kind === 'categories' ? categories : areas;
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const rows = useMemo(() => [...((q.data as Group[] | undefined) ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [q.data]);

  return (
    <>
      <Sheet>
        <SheetHead
          title={kind === 'categories' ? 'Categorías' : 'Áreas'}
          meta={<Count n={q.data ? rows.length : undefined} one={COPY[kind].one} many={kind === 'categories' ? 'categorías' : 'áreas'} />}
          actions={
            canManage && (
              <Button variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
                {COPY[kind].new}
              </Button>
            )
          }
        />
        <DataTable
          caption={kind === 'categories' ? 'Categorías' : 'Áreas'}
          rows={rows}
          loading={q.isLoading}
          rowKey={(g) => g.id}
          density="compact"
          onRowClick={canManage ? (g) => setEditing(g) : undefined}
          empty={<EmptyState compact icon={<FolderTree />} title={COPY[kind].empty} />}
          columns={[
            { key: 'order', header: 'Orden', numeric: true, width: '84px', cell: (g) => <span className="text-ink-2">{g.sort_order}</span> },
            { key: 'name', header: 'Nombre', cell: (g) => <span className="font-medium">{g.name}</span> },
            ...(kind === 'categories'
              ? [{ key: 'count', header: 'Conceptos', numeric: true, width: '120px', cell: (g: Group) => g.services_count ?? <Dash /> }]
              : []),
            {
              key: 'status',
              header: 'Estado',
              width: '160px',
              cell: (g) => (g.active ? <StateMark shape="filled" tone="ok">Activa</StateMark> : <StateMark shape="hollow">Inactiva</StateMark>),
            },
          ]}
          rowActions={canManage ? (g) => <IconButton size="sm" label={`Editar ${g.name}`} icon={<Pencil />} onClick={() => setEditing(g)} /> : undefined}
        />
      </Sheet>
      {editing !== null && (
        <GroupDrawer
          key={editing === 'new' ? 'new' : editing.id}
          kind={kind}
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
