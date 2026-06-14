import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type ActionBarProps = {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'between';
};

const alignments = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between',
};

export function ActionBar({ align = 'end', children, className }: ActionBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', alignments[align], className)}>
      {children}
    </div>
  );
}

