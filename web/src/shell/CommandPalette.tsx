import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CornerDownLeft, Plus, Search, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/app/nav';
import { usePermissions } from '@/auth/hooks';
import { Kbd } from '@/ui/Kbd';
import { ModalLayer } from '@/ui/ModalLayer';
import type { Permission } from '@/api/types';

type Command = {
  id: string;
  group: 'Acciones' | 'Ir a' | 'Buscar';
  label: string;
  hint?: ReactNode;
  icon: ReactNode;
  keywords?: string;
  perms?: Permission[];
  run: () => void;
};

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Ctrl+K palette. Deliberately not animated: it opens dozens of times a day. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setActive(0);
    }
  }

  const go = (to: string, state?: unknown) => {
    onClose();
    navigate(to, state ? { state } : undefined);
  };

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: 'new-op',
        group: 'Acciones',
        label: 'Nueva operación',
        hint: <Kbd>F2</Kbd>,
        icon: <Plus />,
        keywords: 'cobrar factura nueva venta paciente',
        perms: ['invoices.create'],
        run: () => go('/cobrar', { focus: 'patient', at: Date.now() }),
      },
      {
        id: 'open-cash',
        group: 'Acciones',
        label: 'Abrir caja',
        icon: <Wallet />,
        keywords: 'apertura turno caja',
        perms: ['cash.open'],
        run: () => go('/caja'),
      },
      ...NAV_ITEMS.map<Command>((n) => ({
        id: `nav-${n.to}`,
        group: 'Ir a',
        label: n.label,
        icon: <n.icon />,
        keywords: n.keywords,
        perms: n.perms,
        run: () => go(n.to),
      })),
    ];
    return base.filter((c) => !c.perms || can(c.perms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);

  const results = useMemo(() => {
    const q = normalize(query);
    const list = q
      ? commands.filter((c) => normalize(`${c.label} ${c.keywords ?? ''}`).includes(q))
      : commands;
    if (q && can('invoices.view')) {
      const term = query.trim();
      list.push({
        id: 'search-invoice',
        group: 'Buscar',
        label: `Buscar recibo «${term}»`,
        icon: <Search />,
        run: () => go(`/recibos?search=${encodeURIComponent(term)}`),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, query, can]);

  const clamped = Math.min(active, Math.max(0, results.length - 1));

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((clamped + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((clamped - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[clamped]?.run();
    }
  }

  const groups: Array<Command['group']> = ['Buscar', 'Acciones', 'Ir a'];
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <ModalLayer
      open={open}
      onClose={onClose}
      instant
      initialFocusRef={inputRef}
      containerClassName="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
    >
      {(panelRef) => (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
          className="relative w-full max-w-[600px] overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface shadow-pop"
        >
          <div className="flex items-center gap-2.5 border-b border-junta bg-field px-4">
            <Search className="size-4 shrink-0 text-ink-2" strokeWidth={1.6} aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? optionId(clamped) : undefined}
              aria-label="Buscar secciones, acciones o recibos"
              placeholder="Buscar secciones, acciones o un recibo por paciente o número…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto pb-1">
            {results.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-2">Sin coincidencias.</p>}
            {groups.map((g) => {
              const inGroup = results.map((c, i) => ({ c, i })).filter(({ c }) => c.group === g);
              if (inGroup.length === 0) return null;
              return (
                <div key={g} role="group" aria-label={g} className="border-t border-junta first:border-t-0">
                  <div className="border-b border-junta bg-ground px-4 py-1.5 text-[12px] leading-4 font-semibold text-ink-2">{g}</div>
                  {inGroup.map(({ c, i }) => (
                    <div
                      key={c.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === clamped}
                      onMouseMove={() => setActive(i)}
                      onClick={() => c.run()}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-3 border-b border-junta px-4 text-[14px] font-medium last:border-b-0 [&_svg]:size-4 [&_svg]:stroke-[1.6]',
                        i === clamped ? 'bg-slate text-slate-ink [&_svg]:text-slate-ink' : 'text-ink [&_svg]:text-ink-2',
                      )}
                    >
                      {c.icon}
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.hint && <span className={cn('contents', i === clamped && '[&_kbd]:border-slate-ink/50 [&_kbd]:bg-transparent [&_kbd]:text-slate-ink')}>{c.hint}</span>}
                      {i === clamped && <CornerDownLeft className="size-3.5" aria-hidden="true" />}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ModalLayer>
  );
}
