import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type ActionBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  align?: 'start' | 'end' | 'between';
  children?: ReactNode;
  fullWidthOnMobile?: boolean;
  primary?: ReactNode;
  secondary?: ReactNode;
};

const alignments = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between',
};

export function ActionBar({
  align = 'end',
  children,
  className,
  fullWidthOnMobile = false,
  primary,
  secondary,
  ...props
}: ActionBarProps) {
  const hasGroups = Boolean(primary || secondary);

  return (
    <div
      data-slot="action-bar"
      className={cn(
        'flex flex-wrap items-center gap-2',
        alignments[align],
        fullWidthOnMobile && '[&_[data-slot=button]]:max-sm:w-full',
        className,
      )}
      {...props}
    >
      {hasGroups ? (
        <>
          {secondary ? (
            <div data-slot="action-bar-secondary" className="flex min-w-0 flex-wrap items-center gap-2">
              {secondary}
            </div>
          ) : null}
          {primary ? (
            <div data-slot="action-bar-primary" className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
              {primary}
            </div>
          ) : null}
        </>
      ) : (
        children
      )}
    </div>
  );
}
