import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, History } from 'lucide-react';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { formatRateBp } from '@/lib/money';
import { Badge, Button, DataTable, Dialog, EmptyState, Field, Money, Select, Textarea, toast } from '@/ui';
import { type CatalogService, type ImportReport, type PriceHistoryEntry, importLines, useCategories, useTaxRates } from './api';
import { FormAlert, REASON_MESSAGE, REASON_MIN, asList } from './formUtils';

// ---------- Historial de precios ----------

function who(e: PriceHistoryEntry): string {
  if (e.changed_by_name) return e.changed_by_name;
  if (e.changed_by && typeof e.changed_by === 'object') return e.changed_by.name;
  return '—';
}

export function HistoryDialog({ service, onClose }: { service: CatalogService | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['services', 'history', service?.id],
    enabled: service !== null,
    queryFn: async () =>
      asList(await api.get<PriceHistoryEntry[] | { items: PriceHistoryEntry[] }>(`/services/${service!.id}/history`)),
  });
  return (
    <Dialog open={service !== null} onClose={onClose} size="lg" title="Historial de precios" description={service?.name}>
      <DataTable
        caption="Historial de precios"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(r) => r.id}
        density="compact"
        empty={<EmptyState compact icon={<History />} title="Sin cambios de precio" description="Este concepto conserva su precio original." />}
        columns={[
          { key: 'date', header: 'Fecha y hora', cell: (r) => <span className="tabular">{formatDateTime(r.changed_at)}</span> },
          { key: 'old', header: 'Antes', numeric: true, cell: (r) => <Money cents={r.old_price_cents} /> },
          { key: 'new', header: 'Después', numeric: true, cell: (r) => <Money cents={r.new_price_cents} /> },
          { key: 'who', header: 'Responsable', cell: who },
          { key: 'reason', header: 'Motivo', cell: (r) => <span className="text-ink-2">{r.reason}</span> },
        ]}
      />
    </Dialog>
  );
}

// ---------- Impuesto en lote ----------

export function BulkTaxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const taxes = useTaxRates(open);
  const [category, setCategory] = useState('');
  const [tax, setTax] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonError = reason.trim().length < REASON_MIN ? REASON_MESSAGE : null;
  const mut = useMutation({
    mutationFn: () =>
      api.patch<{ updated: number }>('/services/bulk-tax', {
        category_id: Number(category),
        tax_rate_id: tax === 'exento' ? null : Number(tax),
        reason: reason.trim(),
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(`Impuesto actualizado en ${r?.updated ?? 0} conceptos.`);
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!mut.isPending}
      title="Impuesto en lote"
      description="Aplica una tasa a todos los conceptos de una categoría. Las facturas emitidas no cambian."
      onSubmit={() => {
        setTouched(true);
        setError(null);
        if (!category || !tax || reasonError) return;
        mut.mutate();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={mut.isPending}>
            Aplicar impuesto
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Categoría" required error={touched && !category ? 'Seleccione una categoría.' : null}>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Seleccione…"
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          />
        </Field>
        <Field label="Tasa de impuesto" required error={touched && !tax ? 'Seleccione la tasa.' : null}>
          <Select
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="Seleccione…"
            options={[
              ...(taxes.data ?? []).filter((t) => t.active).map((t) => ({ value: String(t.id), label: `${t.name} (${formatRateBp(t.rate_bp)})` })),
              { value: 'exento', label: 'Exento' },
            ]}
          />
        </Field>
        <Field label="Motivo" required error={touched ? reasonError : null}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <FormAlert message={error} />
      </div>
    </Dialog>
  );
}

// ---------- Importar / Exportar ----------

const ACTION_LABEL: Record<string, { label: string; tone: 'ok' | 'info' | 'neutral' | 'danger' }> = {
  create: { label: 'Nuevo', tone: 'ok' },
  update: { label: 'Actualiza', tone: 'info' },
  unchanged: { label: 'Sin cambios', tone: 'neutral' },
  skip: { label: 'Omitido', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
};

export function ImportExportDialog({ open, onClose, canManage }: { open: boolean; onClose: () => void; canManage: boolean }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setReport(null);
    setReason('');
    setTouched(false);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const send = (mode: 'preview' | 'apply') => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    if (mode === 'apply') fd.append('reason', reason.trim());
    return api.post<ImportReport>('/services/import', fd, { query: { mode } });
  };

  const preview = useMutation({
    mutationFn: () => send('preview'),
    onSuccess: (r) => {
      setReport(r);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const apply = useMutation({
    mutationFn: () => send('apply'),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Importación aplicada: ${r?.summary.create ?? 0} nuevos, ${r?.summary.update ?? 0} actualizados.`);
      close();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const valid = report ? report.summary.create + report.summary.update : 0;
  const errorsList = report ? importLines(report).filter((l) => l.action === 'error' || (l.errors?.length ?? 0) > 0) : [];
  const reasonError = reason.trim().length < REASON_MIN ? REASON_MESSAGE : null;

  async function exportAs(ext: 'csv' | 'xlsx') {
    try {
      await downloadFile(`/services/export.${ext}`, { mode: 'save', filename: `catalogo.${ext}` });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!apply.isPending}
      title="Importar / Exportar"
      description="Exporte el catálogo vigente o importe cambios desde un archivo CSV."
      footer={
        <Button variant="ghost" onClick={close} disabled={apply.isPending}>
          Cerrar
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold">Exportar</h3>
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Download />} onClick={() => void exportAs('csv')}>
              Exportar CSV
            </Button>
            <Button leftIcon={<Download />} onClick={() => void exportAs('xlsx')}>
              Exportar Excel
            </Button>
          </div>
        </section>

        {canManage && (
          <section className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[13px] font-semibold">Importar CSV</h3>
              <p className="text-[12.5px] text-ink-3">
                Columnas: <span className="num">categoria, servicio, precio_lps, area, tasa, activo, visible_en_cobro, facturable, descripcion, aliases</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Archivo CSV"
                onChange={(e) => {
                  reset();
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
              <Button leftIcon={<FileUp />} onClick={() => inputRef.current?.click()}>
                {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
              </Button>
              {file && <span className="text-[13px] text-ink-2">{file.name}</span>}
              <Button variant="primary" disabled={!file} loading={preview.isPending} onClick={() => preview.mutate()}>
                Revisar archivo
              </Button>
            </div>

            {report && (
              <div className="flex flex-col gap-3" aria-live="polite">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="ok">{valid} líneas válidas</Badge>
                  <Badge tone="neutral">{report.summary.create} nuevas</Badge>
                  <Badge tone="neutral">{report.summary.update} actualizaciones</Badge>
                  <Badge tone={report.summary.error > 0 ? 'danger' : 'neutral'}>{report.summary.error} con errores</Badge>
                </div>
                {errorsList.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-line">
                    <DataTable
                      caption="Errores de importación"
                      density="compact"
                      rows={errorsList}
                      rowKey={(l) => l.line}
                      columns={[
                        { key: 'line', header: 'Línea', numeric: true, width: '64px', cell: (l) => l.line },
                        { key: 'name', header: 'Concepto', cell: (l) => l.name || '—' },
                        {
                          key: 'action',
                          header: 'Estado',
                          cell: (l) => <Badge tone={ACTION_LABEL[l.action]?.tone ?? 'neutral'}>{ACTION_LABEL[l.action]?.label ?? l.action}</Badge>,
                        },
                        { key: 'errors', header: 'Detalle', cell: (l) => <span className="text-danger">{(l.errors ?? []).join(' ')}</span> },
                      ]}
                    />
                  </div>
                )}
                {valid > 0 && (
                  <form
                    noValidate
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setTouched(true);
                      if (reasonError) return;
                      apply.mutate();
                    }}
                  >
                    <Field label="Motivo de la importación" required error={touched ? reasonError : null} hint="Se aplica solo a las líneas válidas.">
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
                    </Field>
                    <div>
                      <Button type="submit" variant="primary" loading={apply.isPending}>
                        Aplicar {valid} {valid === 1 ? 'cambio' : 'cambios'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>
        )}
        <FormAlert message={error} />
      </div>
    </Dialog>
  );
}
