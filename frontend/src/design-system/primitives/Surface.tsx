import { type ElementType, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'aside';
  tone?: 'default' | 'quiet' | 'strong';
};

const tones = {
  default: 'border-line bg-surface text-ink',
  quiet: 'border-transparent bg-muted text-ink',
  strong: 'border-navy bg-navy text-white',
};

export function Surface({ as = 'section', className, tone = 'default', ...props }: SurfaceProps) {
  const Comp: ElementType = as;

  return (
    <Comp
      className={cn('rounded-md border p-5', tones[tone], className)}
      {...props}
    />
  );
}
