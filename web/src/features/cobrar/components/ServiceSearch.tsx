import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { qk } from '@/api/queryClient';
import type { Category, Paginated, Service } from '@/api/types';
import { ERYTHROPOIETIN_RULE } from '@/api/types';
import { Badge, Field, Input, Kbd, Select, Spinner } from '@/ui';
import { useDebouncedValue } from '../hooks';

export const SEARCH_DEBOUNCE_MS = 150;

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (service: Service) => void;
  disabled?: boolean;
};

function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => {
      const data = await api.get<Category[] | Paginated<Category>>('/categories');
      const list = Array.isArray(data) ? data : (data?.items ?? []);
      return list.filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * "Agregar conceptos": combobox with debounced server search (≤30), ↑/↓, Enter adds,
 * Esc closes. Enter pressed before results arrive adds the first result once they do.
 */
export function ServiceSearch({ inputRef, onAdd, disabled }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const pendingEnter = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  const search = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const categories = useCategories();
  const hasCriteria = search !== '' || categoryId !== '';

  const params = { billing: 1, search, category_id: categoryId, per_page: 30 };
  const results = useQuery({
    queryKey: qk.services(params),
    queryFn: ({ signal }) => api.get<Paginated<Service>>('/services', params, { signal }),
    enabled: hasCriteria,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const settled = search === text.trim() && !results.isPlaceholderData && !results.isFetching;
  const items = hasCriteria ? (results.data?.items ?? []) : [];
  const showList = open && hasCriteria;

  function add(service: Service | undefined) {
    if (!service) return;
    pendingEnter.current = false;
    onAdd(service);
    setText('');
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  }

  // Enter typed faster than the debounce: add once the matching results arrive.
  useEffect(() => {
    if (!pendingEnter.current || !settled) return;
    pendingEnter.current = false;
    if (items.length > 0) add(items[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, items]);

  useEffect(() => {
    if (!showList) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, showList]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (items.length) setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (items.length) setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!hasCriteria && text.trim() === '') return;
      if (settled && showList) add(items[Math.min(active, items.length - 1)]);
      else {
        pendingEnter.current = true;
        setOpen(true);
      }
    } else if (e.key === 'Escape') {
      if (showList) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else if (text) {
        e.preventDefault();
        setText('');
      }
    }
  }

  const activeId = showList && items[active] ? `${id}-opt-${items[active].id}` : undefined;
  const count = results.data?.total ?? items.length;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <Field label="Agregar conceptos" labelAside={<Kbd className="h-4">F3</Kbd>}>
        <div className="relative">
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Buscar concepto"
            aria-keyshortcuts="F3"
            placeholder="Nombre o código"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={text}
            prefix={<Search />}
            suffix={results.isFetching && hasCriteria ? <Spinner className="mr-1.5 size-3.5" /> : <Kbd className="mr-1">Enter</Kbd>}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-10 pr-16 text-[15px]"
          />
          {showList && (
            <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-30 overflow-hidden rounded-[var(--radius-md)] border border-junta bg-field shadow-pop">
              <div className="flex items-center justify-between gap-3 border-b border-junta px-3 py-1.5 text-[12px] text-ink-2">
                <span>
                  {settled && items.length > 0
                    ? search
                      ? `${count} ${count === 1 ? 'resultado' : 'resultados'} para «${search}»`
                      : `${count} ${count === 1 ? 'concepto' : 'conceptos'} en la categoría`
                    : ' '}
                </span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  <Kbd>
                    <ArrowUp className="size-3" />
                  </Kbd>
                  <Kbd>
                    <ArrowDown className="size-3" />
                  </Kbd>
                  elegir ·<Kbd>Enter</Kbd>agregar
                </span>
              </div>
              <ul ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="max-h-[324px] overflow-y-auto">
                {items.length === 0 ? (
                  <li className="px-3 py-3 text-[13px] text-ink-2" role="presentation">
                    {settled ? (search ? `Sin resultados para «${search}».` : 'Sin conceptos en esta categoría.') : 'Buscando…'}
                  </li>
                ) : (
                  items.map((s, i) => {
                    const selected = i === active;
                    return (
                      <li
                        key={s.id}
                        id={`${id}-opt-${s.id}`}
                        data-index={i}
                        role="option"
                        aria-selected={selected}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => add(s)}
                        className={cn(
                          'grid h-9 cursor-pointer grid-cols-[minmax(0,1fr)_auto_112px_52px] items-center gap-3 border-b border-junta px-3 last:border-b-0',
                          selected ? 'bg-slate text-slate-ink' : 'text-ink hover:bg-surface-2',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[14px]">
                            <Highlight text={s.name} term={search} />
                          </span>
                          {s.special_rule_code === ERYTHROPOIETIN_RULE && (
                            <Badge tone="brand" shape="diamond" className={selected ? 'bg-slate-ink/15 text-slate-ink' : undefined}>
                              Receta de diálisis
                            </Badge>
                          )}
                        </span>
                        <span className={cn('truncate text-[13px]', selected ? 'text-slate-ink/80' : 'text-ink-2')}>
                          {s.category?.name ?? 'Sin categoría'}
                        </span>
                        <span className="num text-right text-[14px]">{formatCents(s.price_cents)}</span>
                        <span className="flex justify-end" aria-hidden="true">
                          {selected && <Kbd tone="slate">Enter</Kbd>}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      </Field>
      <Field label="Categoría">
        <Select
          placeholder="Todas las categorías"
          value={categoryId}
          disabled={disabled}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setActive(0);
          }}
          options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          className="h-10"
        />
      </Field>
    </div>
  );
}

/** Bolds the typed term inside the concept name (accent- and case-insensitive). */
function Highlight({ text, term }: { text: string; term: string }) {
  const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = fold(term.trim());
  if (!t) return <>{text}</>;
  const folded = fold(text);
  // NFD folding keeps one char per base letter only for precomposed input; bail out if lengths differ.
  if (folded.length !== text.length) return <>{text}</>;
  const at = folded.indexOf(t);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-bold text-inherit">{text.slice(at, at + t.length)}</mark>
      {text.slice(at + t.length)}
    </>
  );
}
