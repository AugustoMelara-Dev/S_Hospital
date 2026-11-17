import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { INVOICE_STATUS_LABEL, invoiceDisplayStatus, type Invoice, type InvoiceDisplayStatus } from '@/api/types';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info';

/**
 * State glyphs: states are told apart by SHAPE and label, colour only supports.
 *   filled  ■  done / pagada        hollow ☐  pending
 *   half    ◧  partial              struck ⊠  void / anulada
 *   diamond ◆  sin cobro            dot       neutral marker
 */
export type GlyphShape = 'filled' | 'hollow' | 'half' | 'struck' | 'diamond' | 'dot';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-2',
  brand: 'text-slate',
  info: 'text-slate',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function StatusGlyph({ shape, className }: { shape: GlyphShape; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={cn('size-2.5 shrink-0', className)}>
      {shape === 'filled' && <rect x="0.5" y="0.5" width="9" height="9" fill="currentColor" />}
      {shape === 'hollow' && <rect x="1.1" y="1.1" width="7.8" height="7.8" fill="none" stroke="currentColor" strokeWidth="1.4" />}
      {shape === 'half' && (
        <>
          <rect x="1.1" y="1.1" width="7.8" height="7.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="1" y="1" width="4" height="8" fill="currentColor" />
        </>
      )}
      {shape === 'struck' && (
        <>
          <rect x="1.1" y="1.1" width="7.8" height="7.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 8.5 8.5 1.5" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
      {shape === 'diamond' && <path d="M5 0.4 9.6 5 5 9.6 0.4 5Z" fill="currentColor" />}
      {shape === 'dot' && <rect x="2.5" y="2.5" width="5" height="5" fill="currentColor" />}
    </svg>
  );
}

const TONES: Record<Tone, string> = {
  neutral: 'border-junta bg-transparent text-ink-2',
  brand: 'border-transparent bg-slate-soft text-slate-text',
  info: 'border-transparent bg-slate-soft text-slate-text',
  ok: 'border-transparent bg-ok-soft text-ok',
  warn: 'border-transparent bg-warn-soft text-warn',
  danger: 'border-transparent bg-danger-soft text-danger',
};

export type BadgeProps = {
  tone?: Tone;
  /** Leading state glyph (filled square). Prefer `shape` to say which state. */
  dot?: boolean;
  shape?: GlyphShape;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
};

/** Small tag (Exento, Sin cobro por receta, Activo…): 3px radius, 11px semibold. */
export function Badge({ tone = 'neutral', dot, shape, children, className, icon }: BadgeProps) {
  const glyph = shape ?? (dot ? 'filled' : undefined);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-[3px] border px-1.5 text-[11.5px] leading-[18px] font-semibold whitespace-nowrap [&_svg]:size-3',
        TONES[tone],
        className,
      )}
    >
      {glyph && <StatusGlyph shape={glyph} className="size-2" />}
      {icon}
      {children}
    </span>
  );
}

export const INVOICE_STATUS_TONE: Record<InvoiceDisplayStatus, Tone> = {
  pending: 'warn',
  partial: 'info',
  paid: 'ok',
  no_charge: 'neutral',
  void: 'danger',
};

export const INVOICE_STATUS_SHAPE: Record<InvoiceDisplayStatus, GlyphShape> = {
  pending: 'hollow',
  partial: 'half',
  paid: 'filled',
  no_charge: 'diamond',
  void: 'struck',
};

export type StatusStampProps = {
  /** Either a display status or an invoice (status + settlement). */
  status: InvoiceDisplayStatus | Pick<Invoice, 'status' | 'settlement'>;
  /** `badge` for tables (glyph + label); `stamp` is the bordered mark for document views. */
  variant?: 'badge' | 'stamp';
  className?: string;
};

/** Invoice status: Pendiente de cobro / Pago parcial / Pagada / Emitida sin cobro / Anulada. */
export function StatusStamp({ status, variant = 'badge', className }: StatusStampProps) {
  const s = typeof status === 'string' ? status : invoiceDisplayStatus(status);
  const tone = INVOICE_STATUS_TONE[s];
  const shape = INVOICE_STATUS_SHAPE[s];
  if (variant === 'badge') {
    return (
      <span className={cn('inline-flex items-center gap-2 text-[13px] leading-5 font-medium whitespace-nowrap text-ink', className)}>
        <StatusGlyph shape={shape} className={TONE_TEXT[tone]} />
        {INVOICE_STATUS_LABEL[s]}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-[3px] border border-current px-2.5 text-[12px] leading-none font-bold tracking-[0.06em] whitespace-nowrap uppercase',
        TONE_TEXT[tone],
        className,
      )}
    >
      <StatusGlyph shape={shape} />
      {INVOICE_STATUS_LABEL[s]}
    </span>
  );
}
