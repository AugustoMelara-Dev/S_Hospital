import { useCallback, useEffect, useRef } from 'react';
import type { Cents } from '../../../lib/moneyCents';

export type CartConfirmation = { revision: number; totalCents: Cents | null };

/**
 * Guarda de revisión de la cuenta.
 *
 * Un total estimado y confirmado solo es válido para la revisión que el
 * operador vio. Si el carrito, el paciente o el precio cambian, la
 * confirmación queda obsoleta y la emisión debe pedir una nueva revisión
 * en vez de cobrar otro monto en silencio.
 */
export function useCartRevisionGuard(cartRevision: number) {
  const confirmationRef = useRef<CartConfirmation | null>(null);
  const latestCartRevisionRef = useRef(cartRevision);
  useEffect(() => {
    latestCartRevisionRef.current = cartRevision;
  }, [cartRevision]);

  const hasCartChangedSince = useCallback(
    (revision: number) => latestCartRevisionRef.current !== revision,
    [],
  );
  const capture = useCallback((totalCents: Cents | null) => {
    confirmationRef.current = { revision: latestCartRevisionRef.current, totalCents };
  }, []);
  const clear = useCallback(() => {
    confirmationRef.current = null;
  }, []);
  const consume = useCallback((): CartConfirmation | null => {
    const current = confirmationRef.current;
    confirmationRef.current = null;
    return current;
  }, []);

  return { hasCartChangedSince, capture, clear, consume };
}

export type CartRevisionGuard = ReturnType<typeof useCartRevisionGuard>;
