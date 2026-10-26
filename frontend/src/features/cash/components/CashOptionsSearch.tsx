import { useId } from 'react';
import { userSafeErrorMessage } from '@/lib/api';
import type { useCashSessionOptions } from '@/hooks/useCashSessionOptions';
import { INPUT_CLASS, SECONDARY_BUTTON } from '../cashUi';

type Props = { picker: ReturnType<typeof useCashSessionOptions>; label: string };

/** Search and explicit pagination supplement native accessible select fields. */
export function CashOptionsSearch({ picker, label }: Props) {
  const id = useId();
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{label}</label>
      <input id={id} type="search" autoComplete="off" value={picker.search} onChange={(event) => picker.setSearch(event.target.value)} className={INPUT_CLASS} />
      {picker.isError ? (
        <div className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-danger)]">
          <p role="alert">{userSafeErrorMessage(picker.error, 'No se pudieron consultar las opciones.')}</p>
          <button type="button" aria-label={`Reintentar: ${label}`} className={SECONDARY_BUTTON} onClick={() => void picker.refetch()}>Reintentar búsqueda</button>
        </div>
      ) : picker.isFetching || picker.searching ? <p role="status" className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Consultando opciones…</p> : null}
      {picker.hasNextPage ? (
        <button type="button" aria-label={`Cargar más: ${label}`} className={SECONDARY_BUTTON} disabled={picker.isFetching || picker.searching} onClick={() => void picker.fetchNextPage()}>Cargar más opciones</button>
      ) : null}
      {!picker.isPending && !picker.isError && picker.options.length === 0 ? <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Sin coincidencias. Cambie la búsqueda.</p> : null}
    </div>
  );
}
