import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Tag } from 'antd';
import { PrintPreviewFrame } from '@/design-system/components/InstitutionalComponents';
import { formatDate } from '@/lib/format/formatDate';
import type { InstitutionalReceiptSeries, ReceiptPrintProfile } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  paperChoiceFor,
  paperPresentation,
  type InstitutionalPaper,
} from '@/modules/receipts/paperPolicy';

type ReceiptSettingsPreviewProps = {
  hospitalName: string;
  governmentLine: string;
  secretariatLine: string;
  location: string;
  footerText: string;
  series: InstitutionalReceiptSeries | null;
  profile: ReceiptPrintProfile | null;
  paper: InstitutionalPaper;
  draft?: boolean;
};

type ReceiptPreviewDimensions = {
  paperWidth: number;
  paperHeight: number;
  contentWidth: number;
  contentHeight: number;
};

export function calculateReceiptPreviewScale({
  paperWidth,
  paperHeight,
  contentWidth,
  contentHeight,
}: ReceiptPreviewDimensions): number {
  const dimensions = [paperWidth, paperHeight, contentWidth, contentHeight];
  if (dimensions.some((dimension) => !Number.isFinite(dimension) || dimension <= 0)) return 1;
  return Math.max(0.05, Math.min(1, paperWidth / contentWidth, paperHeight / contentHeight));
}

function copyLabels(mode: ReceiptPrintProfile['copies_mode'] | undefined): string[] {
  if (mode === 'original_first') return ['ORIGINAL', 'PRIMERA COPIA'];
  if (mode === 'original_first_second') return ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'];
  return ['ORIGINAL'];
}

function nextReceiptNumber(series: InstitutionalReceiptSeries | null): string {
  if (!series) return 'PRUEBA-SIN-SERIE';
  const next = String(series.current_number + 1).padStart(8, '0');
  return series.number_format
    .replace('{series}', series.series)
    .replace('{prefix}', series.prefix)
    .replace(/\{number(?::0?\d+)?\}/, next);
}

export function ReceiptSettingsPreview({
  hospitalName,
  governmentLine,
  secretariatLine,
  location,
  footerText,
  series,
  profile,
  paper,
  draft = true,
}: ReceiptSettingsPreviewProps) {
  const labels = copyLabels(profile?.copies_mode);
  const receiptColor = series?.receipt_number_color;
  const previewDate = formatDate(new Date());
  const showSealSpace = profile?.show_physical_seal_space !== false;
  const paperChoice = paperChoiceFor(paper);
  const presentation = paperPresentation(paper);
  const customWidth = positiveDimension(profile?.width_mm);
  const customHeight = positiveDimension(profile?.height_mm);
  const previewAspectRatio = paper === 'custom' && customWidth && customHeight
    ? `${customWidth} / ${customHeight}`
    : paperChoice.aspectRatio;

  return (
    <PrintPreviewFrame
      data-testid="receipt-settings-preview"
      title="Vista previa institucional"
      description={`${paperChoice.label}. El contenido de muestra no genera ni modifica recibos.`}
      className="overflow-hidden border border-border bg-muted"
    >
      <div className="space-y-4">
        {labels.map((label) => (
          <ReceiptDocumentPreview
            key={label}
            className={cn(
              'receipt-paper-preview mx-auto w-full max-w-3xl border border-receipt-border-soft bg-receipt-paper p-0 text-receipt-ink',
              presentation.previewClass,
            )}
            aspectRatio={previewAspectRatio}
            label={`Vista previa de recibo ${paperChoice.label}`}
            paper={paper}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-receipt-muted">
              <span>Vista previa</span>
              <span>{paperChoice.label}</span>
            </div>
            {draft ? (
              <div className="mb-2 border-2 border-receipt-ink py-1 text-center text-sm font-bold uppercase tracking-normal">
                PRUEBA - SIN VALIDEZ
              </div>
            ) : null}

              <header className="text-center text-xs uppercase leading-tight">
                {governmentLine ? <div>{governmentLine}</div> : null}
                {secretariatLine ? <div>{secretariatLine}</div> : null}
                <div className="text-base font-bold">{hospitalName || 'SIN CONFIGURAR'}</div>
                {location ? <div>{location}</div> : null}
              </header>

              <div className="mt-4 grid grid-cols-1 gap-3 border-y border-receipt-border-soft py-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-semibold">Próximo estimado</span>{' '}
                  {series ? (
                    <Tag color={receiptColor} className="text-lg font-bold">
                      {nextReceiptNumber(series)}
                    </Tag>
                  ) : (
                    <span className="text-lg font-bold text-receipt-muted">{nextReceiptNumber(series)}</span>
                  )}
                </div>
                <div className="space-y-1 sm:text-right">
                  <div><span className="font-semibold">Serie:</span> {series?.series ?? 'PRUEBA'}</div>
                  <div><span className="font-semibold">Monto:</span> L. 25.00</div>
                  <div><span className="font-semibold">Fecha:</span> {previewDate}</div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
                <dt className="font-bold uppercase text-receipt-muted">Paciente</dt>
                <dd className="col-span-2 border-b border-receipt-muted px-1">María López</dd>
                <dt className="font-bold uppercase text-receipt-muted">Monto en letras</dt>
                <dd className="col-span-2 border-b border-receipt-muted px-1">
                  {[series?.legal_text, 'VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS'].filter(Boolean).join(' ')}
                </dd>
              </dl>

              <table className="mt-4 w-full border-collapse text-sm" data-receipt-preview-table="true">
                <caption className="sr-only">Detalle sintético del recibo institucional</caption>
                <thead>
                  <tr className="border-b border-receipt-ink text-left text-xs uppercase text-receipt-muted">
                    <th className="py-1 pr-2" scope="col">Descripción</th>
                    <th className="px-2 py-1 text-right" scope="col">Cant.</th>
                    <th className="px-2 py-1 text-right" scope="col">Precio</th>
                    <th className="py-1 pl-2 text-right" scope="col">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-receipt-border-soft">
                    <td className="py-1 pr-2">Consulta de medicina general</td>
                    <td className="px-2 py-1 text-right tabular-nums">1.00</td>
                    <td className="px-2 py-1 text-right tabular-nums">L. 25.00</td>
                    <td className="py-1 pl-2 text-right font-semibold tabular-nums">L. 25.00</td>
                  </tr>
                </tbody>
              </table>

              <div
                className={cn('mt-auto grid gap-8 pt-8 text-center text-xs', showSealSpace ? 'grid-cols-2' : 'grid-cols-1')}
                data-receipt-preview-signatures="true"
              >
                <div className="border-t border-receipt-ink pt-1">Firma del enterante</div>
                {showSealSpace ? (
                  <div>
                    <div className="mx-auto mb-1 h-12 w-3/4 border border-receipt-ink" />
                    <div className="border-t border-receipt-ink pt-1">Espacio para sello/firma</div>
                  </div>
                ) : null}
              </div>

              {profile?.show_copy_legend !== false ? (
                <footer
                  className="mt-4 border-t border-receipt-ink pt-1 text-center text-xs uppercase"
                  data-receipt-preview-footer="true"
                >
                  {label} - {footerText || 'Copia digital guardada en sistema'}
                </footer>
              ) : null}
          </ReceiptDocumentPreview>
        ))}
      </div>
    </PrintPreviewFrame>
  );
}

function positiveDimension(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ReceiptDocumentPreview({
  aspectRatio,
  children,
  className,
  label,
  paper,
}: {
  aspectRatio: string;
  children: ReactNode;
  className: string;
  label: string;
  paper: InstitutionalPaper;
}) {
  const paperRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const paperElement = paperRef.current;
    const contentElement = contentRef.current;
    if (!paperElement || !contentElement) return undefined;

    paperElement.style.aspectRatio = aspectRatio;

    const fitContent = () => {
      const scale = calculateReceiptPreviewScale({
        paperWidth: paperElement.clientWidth,
        paperHeight: paperElement.clientHeight,
        contentWidth: contentElement.scrollWidth,
        contentHeight: contentElement.scrollHeight,
      });
      contentElement.style.setProperty('--receipt-preview-scale', String(scale));
      contentElement.dataset.receiptPreviewScale = String(scale);
    };

    fitContent();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitContent);
    observer?.observe(paperElement);
    observer?.observe(contentElement);
    window.addEventListener('resize', fitContent);
    void document.fonts?.ready.then(fitContent);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitContent);
      paperElement.style.removeProperty('aspect-ratio');
    };
  }, [aspectRatio]);

  return (
    <section
      ref={paperRef}
      className={className}
      aria-label={label}
      data-receipt-preview-paper={paper}
    >
      <div
        ref={contentRef}
        className="receipt-paper-preview__content flex flex-col p-5"
        data-receipt-preview-content
        data-receipt-preview-fit="contain"
      >
        {children}
      </div>
    </section>
  );
}
