import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ActionBar } from './action-bar';

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  secondary?: ReactNode;
  title: ReactNode;
  topContent?: ReactNode;
};

export function PageHeader({
  actions,
  className,
  description,
  headingLevel = 1,
  secondary,
  title,
  topContent,
}: PageHeaderProps) {
  const HeadingTag = `h${headingLevel}` as 'h1' | 'h2' | 'h3';

  return (
    <header data-slot="page-header" className={cn('flex flex-col gap-4 border-b border-border pb-5', className)}>
      {topContent ? <div data-slot="page-header-top">{topContent}</div> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div data-slot="page-header-main" className="flex min-w-0 flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">Operacion local</p>
          <HeadingTag data-slot="page-header-title" className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
            {title}
          </HeadingTag>
          {description ? (
            <p data-slot="page-header-description" className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <ActionBar data-slot="page-header-actions" className="shrink-0 md:justify-end" fullWidthOnMobile>
            {actions}
          </ActionBar>
        ) : null}
      </div>
      {secondary ? <div data-slot="page-header-secondary">{secondary}</div> : null}
    </header>
  );
}
