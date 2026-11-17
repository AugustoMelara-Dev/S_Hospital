import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { FileText, Pencil, Printer } from 'lucide-react';
import { api, downloadFile, errorMessage } from '@/lib/api';
import type { CopiesMode, PaperSize, PrintProfile, ReceiptSeries, ReceiptSettings } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, DataTable, Drawer, EmptyState, Field, IconButton, Input, Select, Skeleton, Switch, Textarea, toast } from '@/ui';
import { FormAlert, applyServerErrors } from '@/features/catalogo/formUtils';

export const receiptSettingsKey = ['receipt-settings'] as const;

export const PAPER_LABEL: Record<PaperSize, string> = {
  half_letter: 'Media carta',
  letter_portrait: 'Carta vertical',
  letter_landscape: 'Carta horizontal',
  a5_landscape: 'A5 horizontal',
  a4_portrait: 'A4 vertical',
  thermal_80: 'Térmica 80 mm',
  thermal_58: 'Térmica 58 mm',
};

export const COPIES_LABEL: Record<CopiesMode, string> = {
  original_only: 'Solo original',
  original_first: 'Original y primera copia',
  original_first_second: 'Original, primera y segunda copia',
};

export const isThermal = (p: Pick<PrintProfile, 'paper'>) => p.paper === 'thermal_80' || p.paper === 'thermal_58';

function ProfilesCard({ profiles, canEdit }: { profiles: PrintProfile[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<PrintProfile> }) => api.patch<PrintProfile>(`/print-profiles/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receiptSettingsKey });
      toast.success('Perfil de impresión actualizado.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const selectable = profiles.filter((p) => !isThermal(p) && p.active);
  const current = profiles.find((p) => p.is_default);
  const [testing, setTesting] = useState<string | null>(null);

  async function testPdf(code: string) {
    setTesting(code);
    try {
      await downloadFile(`/print-profiles/${encodeURIComponent(code)}/test.pdf`, { method: 'POST', filename: `prueba-${code}.pdf` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(null);
    }
  }

  return (
    <Card
      flush
      title="Perfiles de impresión"
      description="El recibo institucional se imprime en carta, media carta o A5. Las térmicas son solo compatibilidad."
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="default-profile" className="text-[12.5px] whitespace-nowrap text-ink-2">
            Perfil predeterminado
          </label>
          <Select
            id="default-profile"
            value={current ? String(current.id) : ''}
            disabled={!canEdit || patch.isPending}
            placeholder={current ? undefined : 'Seleccione…'}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) patch.mutate({ id, body: { is_default: true } });
            }}
            options={selectable.map((p) => ({ value: String(p.id), label: p.name }))}
            wrapperClassName="w-56"
            className="h-8"
          />
        </div>
      }
    >
      <DataTable
        caption="Perfiles de impresión"
        rows={profiles}
        rowKey={(p) => p.id}
        columns={[
          {
            key: 'name',
            header: 'Perfil',
            cell: (p) => (
              <div className="flex flex-col">
                <span className="font-medium">
                  {p.name}
                  {p.is_default && <Badge tone="brand" className="ml-2">Predeterminado</Badge>}
                </span>
                <span className="text-[12px] text-ink-3">
                  {PAPER_LABEL[p.paper] ?? p.paper} · <span className="num">{p.width_mm}×{p.height_mm} mm</span>
                </span>
              </div>
            ),
          },
          {
            key: 'copies',
            header: 'Copias',
            cell: (p) => (
              <Select
                aria-label={`Copias de ${p.name}`}
                value={p.copies_mode}
                disabled={!canEdit || isThermal(p)}
                onChange={(e) => patch.mutate({ id: p.id, body: { copies_mode: e.target.value as CopiesMode } })}
                options={Object.entries(COPIES_LABEL).map(([value, label]) => ({ value, label }))}
                className="h-8 text-[13px]"
                wrapperClassName="min-w-[220px]"
              />
            ),
          },
          {
            key: 'seal',
            header: 'Espacio para sello',
            cell: (p) => (
              <Switch
                label={<span className="sr-only">Espacio para sello en {p.name}</span>}
                checked={p.show_seal_space}
                disabled={!canEdit}
                onCheckedChange={(v) => patch.mutate({ id: p.id, body: { show_seal_space: v } })}
              />
            ),
          },
          {
            key: 'logo',
            header: 'Usar logo',
            cell: (p) => (
              <Switch
                label={<span className="sr-only">Usar logo en {p.name}</span>}
                checked={p.use_logo}
                disabled={!canEdit}
                onCheckedChange={(v) => patch.mutate({ id: p.id, body: { use_logo: v } })}
              />
            ),
          },
          {
            key: 'active',
            header: 'Activo',
            cell: (p) => (
              <Switch
                label={<span className="sr-only">Perfil {p.name} activo</span>}
                checked={p.active}
                disabled={!canEdit || p.is_default}
                onCheckedChange={(v) => patch.mutate({ id: p.id, body: { active: v } })}
              />
            ),
          },
        ]}
        rowActions={(p) => (
          <Button size="sm" leftIcon={<FileText />} loading={testing === p.code} onClick={() => void testPdf(p.code)}>
            PDF de prueba
          </Button>
        )}
      />
    </Card>
  );
}

const seriesSchema = z
  .object({
    prefix: z.string().trim().min(1, 'Ingrese el prefijo.').max(32),
    max_number: z.string().regex(/^\d{1,8}$/, 'Número entero.'),
    range_authorization: z.string().max(128),
    legal_text: z.string().max(2000),
    number_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal (#b91c1c).'),
  })
type SeriesValues = z.infer<typeof seriesSchema>;

function SeriesDrawer({ series, onClose }: { series: ReceiptSeries; onClose: () => void }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<SeriesValues>({
    resolver: zodResolver(seriesSchema),
    defaultValues: {
      prefix: series.prefix,
      max_number: String(series.max_number),
      range_authorization: series.range_authorization ?? '',
      legal_text: series.legal_text ?? '',
      number_color: series.number_color || '#b91c1c',
    },
  });
  const color = watch('number_color');
  const save = useMutation({
    mutationFn: (v: SeriesValues) =>
      // The series code and its first number are fixed once created (ReceiptSeriesPatch).
      api.patch<ReceiptSeries>(`/receipt-series/${series.id}`, {
        prefix: v.prefix.trim(),
        max_number: Number(v.max_number),
        range_authorization: v.range_authorization.trim(),
        legal_text: v.legal_text.trim(),
        number_color: v.number_color,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receiptSettingsKey });
      toast.success('Serie de recibos actualizada.');
      onClose();
    },
    onError: (e) =>
      setFormError(applyServerErrors(e, setError, ['prefix', 'max_number', 'range_authorization', 'legal_text', 'number_color'])),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title="Serie de recibos"
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
          <Field label="Serie" hint="No se puede cambiar.">
            <Input value={series.series} readOnly mono tabIndex={-1} className="bg-surface-2" />
          </Field>
          <Field label="Prefijo" required error={errors.prefix?.message}>
            <Input {...register('prefix')} mono maxLength={32} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Desde" hint="No se puede cambiar.">
            <Input value={String(series.min_number)} readOnly mono tabIndex={-1} className="bg-surface-2" />
          </Field>
          <Field label="Hasta" required error={errors.max_number?.message}>
            <Input {...register('max_number')} inputMode="numeric" mono />
          </Field>
          <Field label="Correlativo actual" hint="Solo lectura.">
            <Input value={String(series.current_number)} readOnly mono tabIndex={-1} className="bg-surface-2" />
          </Field>
        </div>
        <Field label="Autorización del rango" error={errors.range_authorization?.message}>
          <Input {...register('range_authorization')} maxLength={128} />
        </Field>
        <Field label="Texto legal" error={errors.legal_text?.message}>
          <Textarea {...register('legal_text')} rows={3} maxLength={2000} />
        </Field>
        <Field label="Color del número" error={errors.number_color?.message}>
          <div className="flex items-center gap-2">
            <Input {...register('number_color')} mono maxLength={7} className="w-32" />
            <span className="num text-[14px] font-semibold" style={{ color: /^#[0-9a-f]{6}$/i.test(color) ? color : undefined }}>
              {series.series}-{String(series.current_number + 1).padStart(8, '0')}
            </span>
          </div>
        </Field>
        <FormAlert message={formError} />
      </div>
    </Drawer>
  );
}

export function ImpresionTab() {
  const { can } = usePermissions();
  const canEdit = can('receipt_settings.update');
  const [editing, setEditing] = useState<ReceiptSeries | null>(null);
  const q = useQuery({ queryKey: receiptSettingsKey, queryFn: () => api.get<ReceiptSettings>('/receipt-settings') });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <FormAlert message={errorMessage(q.error)} />;

  return (
    <div className="flex flex-col gap-4">
      <ProfilesCard profiles={q.data?.profiles ?? []} canEdit={canEdit} />
      <Card flush title="Series de recibo institucional" description="Numeración propia del recibo, independiente de la factura.">
        <DataTable
          caption="Series de recibo"
          rows={q.data?.series ?? []}
          rowKey={(s) => s.id}
          onRowClick={canEdit ? (s) => setEditing(s) : undefined}
          empty={<EmptyState compact icon={<Printer />} title="Sin series de recibo" />}
          columns={[
            { key: 'series', header: 'Serie', cell: (s) => <span className="num">{s.series}</span> },
            { key: 'range', header: 'Rango', cell: (s) => <span className="num">{s.min_number}–{s.max_number}</span> },
            { key: 'current', header: 'Correlativo actual', numeric: true, cell: (s) => s.current_number },
            {
              key: 'next',
              header: 'Próximo número',
              cell: (s) => (
                <span className="num font-medium" style={{ color: s.number_color }}>
                  {s.series}-{String(Math.max(s.current_number + 1, s.min_number)).padStart(8, '0')}
                </span>
              ),
            },
            { key: 'status', header: 'Estado', cell: (s) => (s.active ? <Badge tone="brand" dot>Activa</Badge> : <Badge dot>Inactiva</Badge>) },
          ]}
          rowActions={canEdit ? (s) => <IconButton size="sm" label={`Editar serie ${s.series}`} icon={<Pencil />} onClick={() => setEditing(s)} /> : undefined}
        />
      </Card>
      {editing && <SeriesDrawer key={editing.id} series={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
