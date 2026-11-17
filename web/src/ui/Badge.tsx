import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { INVOICE_STATUS_LABEL, invoiceDisplayStatus, type Invoice, type InvoiceDisplayStatus } from '@/api/types';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-soft text-brand border-brand/25',
  ok: 'bg-ok-soft text-ok border-ok/25',
  warn: 'bg-warn-soft text-warn border-warn/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  info: 'bg-info-soft text-info border-info/25',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
};

export type BadgeProps = { tone?: Tone; dot?: boolean; children: ReactNode; className?: string; icon?: ReactNode };

export function Badge({ tone = 'neutral', dot, children, className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[12px] leading-none font-medium whitespace-nowrap [&_svg]:size-3',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {icon}
      {children}
    </span>
  );
}

export const INVOICE_STATUS_TONE: Record<InvoiceDisplayStatus, Tone> = {
  pending: 'warn',
  partial: 'info',
  paid: 'ok',
  no_charge: 'brand',
  void: 'danger',
};

export type StatusStampProps = {
  /** Either a display status or an invoice (status + settlement). */
  status: InvoiceDisplayStatus | Pick<Invoice, 'status' | 'settlement'>;
  /** `badge` for tables; `stamp` is the large rubber-stamp look for detail views. */
  variant?: 'badge' | 'stamp';
  className?: string;
};

/** Invoice status: Pendiente de cobro / Pago parcial / Pagada / Emitida sin cobro / Anulada. */
export function StatusStamp({ status, variant = 'badge', className }: StatusStampProps) {
  const s = typeof status === 'string' ? status : invoiceDisplayStatus(status);
  const tone = INVOICE_STATUS_TONE[s];
  if (variant === 'badge') {
    return (
      <Badge tone={tone} dot className={className}>
        {INVOICE_STATUS_LABEL[s]}
      </Badge>
    );
  }
  const color: Record<Tone, string> = {
    neutral: 'text-ink-2 border-ink-2',
    brand: 'text-brand border-brand',
    ok: 'text-ok border-ok',
    warn: 'text-warn border-warn',
    danger: 'text-danger border-danger',
    info: 'text-info border-info',
  };
  return (
    <span
      className={cn(
        'inline-flex -rotate-2 items-center rounded-[4px] border-2 px-2.5 py-1 text-[12px] font-bold tracking-[0.12em] uppercase',
        'shadow-[inset_0_0_0_1px_currentColor] [mix-blend-mode:multiply] dark:[mix-blend-mode:normal]',
        color[tone],
        className,
      )}
    >
      {INVOICE_STATUS_LABEL[s]}
    </span>
  );
}
