import { cn } from '@/lib/cn';

export function Skeleton({ className, lines }: { className?: string; lines?: number }) {
  if (lines && lines > 1) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn('skeleton h-3.5', i === lines - 1 && 'w-2/3', className)} />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className={cn('skeleton h-4', className)} />;
}
