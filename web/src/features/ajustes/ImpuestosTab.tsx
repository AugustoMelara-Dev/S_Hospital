import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Pencil, Percent, Plus, Star, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatRateBp } from '@/lib/money';
import { qk } from '@/api/queryClient';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, ConfirmDialog, DataTable, Drawer, EmptyState, Field, IconButton, Input, Switch, Textarea, toast } from '@/ui';
import { type TaxRateRow, taxRatesKey, useTaxRates } from '@/features/catalogo/api';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from '@/features/catalogo/formUtils';

/** "15" → 1500, "12.5" → 1250 (no floats). */
export function percentToBp(text: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
export const bpToPercent = (bp: number) => formatRateBp(bp).replace(' %', '');

function TaxDrawer({ rate, onClose }: { rate: TaxRateRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, 'Ingrese el nombre.').max(60),
          rate: z.string().refine((t) => percentToBp(t) !== null, 'Ingrese un porcentaje válido (ej. 15 o 12.5).'),
          active: z.boolean(),
          is_default: z.boolean(),
          reason: z.string(),
        })
        .superRefine((v, ctx) => {
          if (rate && v.reason.trim().length < REASON_MIN) ctx.addIssue({ code: 'custom', path: ['reason'], message: REASON_MESSAGE });
        }),
    [rate],
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
      name: rate?.name ?? '',
      rate: rate ? bpToPercent(rate.rate_bp) : '',
      active: rate?.active ?? true,
      is_default: rate?.is_default ?? false,
      reason: '',
    },
  });
  const save = useMutation({
    mutationFn: (v: V) => {
      const body = { name: v.name.trim(), rate_bp: percentToBp(v.rate), active: v.active, is_default: v.is_default };
      if (!rate) return api.post<TaxRateRow>('/tax-rates', body);
      return api.patch<TaxRateRow>(`/tax-rates/${rate.id}`, { ...body, reason: v.reason.trim() });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taxRatesKey });
      void qc.invalidateQueries({ queryKey: qk.settings });
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(rate ? 'Tasa actualizada.' : 'Tasa creada.');
      onClose();
    },
    onError: (e) => setFormError(applyServerErrors(e, setError, ['name', 'rate', 'active', 'is_default', 'reason'], { rate_bp: 'rate' })),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={rate ? 'Editar tasa de impuesto' : 'Nueva tasa de impuesto'}
      description={rate ? 'Las facturas emitidas conservan la tasa con que se emitieron.' : undefined}
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
      <div className="flex flex-col gap-4">
        <Field label="Nombre" required error={errors.name?.message}>
          <Input {...register('name')} maxLength={60} placeholder="ISV 15 %" />
        </Field>
        <Field label="Tasa" required error={errors.rate?.message}>
          <Input {...register('rate')} inputMode="decimal" mono suffix={<span className="pr-1.5 text-[13px]">%</span>} className="w-32" wrapperClassName="w-32" />
        </Field>
        <Controller control={control} name="active" render={({ field }) => <Switch label="Activa" checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller
          control={control}
          name="is_default"
          render={({ field }) => (
            <Switch label="Predeterminada" description="Se propone al crear conceptos nuevos." checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {rate && (
          <Field label="Motivo" required error={errors.reason?.message}>
            <Textarea {...register('reason')} rows={2} maxLength={500} />
          </Field>
        )}
        <FormAlert message={formError} />
      </div>
    </Drawer>
  );
}

export function ImpuestosTab() {
  const { can } = usePermissions();
  const canEdit = can('settings.update');
  const qc = useQueryClient();
  const q = useTaxRates();
  const [editing, setEditing] = useState<TaxRateRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TaxRateRow | null>(null);
  const [delError, setDelError] = useState<string | null>(null);

  async function remove(reason: string) {
    if (!deleting) return;
    setDelError(null);
    try {
      await api.delete(`/tax-rates/${deleting.id}`, { reason });
      void qc.invalidateQueries({ queryKey: taxRatesKey });
      toast.success('Tasa eliminada.');
      setDeleting(null);
    } catch (e) {
      setDelError(errorMessage(e));
    }
  }

  const inUse = (r: TaxRateRow) => (r.services_count ?? 0) > 0 || r.in_use === true;

  return (
    <>
      <Card
        flush
        title="Impuestos"
        description="Tasas disponibles para los conceptos. Los conceptos sin tasa son exentos."
        actions={
          canEdit && (
            <Button size="sm" variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
              Nueva tasa
            </Button>
          )
        }
      >
        <DataTable
          caption="Tasas de impuesto"
          rows={q.data}
          loading={q.isLoading}
          rowKey={(r) => r.id}
          empty={<EmptyState compact icon={<Percent />} title="Sin tasas" />}
          columns={[
            {
              key: 'name',
              header: 'Nombre',
              cell: (r) => (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {r.is_default && <Star className="size-3.5 fill-warn text-warn" aria-label="Predeterminada" />}
                  {r.name}
                </span>
              ),
            },
            { key: 'rate', header: 'Tasa', numeric: true, cell: (r) => formatRateBp(r.rate_bp) },
            { key: 'count', header: 'Conceptos', numeric: true, cell: (r) => r.services_count ?? '—' },
            {
              key: 'status',
              header: 'Estado',
              cell: (r) => (
                <div className="flex gap-1">
                  {r.active ? <Badge tone="ok" dot>Activa</Badge> : <Badge dot>Inactiva</Badge>}
                  {r.is_default && <Badge tone="brand">Predeterminada</Badge>}
                </div>
              ),
            },
          ]}
          rowActions={
            canEdit
              ? (r) => (
                  <>
                    <IconButton size="sm" label={`Editar ${r.name}`} icon={<Pencil />} onClick={() => setEditing(r)} />
                    <IconButton
                      size="sm"
                      label={inUse(r) ? 'En uso: no se puede eliminar' : `Eliminar ${r.name}`}
                      icon={<Trash2 />}
                      disabled={inUse(r)}
                      onClick={() => {
                        setDelError(null);
                        setDeleting(r);
                      }}
                    />
                  </>
                )
              : undefined
          }
        />
      </Card>
      {editing !== null && <TaxDrawer key={editing === 'new' ? 'new' : editing.id} rate={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar tasa"
        description={`Se eliminará "${deleting?.name ?? ''}". Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Eliminar"
        reason={{ label: 'Motivo' }}
        error={delError}
        onConfirm={remove}
      />
    </>
  );
}
