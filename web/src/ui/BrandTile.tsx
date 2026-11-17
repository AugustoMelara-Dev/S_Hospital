import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

export type BrandTileProps = {
  /** Edge in px (default 32). */
  size?: number;
  className?: string;
  /** Accessible name; omit when the system name is written next to it. */
  label?: string;
};

/**
 * The hydraulic-tile rosette: four quadrants with quarter circles of oxide and
 * ochre meeting at the centre, juntas in rail green. Brand mark only.
 */
export function BrandTile({ size = 32, className, label }: BrandTileProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('brand-tile inline-block', className)}
      style={{ '--tile-size': `${size}px` } as CSSProperties}
    />
  );
}
