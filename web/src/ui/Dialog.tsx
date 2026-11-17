import { useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
import { ModalLayer } from './ModalLayer';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Block Esc / overlay / close button (e.g. while a request is running). */
  dismissible?: boolean;
  /** Render the body inside a <form> so Enter submits. */
  onSubmit?: () => void;
  className?: string;
};

const SIZES = { sm: 'max-w-[400px]', md: 'max-w-[520px]', lg: 'max-w-[720px]', xl: 'max-w-[960px]' };

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  dismissible = true,
  onSubmit,
  className,
}: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;

  const body = (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-junta px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="text-[17px] leading-6 font-bold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-[13px] text-ink-2">
              {description}
            </p>
          )}
        </div>
        <IconButton label="Cerrar" icon={<X />} size="sm" onClick={onClose} disabled={!dismissible} className="-my-1 -mr-2" />
      </header>
      {children !== undefined && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-junta bg-surface-2 px-5 py-3">
          {footer}
        </footer>
      )}
    </>
  );

  return (
    <ModalLayer
      open={open}
      onClose={onClose}
      initialFocusRef={initialFocusRef}
      dismissible={dismissible}
      containerClassName="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pt-[12vh] pb-8"
    >
      {(panelRef) => (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          className={cn(
            'anim-pop-in relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface shadow-pop outline-none',
            SIZES[size],
            className,
          )}
        >
          {onSubmit ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              {body}
            </form>
          ) : (
            body
          )}
        </div>
      )}
    </ModalLayer>
  );
}
