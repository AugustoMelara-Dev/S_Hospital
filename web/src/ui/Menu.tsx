import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type MenuItem =
  | { type?: 'item'; label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: ReactNode }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode };

export type MenuProps = {
  /** Renders the trigger; spread `props` onto a button. */
  trigger: (props: {
    id: string;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    ref: (el: HTMLElement | null) => void;
  }) => ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  className?: string;
};

/** Accessible dropdown menu: ↑/↓/Home/End, Enter, Esc, click-outside, return focus. */
export function Menu({ trigger, items, align = 'end', className }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const itemEls = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => itemEls()[0]?.focus());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  return (
    <div className="relative">
      {trigger({
        id: `${id}-trigger`,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': `${id}-menu`,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        },
        ref: (el) => {
          triggerRef.current = el;
        },
      })}
      {open && (
        <div
          ref={listRef}
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          onKeyDown={onListKey}
          className={cn(
            'anim-pop-in absolute top-[calc(100%+6px)] z-40 min-w-[220px] rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-3',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            className,
          )}
        >
          {items.map((it, i) => {
            if (it.type === 'separator') return <div key={i} role="separator" className="my-1 h-px bg-line" />;
            if (it.type === 'label')
              return (
                <div key={i} className="px-2.5 pt-1.5 pb-1 text-[12px] text-ink-3">
                  {it.label}
                </div>
              );
            return (
              <div
                key={i}
                role="menuitem"
                tabIndex={-1}
                aria-disabled={it.disabled || undefined}
                onClick={() => {
                  if (it.disabled) return;
                  close();
                  it.onSelect();
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !it.disabled) {
                    e.preventDefault();
                    close();
                    it.onSelect();
                  }
                }}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[13.5px] outline-none select-none',
                  'focus:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-3',
                  it.danger ? 'text-danger focus:bg-danger-soft [&_svg]:text-danger' : 'text-ink',
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.hint}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
