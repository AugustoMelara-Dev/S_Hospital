import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = Omit<ComponentProps<'section'>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Remove body padding (tables that touch the edges). */
  flush?: boolean;
  bodyClassName?: string;
};

/** Surface panel with one junta border and an optional header row ruled by a junta. `Panel` is an alias. */
export function Card({ title, description, actions, flush, className, bodyClassName, children, ...rest }: CardProps) {
  const hasHeader = title || actions;
  return (
    <section
      {...rest}
      className={cn('flex flex-col rounded-[var(--radius-md)] border border-junta bg-surface', className)}
    >
      {hasHeader && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-junta px-4 py-2.5">
          <div className="flex min-w-0 flex-col">
            {title && <h2 className="text-[15px] leading-5 font-bold text-ink">{title}</h2>}
            {description && <p className="text-[12px] leading-4 text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4', 'min-w-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

export const Panel = Card;
