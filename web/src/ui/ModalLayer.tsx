import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Stack of open layers: only the top-most reacts to Esc / Tab. */
const stack: symbol[] = [];

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

export type ModalLayerProps = {
  open: boolean;
  onClose: () => void;
  /** Element that receives focus on open (default: first focusable in panel). */
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  /** When false, Esc and overlay click do nothing (e.g. while saving). */
  dismissible?: boolean;
  /** Skip the overlay fade (keyboard-triggered, high-frequency layers). */
  instant?: boolean;
  /** Overlay and container classes (positioning). */
  containerClassName: string;
  children: (panelRef: RefObject<HTMLDivElement | null>) => ReactNode;
};

/**
 * Shared modal mechanics for Dialog and Drawer: portal, focus trap, Esc,
 * return focus to the trigger, `inert` app root, scroll lock.
 */
export function ModalLayer({ open, onClose, initialFocusRef, dismissible = true, instant = false, containerClassName, children }: ModalLayerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol('layer');
    stack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Portal content is committed in the same pass: focus synchronously so
    // keystrokes typed right after opening land in the dialog.
    {
      const panel = panelRef.current;
      if (panel) (initialFocusRef?.current ?? focusables(panel)[0] ?? panel).focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== token) return;
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables(panel);
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      if (appRoot && stack.length === 0) appRoot.inert = wasInert;
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    // initialFocusRef is read once on open by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={containerClassName}>
      <div
        className={instant ? 'absolute inset-0 bg-[var(--overlay)]' : 'anim-fade-in absolute inset-0 bg-[var(--overlay)]'}
        aria-hidden="true"
        onMouseDown={() => {
          if (dismissibleRef.current) onCloseRef.current();
        }}
      />
      {children(panelRef)}
    </div>,
    document.body,
  );
}
