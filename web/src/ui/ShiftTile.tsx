import { cn } from '@/lib/cn';
import { SHIFT_STEP_ORDER, shiftLabel, type ShiftSteps } from './shift';

export type ShiftTileProps = {
  steps: ShiftSteps;
  size?: 'sm' | 'md';
  className?: string;
  /** Hide from assistive tech when a sibling already says the same in words. */
  decorative?: boolean;
};

/**
 * The shift brick: a square tile split in four quarters by juntas
 * (top-left Apertura, top-right Cobros, bottom-right Arqueo, bottom-left Cierre,
 * read clockwise). Completed quarters fill in rail green.
 * Use only for the shift status (and the arqueo grid); never as decoration.
 */
export function ShiftTile({ steps, size = 'md', className, decorative = false }: ShiftTileProps) {
  // Grid order is row-major (TL, TR, BL, BR); the shift reads clockwise.
  const cells: Array<keyof ShiftSteps> = [SHIFT_STEP_ORDER[0], SHIFT_STEP_ORDER[1], SHIFT_STEP_ORDER[3], SHIFT_STEP_ORDER[2]];
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : shiftLabel(steps)}
      aria-hidden={decorative || undefined}
      className={cn('shift-tile', size === 'sm' ? 'size-[16px]' : 'size-[24px]', className)}
    >
      {cells.map((k) => (
        <span key={k} data-step={k} data-done={steps[k]} />
      ))}
    </span>
  );
}
