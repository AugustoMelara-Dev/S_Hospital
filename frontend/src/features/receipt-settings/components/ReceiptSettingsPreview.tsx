import type { InstitutionalReceiptSeries, ReceiptPrintProfile } from '@/lib/api';
import { cn } from '@/lib/utils';

type ReceiptSettingsPreviewProps = {
  hospitalName: string;
  governmentLine: string;
  secretariatLine: string;
  location: string;
  footerText: string;
  series: InstitutionalReceiptSeries | null;
  profile: ReceiptPrintProfile | null;
  draft?: boolean;
};

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
  draft = true,
}: ReceiptSettingsPreviewProps) {
  const labels = copyLabels(profile?.copies_mode);
  const receiptColor = series?.receipt_number_color ?? '#b91c1c';

  return (
    <div className="space-y-3" data-testid="receipt-settings-preview">
      {labels.map((label) => (
        <section
          key={label}
          className={cn(
            'mx-auto w-full max-w-3xl border border-neutral-800 bg-white p-5 text-black shadow-none',
            profile?.paper_kind === 'letter_landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/5.5]',
          )}
          aria-label={`Vista previa ${label.toLowerCase()} del recibo institucional`}
        >
          {draft ? (
            <div className="mb-2 border-2 border-black py-1 text-center text-sm font-bold uppercase tracking-normal">
              PRUEBA - SIN VALIDEZ
            </div>
          ) : null}

          <header className="text-center text-[11px] uppercase leading-tight">
            <div>{governmentLine}</div>
            <div>{secretariatLine}</div>
            <div className="text-base font-bold">{hospitalName || 'SIN CONFIGURAR'}</div>
            <div>{location}</div>
          </header>

          <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-4 border-y border-neutral-300 py-2 text-sm">
            <div>
              <span className="font-semibold">Próximo estimado</span>{' '}
              <span className="text-lg font-bold" style={{ color: receiptColor }}>
                {nextReceiptNumber(series)}
              </span>
            </div>
            <div className="space-y-1 text-right">
              <div><span className="font-semibold">Serie:</span> {series?.series ?? 'PRUEBA'}</div>
              <div><span className="font-semibold">Monto:</span> L. 25.00</div>
              <div><span className="font-semibold">Fecha:</span> 15/06/2026</div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-bold uppercase text-neutral-700">Paciente</dt>
            <dd className="border-b border-neutral-700 px-1">Paciente de prueba</dd>
            <dt className="font-bold uppercase text-neutral-700">Monto en letras</dt>
            <dd className="border-b border-neutral-700 px-1">
              {[series?.legal_text, 'VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS'].filter(Boolean).join(' ')}
            </dd>
          </dl>

          <table className="mt-4 w-full border-collapse text-sm">
            <caption className="sr-only">Detalle sintético del recibo institucional</caption>
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[11px] uppercase text-neutral-700">
                <th className="py-1 pr-2" scope="col">Descripción</th>
                <th className="px-2 py-1 text-right" scope="col">Cant.</th>
                <th className="px-2 py-1 text-right" scope="col">Precio</th>
                <th className="py-1 pl-2 text-right" scope="col">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-300">
                <td className="py-1 pr-2">Servicios hospitalarios de prueba</td>
                <td className="px-2 py-1 text-right tabular-nums">1.00</td>
                <td className="px-2 py-1 text-right tabular-nums">L. 25.00</td>
                <td className="py-1 pl-2 text-right font-semibold tabular-nums">L. 25.00</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-black pt-1">Firma del enterante</div>
            <div>
              {profile?.show_physical_seal_space !== false ? (
                <div className="mx-auto mb-1 h-12 w-3/4 border border-black" />
              ) : null}
              <div className="border-t border-black pt-1">Espacio para sello/firma</div>
            </div>
          </div>

          {profile?.show_copy_legend !== false ? (
            <footer className="mt-4 border-t border-black pt-1 text-center text-[10px] uppercase">
              {label} - {footerText || 'Copia digital guardada en sistema'}
            </footer>
          ) : null}
        </section>
      ))}
    </div>
  );
}
