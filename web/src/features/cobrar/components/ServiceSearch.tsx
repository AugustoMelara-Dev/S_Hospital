import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <Field label="Agregar conceptos" hideLabel>
          <div className="relative">
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label="Buscar concepto"
              placeholder="Nombre o código"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={text}
              prefix={<Search />}
              suffix={results.isFetching && hasCriteria ? <Spinner className="mr-1.5 size-3.5" /> : <Kbd className="mr-1">↵</Kbd>}
              onChange={(e) => {
                setText(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              className="h-10"
            />
            {showList && (
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label="Resultados"
                className="absolute top-[calc(100%+4px)] right-0 left-0 z-30 max-h-[340px] overflow-y-auto rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-3"
              >
                {items.length === 0 ? (
                  <li className="px-3 py-3 text-[13px] text-ink-3" role="presentation">
                    {settled ? (search ? `Sin resultados para “${search}”.` : 'Sin conceptos en esta categoría.') : 'Buscando…'}
                  </li>
                ) : (
                  items.map((s, i) => (
                    <li
                      key={s.id}
                      id={`${id}-opt-${s.id}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => add(s)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-[6px] px-2.5 py-2',
                        i === active ? 'bg-brand-soft/70' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13.5px] font-medium text-ink">{s.name}</span>
                        <span className="truncate text-[12px] text-ink-3">{s.category?.name ?? 'Sin categoría'}</span>
                      </span>
                      {s.special_rule_code === ERYTHROPOIETIN_RULE && <Badge tone="brand">Receta de diálisis</Badge>}
                      <span className="num shrink-0 text-[13.5px] text-ink">{formatCents(s.price_cents)}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </Field>
        <Field label="Categoría" hideLabel>
          <Select
            aria-label="Categoría"
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
    </div>
  );
}
