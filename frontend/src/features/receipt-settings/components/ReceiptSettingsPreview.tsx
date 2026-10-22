import { useMemo, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import {
  AdminCallout,
  AdminPanel,
  AdminPanelHeader,
} from '@/design-system/admin/components';
import { ApiError, userSafeErrorMessage, type ReceiptPrintProfile } from '@/lib/api';
import { cn } from '@/lib/utils';
import { paperChoiceFor, paperPresentation, type InstitutionalPaper } from '@/modules/receipts/paperPolicy';
import { copyLabelsForMode } from '../copiesMode';
import {
  receiptDraftSignature,
  useReceiptEnginePreview,
  type ReceiptEngineDraft,
} from '../useReceiptEnginePreview';
import { ICON_BUTTON, SECONDARY_BUTTON } from '../receiptAdminUi';

type ReceiptSettingsPreviewProps = {
  profile: ReceiptPrintProfile | null;
  paper: InstitutionalPaper;
  draft?: boolean;
  /**
   * Validated unsaved form values. When present, the engine renders the DRAFT
   * profile in memory: nothing is persisted and no correlativo is consumed. When
   * absent, the stored profile is rendered.
   */
  draftProfile?: ReceiptEngineDraft | null;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

/**
 * Clases estáticas de escala para el zoom discreto (0.5–2). Se usan clases
 * literales para que Tailwind las incluya en el build; el valor dinámico no se
 * interpola en el nombre de clase.
 */
const ZOOM_SCALE_CLASS: Record<string, string> = {
  '0.5': 'scale-50',
  '0.75': 'scale-75',
  '1': 'scale-100',
  '1.25': 'scale-125',
  '1.5': 'scale-150',
  '1.75': 'scale-[1.75]',
  '2': 'scale-200',
};

type ReceiptPageDocument = {
  /** Full documents, one per logical page (copy) of the copy set. */
  documents: string[];
};

/**
 * Splits the real engine HTML into one self-contained document per
 * `.receipt-page` section. Each section is a logical page (one per copy); the
 * engine emits the same markup the PDF paginates. When the markup has no section
 * (e.g. a simplified fixture), the original document is returned untouched.
 */
export function splitReceiptEnginePages(html: string): ReceiptPageDocument {
  const sections = html.match(/<section\b[^>]*class="[^"]*\breceipt-page\b[^"]*"[^>]*>[\s\S]*?<\/section>/gi);

  if (!sections || sections.length <= 1) {
    return { documents: [html] };
  }

  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const head = headMatch ? headMatch[1] : '';

  return {
    documents: sections.map(
      (section) => `<!DOCTYPE html><html lang="es"><head>${head}</head><body>${section}</body></html>`,
    ),
  };
}

export function ReceiptSettingsPreview({
  profile,
  paper,
  draftProfile = null,
}: ReceiptSettingsPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);

  const paperChoice = paperChoiceFor(paper);
  const presentation = paperPresentation(paper);
  const profileCode = profile?.code ?? null;
  const profileName = profile?.name ?? 'Sin perfil seleccionado';
  const draftActive = draftProfile !== null && receiptDraftSignature(draftProfile) !== 'persisted';

  const enginePreview = useReceiptEnginePreview({
    profileCode,
    draft: draftActive ? draftProfile : null,
  });

  const engineHtml = enginePreview.data?.html ?? null;
  const { documents } = useMemo(
    () => (engineHtml ? splitReceiptEnginePages(engineHtml) : { documents: [] }),
    [engineHtml],
  );
  const pageTotal = documents.length;
  const safePageIndex = pageTotal > 0 ? Math.min(pageIndex, pageTotal - 1) : 0;
  const currentDocument = pageTotal > 0 ? documents[safePageIndex] : null;

  const engineCount = enginePreview.data?.copy_count;
  const plan = enginePreview.data?.document ?? null;
  const engineLabels = plan?.copies.labels?.length
    ? plan.copies.labels
    : enginePreview.data?.copy_labels?.length
      ? enginePreview.data.copy_labels
      : copyLabelsForMode(profile?.copies_mode);
  const permissionDenied = enginePreview.error instanceof ApiError && enginePreview.error.status === 403;

  // The plan is the only source of the copy/page figures. While it is not
  // available the component states that it is preparing the preview and shows
  // no number at all: pages are never derived from the copy count.
  const copyTotal = plan?.copies.count ?? (typeof engineCount === 'number' ? engineCount : null);

  return (
    <AdminPanel data-testid="receipt-settings-preview" as="section" className="overflow-hidden">
      <AdminPanelHeader
        headingLevel={2}
        title="Vista previa del motor"
        description={`${paperChoice.label} · ${profileName}. ${draftActive ? 'Borrador sin guardar (no reserva correlativo).' : 'Perfil guardado. Borrador de prueba (no reserva correlativo).'}`}
        actions={
          profileCode ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Controles de la vista previa">
              <button
                type="button"
                data-ui-press
                aria-label="Alejar vista previa"
                className={ICON_BUTTON}
                disabled={zoom <= MIN_ZOOM}
                onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))))}
              >
                −
              </button>
              <span className="min-w-12 text-center text-[length:var(--ui-text-xs)] font-semibold tabular-nums" data-receipt-preview-zoom>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                data-ui-press
                aria-label="Acercar vista previa"
                className={ICON_BUTTON}
                disabled={zoom >= MAX_ZOOM}
                onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))))}
              >
                +
              </button>
              <button
                type="button"
                data-ui-press
                className={SECONDARY_BUTTON}
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
              >
                Tamaño real
              </button>
              {pageTotal > 1 ? (
                <span className="flex items-center gap-2" data-receipt-preview-pager>
                  <button
                    type="button"
                    data-ui-press
                    className={SECONDARY_BUTTON}
                    aria-label="Hoja anterior"
                    disabled={safePageIndex === 0}
                    onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                  >
                    Anterior
                  </button>
                  <span className="text-[length:var(--ui-text-xs)] font-semibold tabular-nums" aria-live="polite">
                    Hoja {safePageIndex + 1} de {pageTotal}
                  </span>
                  <button
                    type="button"
                    data-ui-press
                    className={SECONDARY_BUTTON}
                    aria-label="Hoja siguiente"
                    disabled={safePageIndex >= pageTotal - 1}
                    onClick={() => setPageIndex((value) => Math.min(pageTotal - 1, value + 1))}
                  >
                    Siguiente
                  </button>
                </span>
              ) : null}
            </div>
          ) : null
        }
      />
      <div className="flex flex-col gap-3 p-3" data-receipt-preview-mode={draftActive ? 'draft' : 'persisted'}>
        <div
          className="rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-3 py-2 text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink)]"
          data-receipt-copy-plan
        >
          <strong className="block font-semibold">
            {draftActive ? 'Vista previa del borrador (sin guardar).' : 'Vista previa del perfil guardado.'} Este PDF es una copia del conjunto.
          </strong>
          {plan ? (
            <>
              <span className="mt-1 block" data-receipt-plan-headline>{plan.headline}</span>
              <span className="mt-1 block text-[color:var(--ui-ink-soft)]" data-receipt-plan-instruction>
                {plan.print_instruction}
              </span>
              {plan.sheet_assumption ? (
                <span className="mt-1 block text-[color:var(--ui-ink-soft)]" data-receipt-plan-sheet-note>
                  {plan.sheet_assumption}
                </span>
              ) : null}
              {engineLabels.length > 0 && copyTotal !== null ? (
                <span className="mt-1 block text-[color:var(--ui-ink-soft)]">
                  {copyTotal} {copyTotal === 1 ? 'ejemplar' : 'ejemplares'}: {engineLabels.join(' / ')}
                </span>
              ) : null}
            </>
          ) : profileCode ? (
            <span className="mt-1 block text-[color:var(--ui-ink-soft)]" data-receipt-plan-pending>
              Preparando la vista previa del conjunto…
            </span>
          ) : null}
        </div>

        {draftActive ? (
          <div data-receipt-preview-draft>
            <AdminCallout tone="info" title="Borrador sin guardar">
              La vista previa usa los cambios actuales del formulario. Aún no se guardaron y no se consumió
              correlativo; guarde el perfil para aplicarlos a los próximos recibos.
            </AdminCallout>
          </div>
        ) : null}

        {!profileCode ? (
          <div data-receipt-preview-empty>
            <AdminCallout tone="info" title="Sin perfil de impresión">
              Seleccione un formato de papel para ver la vista previa del motor.
            </AdminCallout>
          </div>
        ) : null}

        {profileCode && enginePreview.isLoading ? (
          <div
            className="flex min-h-40 items-center justify-center gap-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink-soft)]"
            role="status"
            aria-label="Preparando la vista previa del recibo"
          >
            <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
            <span>Preparando la vista previa del motor…</span>
          </div>
        ) : null}

        {profileCode && enginePreview.isError ? (
          <div data-receipt-preview-error>
            <AdminCallout
              tone="error"
              title={permissionDenied ? 'Sin permiso para la vista previa' : 'No se pudo preparar la vista previa'}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {permissionDenied
                    ? 'Su usuario no tiene permiso para previsualizar el recibo institucional. Solicite acceso al administrador.'
                    : userSafeErrorMessage(enginePreview.error, 'Revise el servidor local y vuelva a intentar.')}
                </span>
                <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void enginePreview.refetch()}>
                  Reintentar
                </button>
              </div>
            </AdminCallout>
          </div>
        ) : null}

        {currentDocument ? (
          <div className="overflow-auto rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3">
            <section
              aria-label={`Vista previa de recibo ${paperChoice.label}`}
              data-receipt-style="minimal-monochrome"
              data-receipt-preview-paper={paper}
              className="receipt-paper-preview mx-auto w-full max-w-[48rem] overflow-visible border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[color:var(--ui-ink)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--ui-line)] px-4 py-2 text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wide text-[color:var(--ui-ink-soft)]">
                <span>Ejemplo de impresión · PRUEBA</span>
                <span>
                  {paperChoice.label}
                  {pageTotal > 1 ? ` · Hoja ${safePageIndex + 1} de ${pageTotal}` : ''}
                </span>
              </div>
              {/*
                sandbox="" is the most restrictive value: the server-rendered receipt
                document is static HTML/CSS with no scripts, forms or same-origin
                needs. srcDoc comes from the authenticated /test-preview endpoint for
                the selected profile/draft, never from operator input, so we do not
                grant script execution or navigation.
              */}
              <div
                className={cn('origin-top', presentation.previewClass, ZOOM_SCALE_CLASS[String(zoom)] ?? 'scale-100')}
                data-receipt-preview-scale={zoom}
              >
                <iframe
                  title={`Vista previa del recibo institucional (${paperChoice.label})`}
                  srcDoc={currentDocument}
                  sandbox=""
                  /* El canvas del motor ES el papel (regla paper §4): superficie
                     blanca canónica incluso cuando el entorno global es dark.
                     --ui-surface invertiría el fondo del documento sobre el
                     sustrato, por eso se usa el token de papel del recibo. */
                  className="receipt-preview-frame block w-full border-0 bg-receipt-paper"
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}
