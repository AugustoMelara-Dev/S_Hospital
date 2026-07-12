import { type ReactNode } from 'react';
import { Typography } from 'antd';
import { cn } from '../../lib/utils';

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  id?: string;
  secondary?: ReactNode;
  title: ReactNode;
  topContent?: ReactNode;
};

/**
 * Institutional page header — flat, no gradients, no rounded corners, no shadows.
 * Matches the hospital design system: sober, dense, structured.
 */
export function PageHeader({
  actions,
  className,
  description,
  headingLevel = 1,
  id,
  secondary,
  title,
  topContent,
}: PageHeaderProps) {
  const HeadingTag = `h${headingLevel}` as 'h1' | 'h2' | 'h3';

  return (
    <header
      data-slot="page-header"
      className={cn('border-b border-border bg-surface px-5 py-5 sm:px-6', className)}
    >
      {topContent ? <div data-slot="page-header-top" className="mb-4">{topContent}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div data-slot="page-header-main" className="flex min-w-0 flex-col gap-1">
          <HeadingTag
            id={id}
            data-slot="page-header-title"
            className="m-0 text-xl font-semibold leading-tight text-foreground md:text-2xl"
          >
            {title}
          </HeadingTag>
          {description ? (
            <Typography.Text
              type="secondary"
              data-slot="page-header-description"
              className="text-sm leading-relaxed"
            >
              {description}
            </Typography.Text>
          ) : null}
        </div>
        {actions ? (
          <div data-slot="page-header-actions" className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {secondary ? <div data-slot="page-header-secondary" className="mt-4">{secondary}</div> : null}
    </header>
  );
}
