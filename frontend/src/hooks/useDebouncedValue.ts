import { useEffect, useState } from 'react';

/**
 * Retrasa los cambios de `value` hasta que dejan de llegar durante `delayMs`.
 *
 * El valor inicial se devuelve tal cual y sin temporizador: la primera consulta
 * (la del montaje, con los filtros ya asentados) no se retrasa. Sólo se agrupan
 * los cambios posteriores, de modo que una ráfaga de tecleo produce una única
 * actualización con el último valor.
 *
 * Mientras el temporizador corre se conserva el valor anterior, así la clave de
 * React Query no cambia y no se dispara una consulta por cada tecla. La limpieza
 * del efecto cancela el temporizador pendiente cuando llega un valor nuevo.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (Object.is(value, debounced)) return;

    const timeoutId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs, debounced]);

  return debounced;
}
