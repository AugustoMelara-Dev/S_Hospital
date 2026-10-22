import { useEffect, useRef, useState } from 'react';
import { DownloadIcon, FileUpIcon } from 'lucide-react';
import { AdminCallout, AdminDialog, AdminField } from '@/design-system/admin/components';
import {
  type CatalogExportFormat,
  type CatalogImportResult,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import { downloadBlob } from '@/lib/download';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './catalogUi';

const ACCEPTED_IMPORT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type CatalogTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: CatalogImportResult) => void;
  onStatus: OperationalStatusReporter;
};

function exportFilename(format: CatalogExportFormat): string {
  const today = new Date();
  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');
  return `catalogo-servicios-${stamp}.${format}`;
}

/**
 * Importar / exportar catálogo (H-16).
 *
 * La vista previa no escribe: el servidor valida el archivo y devuelve filas
 * válidas y errores por línea. Aplicar reenvía el mismo archivo en modo
 * `apply`; si el servidor falla, el archivo y la vista previa se conservan para
 * reintentar sin volver a elegirlo.
 */
export function CatalogTransferDialog({
  open,
  onOpenChange,
  onImported,
  onStatus,
}: CatalogTransferDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatalogImportResult | null>(null);
  const [result, setResult] = useState<CatalogImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [exporting, setExporting] = useState<CatalogExportFormat | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setBusy(null);
    setExporting(null);
  }, [open]);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function runPreview() {
    if (!file || busy) return;

    setBusy('preview');
    setError('');
    setResult(null);
    try {
      const previewResult = await apiClient.importServices(file, 'preview');
      setPreview(previewResult);
    } catch (err) {
      setError(safeClientMessage(userSafeErrorMessage(err, 'No se pudo leer el archivo del catálogo.')));
    } finally {
      setBusy(null);
    }
  }

  async function runApply() {
    if (!file || busy) return;

    setBusy('apply');
    setError('');
    try {
      const applied = await apiClient.importServices(file, 'apply');
      setResult(applied);
      setPreview(applied);
      onImported(applied);
      onStatus({
        key: 'catalog:import',
        level: applied.errors.length > 0 ? 'warning' : 'success',
        message: applied.errors.length > 0
          ? `Catálogo importado con ${applied.errors.length} fila(s) con error.`
          : `Catálogo importado: ${applied.applied} concepto(s).`,
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo aplicar la importación del catálogo.'));
      setError(message);
      onStatus({ key: 'catalog:import', level: 'error', message });
    } finally {
      setBusy(null);
    }
  }

  async function runExport(format: CatalogExportFormat) {
    if (exporting) return;

    setExporting(format);
    setError('');
    try {
      const blob = await apiClient.exportServices(format);
      downloadBlob(blob, exportFilename(format));
      onStatus({ key: 'catalog:export', level: 'success', message: `Catálogo exportado en ${format.toUpperCase()}.` });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo exportar el catálogo.'));
      setError(message);
      onStatus({ key: 'catalog:export', level: 'error', message });
    } finally {
      setExporting(null);
    }
  }

  const summary = result ?? preview;
  const canApply = Boolean(file) && Boolean(preview) && (preview?.valid ?? 0) > 0 && !busy;

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!busy && !exporting) onOpenChange(next); }}
      className="sm:max-w-2xl"
      title="Importar o exportar catálogo"
      description="Comparta el catálogo entre instalaciones o cárguelo desde una plantilla. Nada se escribe hasta que usted aplique la importación."
      closeDisabled={Boolean(busy)}
      footer={(
        <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={Boolean(busy)} onClick={() => onOpenChange(false)}>
          Cerrar
        </button>
      )}
    >
      <div className="grid gap-5">
        {error ? <AdminCallout tone="error" title="No se completó la operación">{error}</AdminCallout> : null}

        <section aria-labelledby="catalog-import-title" className="grid gap-3">
          <h3 id="catalog-import-title" className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
            Importar
          </h3>
          <AdminField
            htmlFor="catalog-import-file"
            label="Archivo CSV o XLSX"
            hint="Columnas esperadas: nombre, categoría, precio, tasa de impuesto y estado. La vista previa indica los errores por línea."
          >
            <input
              id="catalog-import-file"
              type="file"
              accept={ACCEPTED_IMPORT}
              disabled={Boolean(busy)}
              className="block w-full cursor-pointer rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5 py-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)] file:mr-3 file:rounded-[var(--ui-radius-control)] file:border-0 file:bg-[var(--ui-surface-alt)] file:px-3 file:py-1 file:text-[color:var(--ui-ink)]"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </AdminField>
          <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]" role="status">
            {file ? `Archivo seleccionado: ${file.name}` : 'Ningún archivo seleccionado.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={!file || Boolean(busy)} onClick={() => void runPreview()}>
              <FileUpIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {busy === 'preview' ? 'Revisando…' : 'Vista previa'}
            </button>
            <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={!canApply} onClick={() => void runApply()}>
              {busy === 'apply' ? 'Aplicando…' : preview ? `Aplicar importación (${preview.valid} válida${preview.valid === 1 ? '' : 's'})` : 'Aplicar importación'}
            </button>
          </div>

          {preview ? (
            <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
              Vista previa: no se escribió nada. Revise las filas con error antes de aplicar.
            </p>
          ) : null}
        </section>

        {summary ? (
          <section aria-labelledby="catalog-import-result-title" className="grid gap-2">
            <h3 id="catalog-import-result-title" className="text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">
              {result ? 'Resultado de la importación' : 'Vista previa del archivo'}
            </h3>
            <dl className="grid gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3 text-[length:var(--ui-text-sm)] sm:grid-cols-3">
              <div>
                <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Filas válidas</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--ui-ink)]">{summary.valid}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Aplicadas</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--ui-ink)]">{summary.applied}</dd>
              </div>
              <div>
                <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Con error</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--ui-ink)]">{summary.errors.length}</dd>
              </div>
            </dl>
            {summary.errors.length > 0 ? (
              <AdminCallout tone="warn" title={`${summary.errors.length} fila(s) con error`}>
                <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-[length:var(--ui-text-sm)]">
                  {summary.errors.map((entry) => (
                    <li key={`${entry.line}-${entry.message}`}>
                      Línea {entry.line}: {entry.message}
                    </li>
                  ))}
                </ul>
              </AdminCallout>
            ) : (
              <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">El archivo no tiene filas con error.</p>
            )}
          </section>
        ) : null}

        <section aria-labelledby="catalog-export-title" className="grid gap-3 border-t border-[var(--ui-line)] pt-4">
          <h3 id="catalog-export-title" className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">
            Exportar
          </h3>
          <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Descarga el catálogo vigente con categorías, precios e impuestos para respaldo o para otra instalación.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={Boolean(exporting)} onClick={() => void runExport('csv')}>
              <DownloadIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {exporting === 'csv' ? 'Exportando…' : 'Exportar CSV'}
            </button>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={Boolean(exporting)} onClick={() => void runExport('xlsx')}>
              <DownloadIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {exporting === 'xlsx' ? 'Exportando…' : 'Exportar Excel'}
            </button>
          </div>
        </section>
      </div>
    </AdminDialog>
  );
}
