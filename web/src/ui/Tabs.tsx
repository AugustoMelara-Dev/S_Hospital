import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TabItem<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** Small counter next to the label. */
  count?: number;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps<V extends string = string> = {
  items: TabItem<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  /** Accessible name for the tablist. */
  label: string;
  className?: string;
  /** Keep inactive panels mounted (preserves form state). */
  keepMounted?: boolean;
};

/** WAI-ARIA tabs: roving tabindex, ←/→/Home/End, automatic activation. */
export function Tabs<V extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  label,
  className,
  keepMounted = false,
}: TabsProps<V>) {
  const id = useId();
  const [internal, setInternal] = useState<V | undefined>(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (v: V) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.disabled);
    const current = enabled.findIndex(({ it }) => it.value === active);
    let next = -1;
    if (e.key === 'ArrowRight') next = (current + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = enabled[next];
    if (!target) return;
    select(target.it.value);
    refs.current[target.i]?.focus();
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative flex gap-4 overflow-x-auto border-b border-junta">
        {items.map((it, i) => {
          const selected = it.value === active;
          return (
            <button
              key={it.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${it.value}`}
              aria-controls={`${id}-panel-${it.value}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={it.disabled}
              onClick={() => select(it.value)}
              className={cn(
                'relative -mb-px inline-flex h-10 items-center gap-2 px-0.5 text-sm whitespace-nowrap transition-colors duration-[120ms]',
                'border-b-2 focus-visible:outline-offset-[-2px] disabled:opacity-50',
                selected ? 'border-ink font-semibold text-ink' : 'border-transparent font-semibold text-ink-2 hover:border-junta-strong hover:text-ink',
              )}
            >
              {it.label}
              {it.count !== undefined && (
                <span
                  className={cn(
                    'num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] px-1.5 text-[11px] font-semibold',
                    selected ? 'bg-ink text-surface' : 'bg-ground text-ink-2',
                  )}
                >
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items.map((it) =>
        it.value === active || keepMounted ? (
          <div
            key={it.value}
            role="tabpanel"
            id={`${id}-panel-${it.value}`}
            aria-labelledby={`${id}-tab-${it.value}`}
            hidden={it.value !== active}
            tabIndex={0}
            className="pt-5 outline-none focus-visible:outline-2"
          >
            {it.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
