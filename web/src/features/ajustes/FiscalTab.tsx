import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { FileDigit, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import type { FiscalSequence, Paginated } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, DataTable, Drawer, EmptyState, Field, IconButton, Input, Switch, Textarea, toast } from '@/ui';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from '@/features/catalogo/formUtils';


export const LOW_RANGE = 100;
export const fiscalKey = ['fiscal-sequences'] as const;

export function formatFiscalNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(8, '0')}`;
}

/** Status flags computed by the server (`FiscalSequenceOut`). */
export function fiscalStatus(s: FiscalSequence) {
  return { remaining: s.remaining, expired: s.expired, exhausted: s.exhausted, low: !s.exhausted && s.low_range };
}

export function FiscalChips({ s }: { s: FiscalSequence }) {
  const st = fiscalStatus(s);
  return (
    <div className="flex flex-wrap gap-1">
      {s.active && <Badge tone="brand" dot>Activa</Badge>}
      {st.expired ? <Badge tone="danger">Vencida</Badge> : <Badge tone="ok">Vigente</Badge>}
      {st.exhausted && <Badge tone="danger">Rango agotado</Badge>}
      {st.low && <Badge tone="warn">Rango por agotarse</Badge>}
    </div>
  );
}

const SEQ_MAX = 99_999_999;

function SequenceDrawer({ seq, onClose }: { seq: FiscalSequence | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      z
        .object({
          prefix: z.string().trim().min(1, 'Ingrese el prefijo.').max(32).regex(/^[0-9A-Za-z][0-9A-Za-z-]*$/, 'Use letras, números y guiones.'),
          cai: z.string().trim().min(1, 'Ingrese el CAI.').max(128),
          valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese la fecha límite de emisión.'),
          min_number: z.string().regex(/^\d{1,8}$/, 'Número entero.'),
          max_number: z.string().regex(/^\d{1,8}$/, 'Número entero.'),
          active: z.boolean(),
          reason: z.string(),
        })
        .superRefine((v, ctx) => {
          const min = Number(v.min_number);
          const max = Number(v.max_number);
          if (min < 1) ctx.addIssue({ code: 'custom', path: ['min_number'], message: 'Debe ser 1 o mayor.' });
          if (max > SEQ_MAX) ctx.addIssue({ code: 'custom', path: ['max_number'], message: 'Máximo 99,999,999.' });
          if (max < min) ctx.addIssue({ code: 'custom', path: ['max_number'], message: '"Hasta" debe ser mayor o igual que "Desde".' });
          if (seq && v.reason.trim().length < REASON_MIN) ctx.addIssue({ code: 'custom', path: ['reason'], message: REASON_MESSAGE });
        }),
    [seq],
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
      prefix: seq?.prefix ?? '',
      cai: seq?.cai ?? '',
      valid_until: seq?.valid_until ?? '',
      min_number: seq ? String(seq.min_number) : '1',
      max_number: seq ? String(seq.max_number) : '',
      active: seq?.active ?? true,
      reason: '',
    },
  });
  const [prefix, minText] = useWatch({ control, name: ['prefix', 'min_number'] });
  const current = seq?.current_number ?? Math.max(Number(minText || 1) - 1, 0);
  const nextPreview = prefix ? formatFiscalNumber(prefix.trim(), current + 1) : '—';

  const save = useMutation({
    mutationFn: (v: V) => {
      const body: Record<string, unknown> = {
        prefix: v.prefix.trim(),
        cai: v.cai.trim(),
        valid_until: v.valid_until,
        min_number: Number(v.min_number),
        max_number: Number(v.max_number),
        active: v.active,
      };
      if (!seq) return api.post<FiscalSequence>('/fiscal-sequences', body);
      return api.patch<FiscalSequence>(`/fiscal-sequences/${seq.id}`, { ...body, reason: v.reason.trim() });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fiscalKey });
      toast.success(seq ? 'Numeración actualizada.' : 'Numeración creada.');
      onClose();
    },
    onError: (e) => setFormError(applyServerErrors(e, setError, ['prefix', 'cai', 'valid_until', 'min_number', 'max_number', 'active', 'reason'])),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={seq ? 'Editar numeración fiscal' : 'Nueva numeración fiscal'}
      description="Datos de la autorización (CAI). Solo una numeración puede estar activa."
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prefijo" required error={errors.prefix?.message} hint="Ej.: 000-001-01">
            <Input {...register('prefix')} mono maxLength={32} autoComplete="off" />
          </Field>
          <Field label="Válido hasta" required error={errors.valid_until?.message}>
            <Input {...register('valid_until')} type="date" />
          </Field>
        </div>
        <Field label="CAI" required error={errors.cai?.message}>
          <Input {...register('cai')} mono maxLength={128} autoComplete="off" spellCheck={false} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Desde" required error={errors.min_number?.message}>
            <Input {...register('min_number')} inputMode="numeric" mono />
          </Field>
          <Field label="Hasta" required error={errors.max_number?.message}>
            <Input {...register('max_number')} inputMode="numeric" mono />
          </Field>
          <Field label="Correlativo actual" hint="Solo lectura.">
            <Input value={String(current)} readOnly mono tabIndex={-1} className="bg-surface-2" />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface-2/60 px-3.5 py-2.5">
          <span className="text-[13px] text-ink-2">Próximo número</span>
          <span className="num text-[14px] font-semibold" data-testid="next-number">
            {nextPreview}
          </span>
        </div>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch label="Activa" description="Al activarla, la numeración activa anterior se desactiva." checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {seq && (
          <Field label="Motivo" required error={errors.reason?.message}>
            <Textarea {...register('reason')} rows={2} maxLength={500} />
          </Field>
        )}
        <FormAlert message={formError} />
      </div>
    </Drawer>
  );
}

export function FiscalTab() {
  const { can } = usePermissions();
  const canEdit = can('settings.update');
  const [editing, setEditing] = useState<FiscalSequence | 'new' | null>(null);
  const q = useQuery({
    queryKey: fiscalKey,
    queryFn: async () => (await api.get<Paginated<FiscalSequence>>('/fiscal-sequences')).items,
  });

  return (
    <>
      <Card
        flush
        title="Numeración fiscal"
        description="Rangos autorizados (CAI) para numerar las facturas."
        actions={
          canEdit && (
            <Button size="sm" variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
              Nueva numeración
            </Button>
          )
        }
      >
        <DataTable
          caption="Numeraciones fiscales"
          rows={q.data}
          loading={q.isLoading}
          rowKey={(s) => s.id}
          onRowClick={canEdit ? (s) => setEditing(s) : undefined}
          empty={<EmptyState compact icon={<FileDigit />} title="Sin numeración fiscal" description="Registre el CAI para poder emitir facturas." />}
          columns={[
            { key: 'prefix', header: 'Prefijo', cell: (s) => <span className="num">{s.prefix}</span> },
            { key: 'cai', header: 'CAI', cell: (s) => <span className="num block max-w-[220px] truncate text-[12.5px]" title={s.cai}>{s.cai}</span> },
            { key: 'range', header: 'Rango', cell: (s) => <span className="num">{s.min_number}–{s.max_number}</span> },
            { key: 'current', header: 'Correlativo actual', numeric: true, cell: (s) => s.current_number },
            { key: 'remaining', header: 'Disponibles', numeric: true, cell: (s) => fiscalStatus(s).remaining },
            { key: 'valid', header: 'Válido hasta', cell: (s) => <span className="tabular">{formatDate(s.valid_until)}</span> },
            { key: 'status', header: 'Estado', cell: (s) => <FiscalChips s={s} /> },
          ]}
          rowActions={canEdit ? (s) => <IconButton size="sm" label={`Editar numeración ${s.prefix}`} icon={<Pencil />} onClick={() => setEditing(s)} /> : undefined}
        />
      </Card>
      {editing !== null && <SequenceDrawer key={editing === 'new' ? 'new' : editing.id} seq={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
