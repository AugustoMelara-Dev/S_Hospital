import { useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { FileDigit, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import type { FiscalSequence, Paginated } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, DataTable, Drawer, EmptyState, Field, IconButton, Input, Switch, Textarea, toast } from '@/ui';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from '@/features/catalogo/formUtils';
import { LedgerFact, LedgerSection, Sheet, SheetHead, StateMark, ledgerRow } from '@/features/catalogo/ledger';

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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {st.expired ? (
        <StateMark shape="struck" tone="danger">Vencida</StateMark>
      ) : (
        <StateMark shape="filled" tone="ok">Vigente</StateMark>
      )}
      {s.active && <Badge tone="info">Activa</Badge>}
      {st.exhausted && <Badge tone="danger">Rango agotado</Badge>}
      {st.low && <Badge tone="warn">Rango por agotarse</Badge>}
    </div>
  );
}

/** Used / total of an authorised range (current_number is the last number issued). */
export function rangeUsage(s: Pick<FiscalSequence, 'min_number' | 'max_number' | 'current_number'>) {
  const total = Math.max(s.max_number - s.min_number + 1, 1);
  const used = Math.min(Math.max(s.current_number - s.min_number + 1, 0), total);
  return { total, used, ratio: used / total };
}

function daysUntil(iso: string): number {
  const end = new Date(`${iso}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

const fmtInt = (n: number) => n.toLocaleString('es-HN');

function UsageBar({ s, wide }: { s: FiscalSequence; wide?: boolean }) {
  const st = fiscalStatus(s);
  const { ratio } = rangeUsage(s);
  const fill = st.exhausted || st.expired ? 'bg-danger' : st.low ? 'bg-warn' : 'bg-slate';
  return (
    <div className={cn('relative overflow-hidden border border-junta-strong bg-field', wide ? 'h-3' : 'h-2 w-20')} aria-hidden="true">
      <div className={cn('h-full', fill)} style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1 : 0)}%` }} />
      {wide && (
        <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
          <span className="border-r border-junta-strong/70" />
          <span className="border-r border-junta-strong/70" />
          <span className="border-r border-junta-strong/70" />
          <span />
        </div>
      )}
    </div>
  );
}

/** The active CAI as a progress ledger: rango, usado, restante, vence, with the state by shape. */
function RangeLedger({ s }: { s: FiscalSequence }) {
  const st = fiscalStatus(s);
  const { total, used, ratio } = rangeUsage(s);
  const days = daysUntil(s.valid_until);
  const state = st.exhausted ? (
    <StateMark shape="struck" tone="danger">Rango agotado</StateMark>
  ) : st.expired ? (
    <StateMark shape="struck" tone="danger">Vencida</StateMark>
  ) : st.low ? (
    <StateMark shape="half" tone="warn">Rango por agotarse</StateMark>
  ) : (
    <StateMark shape="filled" tone="ok">Vigente</StateMark>
  );
  const cell = (label: string, value: ReactNode, hint?: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
      <span className="text-[12px] leading-4 font-semibold text-ink-2">{label}</span>
      <span className="num text-[22px] leading-7 font-semibold text-ink">{value}</span>
      {hint && <span className="text-[12px] leading-4 text-ink-2">{hint}</span>}
    </div>
  );
  return (
    <Sheet aria-label="Numeración fiscal activa">
      <SheetHead
        title="Numeración activa"
        meta={<span className="num">{`Prefijo ${s.prefix} · CAI ${s.cai}`}</span>}
        actions={state}
      />
      <div className="grid grid-cols-2 divide-junta border-b border-junta md:grid-cols-5 md:divide-x">
        {cell('Rango autorizado', <>{fmtInt(s.min_number)}–{fmtInt(s.max_number)}</>, `${fmtInt(total)} números`)}
        {cell('Usado', fmtInt(used), `${(ratio * 100).toFixed(ratio < 0.1 && ratio > 0 ? 2 : 1)} % del rango`)}
        {cell('Restante', fmtInt(st.remaining), st.low ? 'Solicite un nuevo CAI.' : undefined)}
        {cell('Vence', formatDate(s.valid_until), days < 0 ? 'Fecha límite vencida' : days === 0 ? 'Vence hoy' : `En ${fmtInt(days)} ${days === 1 ? 'día' : 'días'}`)}
        {cell('Próximo número', <span className="text-[17px]">{s.next_number_formatted ?? '—'}</span>)}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="num text-[12px] text-ink-2">{fmtInt(s.min_number)}</span>
        <div className="min-w-0 flex-1">
          <UsageBar s={s} wide />
        </div>
        <span className="num text-[12px] text-ink-2">{fmtInt(s.max_number)}</span>
      </div>
    </Sheet>
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
      <div className="flex flex-col">
        <LedgerSection title="Autorización">
          <Field label="Prefijo" required error={errors.prefix?.message} hint="Ej.: 000-001-01" className={ledgerRow('sm')}>
            <Input className="w-48" {...register('prefix')} mono maxLength={32} autoComplete="off" />
          </Field>
          <Field label="CAI" required error={errors.cai?.message} className={ledgerRow('sm')}>
            <Input {...register('cai')} mono maxLength={128} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Válido hasta" required error={errors.valid_until?.message} className={ledgerRow('sm')}>
            <Input className="w-48" {...register('valid_until')} type="date" />
          </Field>
        </LedgerSection>
        <LedgerSection title="Rango">
          <Field label="Desde" required error={errors.min_number?.message} className={ledgerRow('sm')}>
            <Input className="w-40" {...register('min_number')} inputMode="numeric" mono />
          </Field>
          <Field label="Hasta" required error={errors.max_number?.message} className={ledgerRow('sm')}>
            <Input className="w-40" {...register('max_number')} inputMode="numeric" mono />
          </Field>
          <Field label="Correlativo actual" hint="Solo lectura." className={ledgerRow('sm')}>
            <Input value={String(current)} readOnly mono tabIndex={-1} className="bg-surface-2 w-40" />
          </Field>
          <LedgerFact label="Próximo número" labelWidth="sm">
            <span className="num text-[15px] font-semibold" data-testid="next-number">
              {nextPreview}
            </span>
          </LedgerFact>
        </LedgerSection>
        <div className="border-b border-junta py-3">
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch label="Activa" description="Al activarla, la numeración activa anterior se desactiva." checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
        {seq && (
          <Field label="Motivo" required error={errors.reason?.message} className={cn(ledgerRow('sm'), 'items-start')}>
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

export function FiscalTab() {
  const { can } = usePermissions();
  const canEdit = can('settings.update');
  const [editing, setEditing] = useState<FiscalSequence | 'new' | null>(null);
  const q = useQuery({
    queryKey: fiscalKey,
    queryFn: async () => (await api.get<Paginated<FiscalSequence>>('/fiscal-sequences')).items,
  });

  const active = q.data?.find((x) => x.active);

  return (
    <div className="flex flex-col gap-4">
      {active && <RangeLedger s={active} />}
      <Sheet>
        <SheetHead
          title="Numeración fiscal"
          meta="Rangos autorizados (CAI) para numerar las facturas."
          actions={
            canEdit && (
              <Button variant={active ? 'secondary' : 'primary'} leftIcon={<Plus />} onClick={() => setEditing('new')}>
                Nueva numeración
              </Button>
            )
          }
        />
        <DataTable
          caption="Numeraciones fiscales"
          rows={q.data}
          loading={q.isLoading}
          rowKey={(s) => s.id}
          density="compact"
          onRowClick={canEdit ? (s) => setEditing(s) : undefined}
          empty={<EmptyState compact icon={<FileDigit />} title="Sin numeración fiscal" description="Registre el CAI para poder emitir facturas." />}
          columns={[
            { key: 'prefix', header: 'Prefijo', cell: (s) => <span className="num font-medium">{s.prefix}</span> },
            {
              key: 'cai',
              header: 'CAI',
              cell: (s) => (
                <span className="num block max-w-[240px] truncate text-[12.5px] text-ink-2" title={s.cai}>
                  {s.cai}
                </span>
              ),
            },
            {
              key: 'range',
              header: 'Rango',
              align: 'right',
              cell: (s) => (
                <span className="num">
                  {fmtInt(s.min_number)}–{fmtInt(s.max_number)}
                </span>
              ),
            },
            {
              key: 'usage',
              header: 'Uso',
              width: '150px',
              cell: (s) => (
                <span className="flex items-center gap-2">
                  <UsageBar s={s} />
                  <span className="num text-[12px] text-ink-2">{`${Math.round(rangeUsage(s).ratio * 100)} %`}</span>
                </span>
              ),
            },
            { key: 'current', header: 'Correlativo actual', numeric: true, cell: (s) => fmtInt(s.current_number) },
            { key: 'remaining', header: 'Disponibles', numeric: true, cell: (s) => fmtInt(fiscalStatus(s).remaining) },
            { key: 'valid', header: 'Válido hasta', align: 'right', cell: (s) => <span className="num">{formatDate(s.valid_until)}</span> },
            { key: 'status', header: 'Estado', cell: (s) => <FiscalChips s={s} /> },
          ]}
          rowActions={canEdit ? (s) => <IconButton size="sm" label={`Editar numeración ${s.prefix}`} icon={<Pencil />} onClick={() => setEditing(s)} /> : undefined}
        />
      </Sheet>
      {editing !== null && <SequenceDrawer key={editing === 'new' ? 'new' : editing.id} seq={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
