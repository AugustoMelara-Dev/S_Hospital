import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  CornerDownLeftIcon,
  FileTextIcon,
  LockIcon,
  LockOpenIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeSearchText } from '@/lib/normalizeText';
import { requestAdminFocus } from '@/hooks/useAdminFocusRequest';
import { useGuardedNavigation } from '@/hooks/useUnsavedChangesGuard';
import {
  adminAdministrationItems,
  adminPrimarySections,
  adminRoutePaths,
  canAccessAdminItem,
} from '@/navigation/adminNavigation';
import { useAdminSession } from './AdminSessionContext';
import { ADMIN_ICONS, SECTION_ICONS } from './adminIcons';

/**
 * Paleta de comandos "Panel administrativo" (Ctrl/Cmd+K).
 *
 * Reglas de diseño aplicadas (better-ui / emil-design-eng):
 *  - Es una acción de teclado de altísima frecuencia: **sin animación de
 *    entrada/salida**. Se monta y se desmonta de inmediato (Raycast, no modal).
 *  - El foco entra en la búsqueda al abrir y vuelve al disparador al cerrar.
 *  - Patrón combobox+listbox: el foco nunca sale del input; las flechas mueven
 *    `aria-activedescendant`, Enter abre, Escape cierra y Tab queda atrapado.
 *  - Las acciones se filtran por permisos con `useAdminSession().has(...)`:
 *    nada que el rol no pueda abrir aparece en la lista.
 *  - La búsqueda navega a Recibos con `?q=`/`?invoice_number=` (contrato de URL
 *    ya consumido por `useInvoiceHistoryQuery`); no se inventan endpoints.
 */

const COMMAND_PALETTE_OPEN_EVENT = 'admin:command-palette-open';

/** Abre la paleta desde cualquier punto del shell (p. ej. el disparador de la barra). */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
}

type PaletteGroup = 'Navegación' | 'Administración' | 'Acciones';

type PaletteAction = {
  id: string;
  label: string;
  group: PaletteGroup;
  hint: string;
  keywords: string;
  icon: ReactNode;
  run: () => void;
};

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

const iconClass = 'size-4 shrink-0 text-[color:var(--ui-ink-soft)]';

function paletteIcon(Icon: LucideIcon) {
  return <Icon aria-hidden="true" data-icon className={iconClass} />;
}

function looksLikeDocumentNumber(value: string): boolean {
  return /^[0-9][0-9-]*$/.test(value);
}

export function CommandPalette() {
  const navigate = useGuardedNavigation();
  const { has, permissions } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listboxId = `${baseId}-actions`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const close = useCallback(() => setOpen(false), []);

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];

    for (const section of adminPrimarySections) {
      if (!canAccessAdminItem(section, permissions)) continue;
      list.push({
        id: `nav-${section.id}`,
        label: `Ir a ${section.label}`,
        group: 'Navegación',
        hint: section.description,
        keywords: `${section.label} ${section.description}`,
        icon: paletteIcon(SECTION_ICONS[section.id] ?? FileTextIcon),
        run: () => navigate(section.path),
      });
    }

    for (const item of adminAdministrationItems) {
      if (!canAccessAdminItem(item, permissions)) continue;
      list.push({
        id: `admin-${item.id}`,
        label: item.label,
        group: 'Administración',
        hint: item.description,
        keywords: `${item.label} ${item.description} administracion`,
        icon: paletteIcon(ADMIN_ICONS[item.id] ?? FileTextIcon),
        run: () => navigate(item.path),
      });
    }

    const cobrar = adminPrimarySections.find((section) => section.id === 'cobrar');
    if (cobrar && canAccessAdminItem(cobrar, permissions)) {
      list.push({
        id: 'action-new-operation',
        label: 'Nueva operación',
        group: 'Acciones',
        hint: 'Abrir Cobrar con el foco en el nombre del paciente.',
        keywords: 'nueva operacion cobrar paciente factura cuenta',
        icon: <PlusIcon aria-hidden="true" data-icon className={iconClass} />,
        run: () => {
          requestAdminFocus('cobrar-patient-name');
          navigate(adminRoutePaths.cobrar);
        },
      });
    }

    if (has('invoices.view')) {
      list.push({
        id: 'action-search-operation',
        label: 'Buscar operación',
        group: 'Acciones',
        hint: 'Ir a Recibos con el foco en la búsqueda.',
        keywords: 'buscar operacion recibos paciente numero factura comprobante historial',
        icon: <SearchIcon aria-hidden="true" data-icon className={iconClass} />,
        run: () => {
          requestAdminFocus('recibos-query');
          navigate(adminRoutePaths.recibos);
        },
      });
    }

    const caja = adminPrimarySections.find((section) => section.id === 'caja');
    const canViewCash = Boolean(caja && canAccessAdminItem(caja, permissions));

    if (canViewCash && has('cash.open')) {
      list.push({
        id: 'action-open-cash',
        label: 'Abrir caja',
        group: 'Acciones',
        hint: 'Ir a Caja para iniciar el turno.',
        keywords: 'abrir caja turno apertura efectivo',
        icon: <LockOpenIcon aria-hidden="true" data-icon className={iconClass} />,
        run: () => navigate(adminRoutePaths.caja),
      });
    }

    if (canViewCash && (has('cash.close') || has('cash.close_any'))) {
      list.push({
        id: 'action-close-cash',
        label: 'Cerrar caja',
        group: 'Acciones',
        hint: 'Ir a Caja para cerrar y arquear el turno.',
        keywords: 'cerrar caja turno cierre arqueo conciliacion',
        icon: <LockIcon aria-hidden="true" data-icon className={iconClass} />,
        run: () => navigate(adminRoutePaths.caja),
      });
    }

    return list;
  }, [has, navigate, permissions]);

  const normalizedQuery = normalizeSearchText(query);

  const visibleActions = useMemo<PaletteAction[]>(() => {
    const matches = normalizedQuery
      ? actions.filter((action) =>
          normalizeSearchText(`${action.label} ${action.group} ${action.keywords}`).includes(normalizedQuery),
        )
      : actions;

    const trimmed = query.trim();
    if (!has('invoices.view') || trimmed.length < 2) return matches;

    const params = new URLSearchParams();
    if (looksLikeDocumentNumber(trimmed)) params.set('invoice_number', trimmed);
    else params.set('q', trimmed);

    return [
      ...matches,
      {
        id: 'action-search-term',
        label: `Buscar operación “${trimmed}”`,
        group: 'Acciones',
        hint: 'Abre Recibos con el término aplicado a paciente o número.',
        keywords: trimmed,
        icon: <SearchIcon aria-hidden="true" data-icon className={iconClass} />,
        run: () => {
          requestAdminFocus('recibos-query');
          navigate(`${adminRoutePaths.recibos}?${params.toString()}`);
        },
      },
    ];
  }, [actions, has, navigate, normalizedQuery, query]);

  const activeAction = visibleActions.length > 0
    ? visibleActions[Math.min(activeIndex, visibleActions.length - 1)]
    : undefined;
  const activeOptionId = activeAction ? optionId(visibleActions.indexOf(activeAction)) : undefined;

  // Alta frecuencia: al abrir no se anima nada; el input recibe el foco en el
  // siguiente frame (tras montar) y al cerrar se devuelve al disparador.
  useEffect(() => {
    if (open) {
      previouslyFocused.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }

    const target = previouslyFocused.current;
    previouslyFocused.current = null;
    if (target && target.isConnected) target.focus();
    return undefined;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [open, normalizedQuery]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    function handleOpenRequest() {
      setOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenRequest);
    };
  }, []);

  const runAction = useCallback(
    (action: PaletteAction) => {
      close();
      action.run();
    },
    [close],
  );

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (visibleActions.length === 0 ? 0 : (current + 1) % visibleActions.length));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        visibleActions.length === 0 ? 0 : (current - 1 + visibleActions.length) % visibleActions.length,
      );
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, visibleActions.length - 1));
      return;
    }

    if (event.key === 'Enter' && activeAction) {
      event.preventDefault();
      runAction(activeAction);
    }
  }

  // Escape cierra desde cualquier foco interno y Tab queda atrapado entre los
  // controles del panel. Se escucha en `window` para no declarar interacción
  // sobre el contenedor `role="dialog"` (evita warnings jsx-a11y).
  useEffect(() => {
    if (!open) return;

    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [close, open]);

  if (!open) return null;

  return (
    <div
      data-ui-command-palette="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--ui-scrim)] px-4 pt-[10vh]"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar la paleta al hacer clic fuera"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="ui-portal ui-portal-surface relative flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--ui-radius-overlay)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--ui-line)] px-3">
          <SearchIcon
            aria-hidden="true"
            data-icon
            className="size-4 shrink-0 text-[color:var(--ui-ink-soft)]"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={visibleActions.length > 0}
            aria-controls={visibleActions.length > 0 ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="Buscar acciones y operaciones"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Escriba una acción o el paciente / número de operación"
            className="h-11 min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-md)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-soft)]"
          />
          <button
            type="button"
            data-ui-press
            aria-label="Cerrar paleta de comandos"
            onClick={close}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--ui-radius)] text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)]',
              focusRing,
            )}
          >
            <XIcon aria-hidden="true" data-icon className="size-4" />
          </button>
        </div>

        {visibleActions.length === 0 ? (
          <p
            role="status"
            className="px-3 py-6 text-center text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
          >
            Sin acciones para “{query.trim()}”.
          </p>
        ) : (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Acciones disponibles"
            className="max-h-80 overflow-y-auto p-1.5"
          >
            {visibleActions.map((action, index) => {
              const selected = action.id === activeAction?.id;

              return (
                <li
                  key={action.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runAction(action)}
                  onKeyDown={(event) => {
                    // Las opciones no reciben foco (el foco vive en el input y
                    // `aria-activedescendant` marca la activa); el manejador
                    // existe para satisfacer la interacción accesible del clic.
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      runAction(action);
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-[var(--ui-radius-control)] px-2.5 py-2 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)]',
                    selected && 'bg-[var(--ui-surface-alt)]',
                  )}
                >
                  {action.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{action.label}</span>
                    <span className="block truncate text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                      {action.hint}
                    </span>
                  </span>
                  <span className="shrink-0 text-[length:var(--ui-text-xs)] uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)]">
                    {action.group}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--ui-line)] px-3 py-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>
              <CornerDownLeftIcon aria-hidden="true" data-icon className="size-3" />
            </Kbd>
            abrir
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Esc</Kbd> cerrar
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-1 font-[family-name:var(--ui-font-sans)] text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink)]">
      {children}
    </kbd>
  );
}
