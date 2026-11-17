import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Small label above the title (section / breadcrumb). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <div className="text-[12px] font-medium tracking-[0.06em] text-ink-3 uppercase">{eyebrow}</div>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        {description && <p className="max-w-[65ch] text-[13.5px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
