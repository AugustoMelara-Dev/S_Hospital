import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Puente de foco entre la command palette y las vistas admin.
 *
 * La palette vive en el shell, pero el control que debe recibir el foco
 * (`#recibos-query`, `#cobrar-patient-name`, …) pertenece a una vista que se
 * carga con `React.lazy`. Pedir el foco antes de navegar y resolverlo después,
 * cuando el nodo ya existe, evita que la palette dependa de `features/**`.
 *
 * El objetivo se guarda a nivel de módulo (no en estado de React) porque la
 * navegación desmonta la palette; el hook `useAdminFocusRequest` vive en el
 * shell, sobrevive a la navegación y reintenta hasta que el nodo aparece.
 */
let pendingFocusId: string | null = null;

/** Pide que, tras la próxima navegación, se enfoque el control con este id. */
export function requestAdminFocus(id: string): void {
  pendingFocusId = id;
}

/** Cancela una petición pendiente (útil para no arrastrar foco entre pruebas). */
export function clearAdminFocusRequest(): void {
  pendingFocusId = null;
}

/**
 * Consume la petición pendiente en cada cambio de ruta. Reintenta con
 * `requestAnimationFrame` porque la vista puede resolverse en un chunk lazy
 * después del primer render de la ruta.
 */
export function useAdminFocusRequest(): void {
  const location = useLocation();

  useEffect(() => {
    if (!pendingFocusId) return;

    const targetId = pendingFocusId;
    let frame = 0;
    let attempts = 0;
    let cancelled = false;

    const tryFocus = () => {
      if (cancelled) return;

      const element = document.getElementById(targetId);
      if (element) {
        pendingFocusId = null;
        element.focus();
        return;
      }

      // ~2 s a 60 fps: suficiente para un chunk lazy en LAN local; después se
      // abandona para no dejar un bucle vivo.
      if (attempts >= 120) {
        if (pendingFocusId === targetId) pendingFocusId = null;
        return;
      }

      attempts += 1;
      frame = requestAnimationFrame(tryFocus);
    };

    frame = requestAnimationFrame(tryFocus);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (pendingFocusId === targetId) pendingFocusId = null;
    };
  }, [location.pathname, location.search]);
}
