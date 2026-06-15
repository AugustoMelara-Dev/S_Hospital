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
            'mx-auto w-full max-w-3xl border border-foreground bg-white p-5 text-black shadow-none',
            profile?.paper_kind === 'letter_landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/5.5]',
          )}
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

          <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-4 text-sm">
            <div>
              <span className="font-semibold">Recibo No.</span>{' '}
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

          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-[42px_1fr] items-end gap-2">
              <span className="font-bold">El</span>
              <span className="border-b border-black px-1">Paciente de prueba</span>
            </div>
            <div className="grid grid-cols-[42px_1fr] items-end gap-2">
              <span className="font-bold">Que</span>
              <span className="border-b border-black px-1">
                {[series?.legal_text, 'VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS'].filter(Boolean).join(' ')}
              </span>
            </div>
            <div className="grid grid-cols-[42px_1fr] items-start gap-2">
              <span className="font-bold">Por</span>
              <span className="min-h-12 border-b border-black px-1">Servicios hospitalarios de prueba</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-black pt-1">Firma del enterante</div>
            <div>
              {profile?.show_physical_seal_space !== false ? (
                <div className="mx-auto mb-1 h-12 w-3/4 border border-black" />
              ) : null}
              <div className="border-t border-black pt-1">Sello y firma autorizada</div>
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
