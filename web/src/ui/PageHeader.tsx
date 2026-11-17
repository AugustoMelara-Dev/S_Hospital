import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/**
 * The app shell provides a slot in its 56px top bar. When present, PageHeader
 * renders the page title there (as the page's single h1) and keeps only the
 * description and actions in the page. Without a shell (tests, standalone
 * pages) everything renders inline.
 */
const PageTitleSlot = createContext<HTMLElement | null>(null);
export const PageTitleSlotProvider = PageTitleSlot.Provider;

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /**
   * @deprecated Kickers/eyebrows above headings are banned in this design system.
   * Accepted for compatibility and ignored. Put context in `description`.
   */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** `topbar` (default) moves the title into the shell's top bar; `inline` keeps it in the page. */
  placement?: 'topbar' | 'inline';
};

export function PageHeader({ title, description, actions, className, placement = 'topbar' }: PageHeaderProps) {
  const slot = useContext(PageTitleSlot);
  const inTopBar = placement === 'topbar' && slot !== null;

  const h1 = (
    <h1
      className={cn(
        'min-w-0 truncate font-bold tracking-[-0.015em] text-ink',
        inTopBar ? 'text-[22px] leading-7' : 'text-[24px] leading-8',
      )}
    >
      {title}
    </h1>
  );

  if (inTopBar) {
    return (
      <>
        {createPortal(h1, slot)}
        {(description || actions) && (
          <header className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-5', className)}>
            {description ? <p className="max-w-[75ch] min-w-0 text-[14px] leading-5 text-ink-2">{description}</p> : <span />}
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
        )}
      </>
    );
  }

  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {h1}
        {description && <p className="max-w-[75ch] text-[14px] leading-5 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
