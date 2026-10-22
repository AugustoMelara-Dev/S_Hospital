import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Guard de salida segura para formularios con cambios sin guardar.
 *
 * La aplicación usa `BrowserRouter` (modo declarativo) y `useBlocker` solo
 * existe para data routers; por eso el guard combina los mecanismos
 * disponibles sin migrar el enrutador:
 * - Intercepción de clics internos (captura en `document`) que evita que el
 *   router procese la navegación antes de confirmar.
 * - `useGuardedNavigation` para que la navegación programática del shell
 *   (paleta de comandos, atajos, guía) pase por la misma confirmación.
 * - El proveedor conserva `requestAction` para canalizar acciones que
 *   abandonan la pantalla sin cambiar de ruta por la misma confirmación.
 * - `beforeunload` para recarga/cierre del navegador.
 * - Restauración de la ruta + confirmación cuando el navegador usa
 *   atrás/adelante (`popstate`), porque el router declarativo no expone
 *   bloqueo de historial.
 *
 * El bloqueo nunca intercepta el guardado: solo se activa ante una salida
 * (navegación, recarga o descarte) con cambios pendientes.
 */

type PendingNavigation = {
  kind: 'navigation';
  href: string;
  replace: boolean;
  onConfirm?: () => void;
};

type PendingAction = {
  kind: 'action';
  run: () => void;
};

type PendingExit = PendingNavigation | PendingAction;

type UnsavedChangesGuardContextValue = {
  register: (id: string, dirty: boolean) => void;
  unregister: (id: string) => void;
  requestNavigation: (href: string, options?: { replace?: boolean; onConfirm?: () => void }) => void;
  requestAction: (run: () => void) => void;
};

const UnsavedChangesGuardContext = createContext<UnsavedChangesGuardContextValue | null>(null);

function isUnmodifiedPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

function resolveInternalHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.hasAttribute('download')) return null;
  if (anchor.target && anchor.target !== '_self') return null;

  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return null;
  if (/^(mailto|tel):/i.test(rawHref)) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;

  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const nextHref = `${url.pathname}${url.search}${url.hash}`;
  return nextHref === currentHref ? null : nextHref;
}

function hasDirtyGuard(guards: Map<string, boolean>): boolean {
  for (const dirty of guards.values()) {
    if (dirty) return true;
  }
  return false;
}

export function UnsavedChangesGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const guardsRef = useRef(new Map<string, boolean>());
  const originFocusRef = useRef<HTMLElement | null>(null);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [pending, setPending] = useState<PendingExit | null>(null);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const syncDirtyCount = useCallback(() => {
    let next = 0;
    for (const dirty of guardsRef.current.values()) {
      if (dirty) next += 1;
    }
    setDirtyCount(next);
  }, []);

  const register = useCallback((id: string, dirty: boolean) => {
    if (guardsRef.current.get(id) === dirty) return;
    guardsRef.current.set(id, dirty);
    syncDirtyCount();
  }, [syncDirtyCount]);

  const unregister = useCallback((id: string) => {
    if (guardsRef.current.delete(id)) syncDirtyCount();
  }, [syncDirtyCount]);

  const openPending = useCallback((exit: PendingExit) => {
    // Radix no restaura el foco por sí solo cuando el diálogo se abre sin
    // `AlertDialogTrigger` (el modal previene el auto-focus de cierre), así
    // que se conserva el control de origen para devolverle el foco al
    // cerrar con "Seguir editando" o Escape.
    const active = document.activeElement;
    originFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setPending(exit);
  }, []);

  const requestNavigation = useCallback((href: string, options?: { replace?: boolean; onConfirm?: () => void }) => {
    if (!hasDirtyGuard(guardsRef.current)) {
      navigate(href, options?.replace ? { replace: true } : undefined);
      options?.onConfirm?.();
      return;
    }
    openPending({ kind: 'navigation', href, replace: options?.replace === true, onConfirm: options?.onConfirm });
  }, [navigate, openPending]);

  const requestAction = useCallback((run: () => void) => {
    if (!hasDirtyGuard(guardsRef.current)) {
      run();
      return;
    }
    openPending({ kind: 'action', run });
  }, [openPending]);

  const hasDirtyGuards = dirtyCount > 0;

  useEffect(() => {
    if (!hasDirtyGuards) return;

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || !isUnmodifiedPrimaryClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = resolveInternalHref(anchor);
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      requestNavigation(href);
    }

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasDirtyGuards, requestNavigation]);

  useEffect(() => {
    if (!hasDirtyGuards) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyGuards]);

  useEffect(() => {
    if (!hasDirtyGuards) return;

    function handlePopState() {
      const guardedHref = `${locationRef.current.pathname}${locationRef.current.search}${locationRef.current.hash}`;
      const targetHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (targetHref === guardedHref) return;

      navigate(guardedHref, { replace: true });
      openPending({ kind: 'navigation', href: targetHref, replace: true });
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasDirtyGuards, navigate, openPending]);

  const contextValue = useMemo<UnsavedChangesGuardContextValue>(
    () => ({ register, unregister, requestNavigation, requestAction }),
    [register, unregister, requestNavigation, requestAction],
  );

  function confirmDiscard() {
    if (!pending) return;
    const next = pending;
    setPending(null);
    if (next.kind === 'navigation') {
      navigate(next.href, next.replace ? { replace: true } : undefined);
      next.onConfirm?.();
      return;
    }
    next.run();
  }

  function handleCloseAutoFocus(event: Event) {
    event.preventDefault();
    const origin = originFocusRef.current;
    originFocusRef.current = null;
    if (origin?.isConnected) origin.focus();
  }

  return (
    <UnsavedChangesGuardContext.Provider value={contextValue}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent onCloseAutoFocus={handleCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === 'action'
                ? 'Esta pantalla tiene cambios sin guardar. Si cierra sesión ahora, se perderán.'
                : 'Esta pantalla tiene cambios sin guardar. Si sale ahora, se perderán.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDiscard}>
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesGuardContext.Provider>
  );
}

/**
 * Registra un formulario en el guard. `dirty` debe reflejar el estado real
 * del formulario (por ejemplo `form.formState.isDirty` de react-hook-form).
 * Sin proveedor el registro es inerte, lo que mantiene testeables las vistas
 * por separado.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const context = useContext(UnsavedChangesGuardContext);
  const id = useId();

  useEffect(() => {
    if (!context) return;
    context.register(id, dirty);
    return () => context.unregister(id);
  }, [context, dirty, id]);
}

/**
 * Solicita una navegación programática respetando el guard. Con cambios
 * pendientes abre la confirmación de descarte; sin proveedor navega directo.
 * `onConfirm` permite a quien navega reaccionar solo cuando la navegación
 * realmente ocurre (p. ej. avanzar un paso de la guía).
 */
export function useGuardedNavigation() {
  const context = useContext(UnsavedChangesGuardContext);
  const navigate = useNavigate();

  return useCallback((href: string, options?: { replace?: boolean; onConfirm?: () => void }) => {
    if (context) {
      context.requestNavigation(href, options);
      return;
    }
    navigate(href, options?.replace ? { replace: true } : undefined);
    options?.onConfirm?.();
  }, [context, navigate]);
}

/**
 * Canaliza una acción que abandona la pantalla sin navegar (por ejemplo,
 * cerrar sesión) por la misma confirmación de cambios sin guardar.
 */
export function useGuardedAction() {
  const context = useContext(UnsavedChangesGuardContext);

  return useCallback((run: () => void) => {
    if (context) {
      context.requestAction(run);
      return;
    }
    run();
  }, [context]);
}

