import { useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
import { ModalLayer } from './ModalLayer';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
  initialFocusRef?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  onSubmit?: () => void;
};

/** Side panel from the right (forms such as "Nuevo/Editar concepto"). */
export function Drawer({ open, onClose, title, description, children, footer, width = 'md', initialFocusRef, dismissible = true, onSubmit }: DrawerProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;

  const inner = (
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
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <footer className="flex items-center justify-end gap-2 border-t border-junta bg-surface-2 px-5 py-3">{footer}</footer>}
    </>
  );

  return (
    <ModalLayer
      open={open}
      onClose={onClose}
      initialFocusRef={initialFocusRef}
      dismissible={dismissible}
      containerClassName="fixed inset-0 z-50 flex justify-end"
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
            'anim-slide-in-right relative flex h-full w-full flex-col border-l border-junta bg-surface shadow-pop outline-none',
            width === 'md' ? 'max-w-[480px]' : 'max-w-[720px]',
          )}
        >
          {onSubmit ? (
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              {inner}
            </form>
          ) : (
            inner
          )}
        </div>
      )}
    </ModalLayer>
  );
}
