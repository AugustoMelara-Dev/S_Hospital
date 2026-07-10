import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type StatusMarkProps = HTMLAttributes<HTMLDivElement> & {
  tone: 'neutral' | 'success' | 'attention' | 'danger' | 'info';
  label: string;
};

const tones = {
  neutral: 'border-line bg-muted text-ink',
  success: 'border-clinical/35 bg-clinical/10 text-clinical',
  attention: 'border-attention/35 bg-attention/10 text-attention',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  info: 'border-navy/35 bg-navy/10 text-navy',
};

const symbols = {
  neutral: 'N',
  success: 'OK',
  attention: '!',
  danger: 'X',
  info: 'i',
};

export function StatusMark({ className, label, tone, ...props }: StatusMarkProps) {
  return (
    <div
      aria-label={`Estado: ${label}`}
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="font-mono font-bold">
        {symbols[tone]}
      </span>
      <span>{label}</span>
    </div>
  );
}
