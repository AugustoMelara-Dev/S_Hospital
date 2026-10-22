import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { formatLempirasUIFromCents, formatQuantityUnits } from '@/lib/moneyCents';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Componentes del sistema de diseño "Panel administrativo" (namespace admin).
 *
 * La apariencia la define `frontend/src/design-system/admin/tokens.css`.
 * `AdminTabs` implementa el tablist con ARIA explícito (role=tablist/tab,
 * roving tabIndex y flechas/Home/End); sólo conserva el contenedor de Radix
 * cuando un consumidor aporta `Tabs.Content`, para no dejar `aria-controls`
 * colgantes. TypeScript estricto, props tipadas y controles semánticos con
 * label/rol.
 */

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

type AdminTone = 'default' | 'success' | 'warn' | 'danger';

const TONE_TEXT: Record<AdminTone, string> = {
  default: 'text-[color:var(--ui-ink)]',
  success: 'text-[color:var(--ui-success)]',
  warn: 'text-[color:var(--ui-warn)]',
  danger: 'text-[color:var(--ui-danger)]',
};

/* -------------------------------------------------------------------------- */
/* Superficies                                                                */
/* -------------------------------------------------------------------------- */

export type AdminPanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'article' | 'aside';
};

export function AdminPanel({ as = 'section', className, ...props }: AdminPanelProps) {
  const Comp: ElementType = as;

  return (
    <Comp
      className={cn(
        'rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)]',
        className,
      )}
      {...props}
    />
  );
}

export type AdminPanelHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  id?: string;
  className?: string;
};

export function AdminPanelHeader({
  actions,
  className,
  description,
  headingLevel = 2,
  id,
  title,
}: AdminPanelHeaderProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';

  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ui-line)] px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <Heading
          id={id}
          className="text-[length:var(--ui-text-lg)] font-semibold leading-tight text-[color:var(--ui-ink)]"
        >
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{description}</p>
        ) : null}
      </div>
      {/*
       * `max-w-full` + `flex-wrap`: sin ellas el bloque de acciones era
       * inamovible (`shrink-0`) y su ancho máximo (487–488 px: chip de recuento
       * + «Nueva categoría» + «Nuevo servicio») arrastraba al documento entero
       * a `scrollWidth 520/521` frente a `clientWidth 390` (reflujo WCAG 1.4.10
       * medido en `/administracion/catalogo`). Ahora el bloque se limita al
       * ancho disponible y sus hijos se reparten en varias líneas sin recortar
       * cifras ni reducir tipografía; en pantallas donde cabe (≥640 px) el
       * resultado es idéntico al anterior.
       */}
      {actions ? (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Métricas y campos                                                          */
/* -------------------------------------------------------------------------- */

export type AdminMetricProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: AdminTone;
  className?: string;
};

export function AdminMetric({ className, hint, label, tone = 'default', value }: AdminMetricProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{label}</p>
      <p
        className={cn(
          'mt-1 text-[length:var(--ui-text-metric)] font-semibold leading-none tabular-nums',
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export type AdminFieldProps = {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function AdminField({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
  required = false,
}: AdminFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[color:var(--ui-danger)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dinero y cantidades (centavos, nunca float)                                */
/* -------------------------------------------------------------------------- */

export type MoneyTextProps = {
  cents: number | null | undefined;
  fallback?: string;
  emphasis?: 'normal' | 'strong' | 'total';
  as?: 'span' | 'p' | 'div';
  className?: string;
};

export function MoneyText({
  as = 'span',
  cents,
  className,
  emphasis = 'normal',
  fallback = 'No disponible',
}: MoneyTextProps) {
  const Comp: ElementType = as;
  const formatted = formatLempirasUIFromCents(cents);
  const emphasisClass =
    emphasis === 'total'
      ? 'text-[length:var(--ui-text-xl)] font-semibold'
      : emphasis === 'strong'
        ? 'font-semibold'
        : '';

  return (
    <Comp
      data-ui-money="true"
      className={cn(
        // `whitespace-nowrap`: el símbolo y el monto son una sola cifra. Sin
        // esto, una columna estrecha parte «L» y «1,000.00» en dos líneas
        // (V07: «importes partidos»). La columna debe desplazar o ensancharse,
        // nunca trocear el número.
        'inline-block whitespace-nowrap text-right tabular-nums',
        emphasisClass,
        formatted === null && 'text-[color:var(--ui-ink-soft)]',
        className,
      )}
    >
      {formatted ?? fallback}
    </Comp>
  );
}

export type QuantityTextProps = {
  units: number | null | undefined;
  fractionDigits?: number;
  fallback?: string;
  className?: string;
};

export function QuantityText({
  className,
  fallback = '—',
  fractionDigits = 2,
  units,
}: QuantityTextProps) {
  const formatted = formatQuantityUnits(units, fractionDigits);

  return (
    <span
      data-ui-quantity="true"
      className={cn(
        'inline-block min-w-8 text-center tabular-nums',
        formatted === '' && 'text-[color:var(--ui-ink-soft)]',
        className,
      )}
    >
      {formatted === '' ? fallback : formatted}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Estados                                                                    */
/* -------------------------------------------------------------------------- */

export type AdminSpinnerProps = {
  className?: string;
};

/**
 * Indicador de progreso del lenguaje admin.
 *
 * Es decorativo (`aria-hidden`): el estado accesible lo aporta el texto que lo
 * acompaña ("Validando credenciales", "Actualizando credenciales…") dentro del
 * mismo botón o zona con `aria-live`, de modo que no se anuncia dos veces.
 */
export function AdminSpinner({ className }: AdminSpinnerProps) {
  return (
    <Loader2Icon
      aria-hidden="true"
      data-icon
      className={cn('size-4 shrink-0 animate-spin', className)}
    />
  );
}

export type AdminStatus = 'borrador' | 'valorada' | 'listo' | 'cobrado' | 'gratuito' | 'anulado';

const STATUS_META: Record<AdminStatus, { label: string; className: string }> = {
  borrador: {
    label: 'Borrador',
    className: 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]',
  },
  valorada: {
    label: 'Valorada',
    className: 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink)]',
  },
  listo: {
    label: 'Listo para cobrar',
    className:
      'border-[var(--ui-action-subtle-strong)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]',
  },
  cobrado: {
    label: 'Cobrado',
    className: 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
  },
  gratuito: {
    label: 'Emitida sin cobro',
    className: 'border-[var(--ui-line)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]',
  },
  anulado: {
    label: 'Anulado',
    className: 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]',
  },
};

export type StatusStampProps = {
  status: AdminStatus;
  label?: ReactNode;
  className?: string;
};

export function StatusStamp({ className, label, status }: StatusStampProps) {
  const meta = STATUS_META[status];

  return (
    <span
      data-ui-status={status}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium',
        meta.className,
        className,
      )}
    >
      {label ?? meta.label}
    </span>
  );
}

export type FreeMedicationBadgeProps = {
  label?: ReactNode;
  className?: string;
};

export function FreeMedicationBadge({
  className,
  label = 'Gratuidad · solo el medicamento',
}: FreeMedicationBadgeProps) {
  return (
    <span
      data-ui-free-badge="true"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]',
        className,
      )}
    >
      <span aria-hidden="true">◆</span>
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Pestañas y búsqueda                                                        */
/* -------------------------------------------------------------------------- */

export type AdminTabItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
};

export type AdminTabsProps = {
  items: AdminTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  children?: ReactNode;
};

const adminTabClassName = cn(
  '-mb-px border-b-2 border-transparent px-0.5 pb-2 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink-soft)]',
  'transition-[color,border-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:text-[color:var(--ui-ink)] disabled:opacity-50',
  'data-[state=active]:border-[var(--ui-action)] data-[state=active]:font-semibold data-[state=active]:text-[color:var(--ui-ink)]',
  focusRing,
);

const TAB_NAV_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'] as const;

/**
 * `Tabs.Content` de Radix sólo es válido dentro de un `Tabs.Root`. Las pantallas
 * de configuración (Ajustes, Configuración fiscal, Recibos institucionales) lo
 * consumen a través de `AdminTabs`, así que detectarlo permite conservar el
 * cableado `aria-controls`/`aria-labelledby` que ya resuelve Radix. Cuando no
 * hay paneles Radix (p. ej. Caja, que dibuja sus paneles fuera del componente),
 * se usa el tablist propio sin atributos colgantes.
 */
function containsTabsContent(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean') return false;

  return Children.toArray(node).some((child) => {
    if (!isValidElement(child)) return false;
    if (child.type === TabsPrimitive.Content) return true;
    if (child.type === Fragment) {
      return containsTabsContent((child.props as { children?: ReactNode }).children);
    }
    return false;
  });
}

type AdminTabListProps = {
  ariaLabel: string;
  className?: string;
  items: AdminTabItem[];
  onValueChange: (value: string) => void;
  /** Sólo se aporta cuando existe un panel al que apuntar (evita `aria-controls` colgante). */
  panelId?: (id: string) => string;
  tabId: (id: string) => string;
  value: string;
};

function AdminTabList({
  ariaLabel,
  className,
  items,
  onValueChange,
  panelId,
  tabId,
  value,
}: AdminTabListProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledItems = items.filter((item) => !item.disabled);
  const hasFocusableSelection = enabledItems.some((item) => item.id === value);
  const firstEnabledId = enabledItems[0]?.id;

  function focusAndSelect(id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    buttonsRef.current[index]?.focus();
    onValueChange(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key === ' ' || event.key === 'Enter') {
      // Enter/Espacio activan la pestaña; se evita el clic nativo duplicado.
      event.preventDefault();
      onValueChange(id);
      return;
    }

    if (!(TAB_NAV_KEYS as readonly string[]).includes(event.key)) return;
    // Las flechas/Home/End mueven la selección; el scroll de la página no debe moverse.
    event.preventDefault();

    const currentIndex = enabledItems.findIndex((item) => item.id === id);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % enabledItems.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = enabledItems.length - 1;
    }

    const next = enabledItems[nextIndex];
    if (next && next.id !== id) focusAndSelect(next.id);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn('flex flex-wrap gap-4 border-b border-[var(--ui-line)]', className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        // Roving tabIndex: el activo entra en el orden de tabulación; el resto se
        // alcanza con flechas. Si el valor activo no está disponible, el primer
        // elemento habilitado queda como punto de entrada.
        const focusable = selected || (!hasFocusableSelection && item.id === firstEnabledId);

        return (
          <button
            key={item.id}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabId(item.id)}
            aria-selected={selected}
            aria-controls={selected && panelId ? panelId(item.id) : undefined}
            data-state={selected ? 'active' : 'inactive'}
            disabled={item.disabled}
            tabIndex={focusable ? 0 : -1}
            onMouseDown={(event) => {
              // Paridad con Radix `Tabs.Trigger`: la pestaña se activa al
              // presionar (no al soltar), que es lo que ya consumen las vistas
              // de caja/configuración.
              if (item.disabled) return;
              if (event.button === 0 && event.ctrlKey === false) {
                onValueChange(item.id);
              } else {
                event.preventDefault();
              }
            }}
            onClick={(event) => {
              // Un clic de ratón ya se resolvió en `mousedown` (detail >= 1);
              // los clics sintéticos de teclado/lector de pantalla (detail 0)
              // se atienden aquí.
              if (event.detail === 0) onValueChange(item.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, item.id)}
            className={adminTabClassName}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminTabs({
  ariaLabel,
  children,
  className,
  items,
  onValueChange,
  value,
}: AdminTabsProps) {
  const baseId = useId();
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  if (containsTabsContent(children)) {
    return (
      <TabsPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        className={cn('flex flex-col gap-3', className)}
      >
        <TabsPrimitive.List
          aria-label={ariaLabel}
          className="flex flex-wrap gap-4 border-b border-[var(--ui-line)]"
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.id}
              value={item.id}
              disabled={item.disabled}
              // Roving tabindex explícito: la pestaña seleccionada entra en el
              // orden de tabulación y el resto se alcanza con flechas. Sin esto,
              // Radix deja **todas** las pestañas en `tabindex="-1"` y el grupo
              // queda inalcanzable por teclado (WCAG 2.1.1). Medido en
              // `AdministracionView.test.tsx`.
              tabIndex={item.id === value ? 0 : -1}
              className={adminTabClassName}
            >
              {item.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {children}
      </TabsPrimitive.Root>
    );
  }

  const hasPanel = Children.count(children) > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <AdminTabList
        ariaLabel={ariaLabel}
        items={items}
        onValueChange={onValueChange}
        panelId={hasPanel ? panelId : undefined}
        tabId={tabId}
        value={value}
      />
      {hasPanel ? (
        <div
          role="tabpanel"
          id={panelId(value)}
          aria-labelledby={tabId(value)}
          tabIndex={0}
          className={focusRing}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type AdminSearchProps = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  submitLabel?: string;
  /** Nombre accesible del submit cuando la etiqueta visible es genérica. */
  submitAriaLabel?: string;
  className?: string;
};

export function AdminSearch({
  className,
  id,
  label,
  onSubmit,
  onValueChange,
  placeholder,
  submitAriaLabel,
  submitLabel = 'Buscar',
  value,
}: AdminSearchProps) {
  return (
    <form
      role="search"
      className={cn('flex items-end gap-2', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
        >
          {label}
        </label>
        <div
          data-ui-focus-frame
          className={cn(
            'flex items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-2.5',
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ui-focus)]',
          )}
        >
          <SearchIcon aria-hidden="true" data-icon className="size-4 shrink-0 text-[color:var(--ui-ink-soft)]" />
          <input
            id={id}
            type="search"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-[var(--ui-control-h)] min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none placeholder:text-[color:var(--ui-ink-soft)]"
          />
        </div>
      </div>
      {onSubmit ? (
        <button
          type="submit"
          data-ui-press
          aria-label={submitAriaLabel}
          className={cn(
            'h-[var(--ui-control-h)] shrink-0 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] hover:bg-[var(--ui-action-hover)]',
            focusRing,
          )}
        >
          {submitLabel}
        </button>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabla densa                                                                */
/* -------------------------------------------------------------------------- */

type AdminAlign = 'left' | 'right' | 'center';

function alignClass(align: AdminAlign | undefined) {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

export type AdminSortDirection = 'asc' | 'desc';

export type AdminSortState = {
  key: string;
  direction: AdminSortDirection;
};

export type AdminColumn<T> = {
  key: string;
  header: ReactNode;
  align?: AdminAlign;
  className?: string;
  cell: (row: T, index: number) => ReactNode;
  /**
   * Convierte el encabezado en un botón de ordenación. La tabla expone el
   * estado por `aria-sort`; no cambia el orden si el consumidor controla
   * `sort`/`onSortChange`.
   */
  sortable?: boolean;
  /**
   * Valor comparable para ordenar en modo no controlado. Sin `sortValue`, la
   * columna se puede anunciar como ordenable pero la tabla no la ordena.
   */
  sortValue?: (row: T) => string | number | null | undefined;
  /**
   * Sólo aplica a la tarjeta móvil (`< md`): la columna se omite de la tarjeta
   * pero permanece en la tabla de `md+`. Úselo para códigos internos o datos
   * derivados que saturan la tarjeta sin aportar en la lectura rápida.
   */
  mobileHidden?: boolean;
  /**
   * Sólo aplica a la tarjeta móvil (`< md`): la columna encabeza la tarjeta con
   * mayor peso tipográfico. Use una o dos por tabla: la identidad de la fila y,
   * si existe, el importe principal.
   */
  mobilePrimary?: boolean;
};

export type AdminTableProps<T> = {
  columns: AdminColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  caption?: string;
  /**
   * Estado vacío contextual y accionable de la tabla. Se recomienda pasar un
   * `AdminEmpty` con `description` y, cuando la superficie lo permita, un
   * `action` (CTA a la siguiente tarea). Si se omite, la tabla NO usa un
   * "Sin registros." genérico: deriva del `caption` un vacío contextual con
   * una indicación accionable.
   */
  empty?: ReactNode;
  className?: string;
  /** Presente ⇒ la fila es un control: focusable y activable con Enter/Espacio. */
  onRowClick?: (row: T) => void;
  /** Nombre accesible opcional de la fila activable (si se omite, lo da su contenido). */
  rowAriaLabel?: (row: T, index: number) => string;
  rowClassName?: (row: T) => string | undefined;
  /** Estado de ordenación controlado. `undefined` deja la tabla sin controlar. */
  sort?: AdminSortState | null;
  /** Notifica cada cambio: nueva columna `asc`, misma columna `desc`, tercera vez sin orden. */
  onSortChange?: (sort: AdminSortState | null) => void;
  /** Orden inicial cuando la tabla no es controlada. */
  defaultSort?: AdminSortState | null;
  /**
   * En `< md` renderiza una lista de tarjetas etiqueta/valor en lugar de la
   * tabla con scroll horizontal. Por defecto `true`; pase `false` en las
   * superficies que ya aportan su propia lista móvil o que deben conservar la
   * tabla estrecha (p. ej. las zonas de Cobrar).
   */
  mobileCards?: boolean;
  /**
   * Ancho mínimo de la tabla (p. ej. `'60rem'`). Evita que una tabla ancha
   * comprima sus columnas hasta partir texto o recortar cifras: por debajo del
   * mínimo, el contenedor desplaza horizontalmente. Se aplica como estilo
   * inline, no como utilidad arbitraria.
   */
  minTableWidth?: string;
};

function compareSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): number {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';

  // Un dato ausente va al final en ascendente (y al principio al invertir):
  // nunca debe leerse como "el valor más pequeño".
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  if (typeof left === 'number' && typeof right === 'number') return left - right;

  return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' });
}

function nextAdminSort(current: AdminSortState | null, key: string): AdminSortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

function SortIndicator({ direction }: { direction: AdminSortDirection | null }) {
  if (direction === 'asc') {
    return <ArrowUpIcon aria-hidden="true" data-icon className="size-3.5 shrink-0" />;
  }
  if (direction === 'desc') {
    return <ArrowDownIcon aria-hidden="true" data-icon className="size-3.5 shrink-0" />;
  }
  return <ArrowUpDownIcon aria-hidden="true" data-icon className="size-3.5 shrink-0 opacity-40" />;
}

export function AdminTable<T>({
  caption,
  className,
  columns,
  defaultSort = null,
  empty,
  getRowKey,
  minTableWidth,
  mobileCards = true,
  onRowClick,
  onSortChange,
  rowAriaLabel,
  rowClassName,
  rows,
  sort,
}: AdminTableProps<T>) {
  const [uncontrolledSort, setUncontrolledSort] = useState<AdminSortState | null>(defaultSort);
  const isControlled = sort !== undefined;
  const activeSort = isControlled ? (sort ?? null) : uncontrolledSort;
  const activeSortColumn = activeSort
    ? columns.find((column) => column.key === activeSort.key && column.sortValue)
    : undefined;
  const displayRows =
    !isControlled && activeSort && activeSortColumn
      ? [...rows].sort((left, right) => {
          const result = compareSortValues(
            activeSortColumn.sortValue?.(left),
            activeSortColumn.sortValue?.(right),
          );
          return activeSort.direction === 'asc' ? result : -result;
        })
      : rows;

  function handleSortChange(key: string) {
    const next = nextAdminSort(activeSort, key);
    if (!isControlled) setUncontrolledSort(next);
    onSortChange?.(next);
  }

  // `md` = 768 px. Bajo ese ancho la fila se convierte en tarjeta cuando el
  // consumidor no la desactiva; en `md+` se conserva la tabla actual, con su
  // ordenamiento, sin cambios. En móvil no se duplican los controles de orden:
  // las tarjetas leen `displayRows`, que ya sale ordenado.
  const isBelowMd = useMediaQuery('(max-width: 767px)');
  const emptyContent = empty ?? (
    <div className="mx-auto flex max-w-prose flex-col items-center gap-1">
      <p className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">
        {caption ? `Sin ${caption.toLocaleLowerCase('es')}` : 'Sin resultados'}
      </p>
      <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Ajuste la búsqueda o los filtros; si esperaba un registro, créelo desde su sección.
      </p>
    </div>
  );

  if (mobileCards && isBelowMd) {
    return (
      <AdminMobileCards
        caption={caption}
        className={className}
        columns={columns}
        emptyContent={emptyContent}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        rowAriaLabel={rowAriaLabel}
        rowClassName={rowClassName}
        rows={displayRows}
      />
    );
  }

  return (
    <div
      // Contenedor desplazable: `tabIndex=0` lo hace alcanzable por teclado
      // (axe `scrollable-region-focusable`) y `role="group"` + `aria-label`
      // le dan nombre accesible cuando la tabla declara `caption`.
      //
      // No se usa `role="region"`: varias vistas ya envuelven la tabla en un
      // `role="region"` con el mismo nombre que el caption (p. ej. Resumen
      // "Operaciones recientes" o el historial de respaldos), y un landmark
      // anidado con igual rol+nombre dispara `landmark-unique` (moderate). El
      // grupo aporta el nombre accesible sin duplicar landmarks; sin caption no
      // se declara grupo (un nombre vacío no aporta nada).
      {...(caption ? { role: 'group' as const, 'aria-label': caption } : {})}
      tabIndex={0}
      className={cn(
        // Radio de control (6): la tabla es una superficie densa; al anidarse en
        // un AdminPanel (8) la diferencia de 2 px se acerca a la concentricidad
        // que exige la escala fija 6/8/10.
        'overflow-auto rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]',
        className,
      )}
    >
      <table className="w-full border-collapse text-[length:var(--ui-text-base)]" style={minTableWidth ? { minWidth: minTableWidth } : undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-10 bg-[var(--ui-surface-alt)]">
          <tr>
            {columns.map((column) => {
              // En modo controlado el orden lo resuelve el consumidor; el
              // encabezado sólo es un control si existe `onSortChange`.
              const sortable =
                Boolean(column.sortable) && (isControlled ? Boolean(onSortChange) : true);
              const sorted = activeSort?.key === column.key;
              const ariaSort = sorted
                ? activeSort?.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none';

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortable ? ariaSort : undefined}
                  className={cn(
                    'border-b border-[var(--ui-line)] px-3 py-2 text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)]',
                    alignClass(column.align),
                    column.className,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      data-ui-press
                      onClick={() => handleSortChange(column.key)}
                      className={cn(
                        'inline-flex w-full items-center gap-1 text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)] hover:text-[color:var(--ui-ink)]',
                        column.align === 'right' && 'justify-end',
                        column.align === 'center' && 'justify-center',
                        focusRing,
                      )}
                    >
                      <span>{column.header}</span>
                      <SortIndicator direction={sorted ? (activeSort?.direction ?? null) : null} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-[color:var(--ui-ink-soft)]"
              >
                {emptyContent}
              </td>
            </tr>
          ) : (
            displayRows.map((row, index) => {
              const activatable = Boolean(onRowClick);
              const accessibleName = activatable ? rowAriaLabel?.(row, index) : undefined;

              function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
                if (!onRowClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  // Espacio no debe desplazar la página al activar la fila.
                  event.preventDefault();
                  onRowClick(row);
                }
              }

              return (
                <tr
                  key={getRowKey(row, index)}
                  onClick={activatable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={activatable ? handleRowKeyDown : undefined}
                  tabIndex={activatable ? 0 : undefined}
                  aria-label={accessibleName}
                  className={cn(
                    'h-[var(--ui-row-h)] border-b border-[var(--ui-line)] last:border-b-0',
                    activatable &&
                      'cursor-pointer transition-[background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] focus-visible:bg-[var(--ui-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-3 py-1.5 align-middle', alignClass(column.align), column.className)}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

type AdminMobileCardsProps<T> = {
  caption?: string;
  className?: string;
  columns: AdminColumn<T>[];
  emptyContent: ReactNode;
  getRowKey: (row: T, index: number) => string;
  rows: T[];
  onRowClick?: (row: T) => void;
  rowAriaLabel?: (row: T, index: number) => string;
  rowClassName?: (row: T) => string | undefined;
};

/**
 * Modo tarjeta móvil de `AdminTable` (`< md`): una tarjeta por fila con las
 * columnas como pares `dt`/`dd`. `mobilePrimary` encabeza la tarjeta con más
 * peso; `mobileHidden` se omite. Reutiliza la misma `cell`/`align`/`className`
 * y el mismo vacío que la tabla, así que la información no se duplica ni se
 * reescribe por superficie. Cuando la tabla declara `onRowClick`, la tarjeta
 * hereda el contrato de fila: focusable y activable con Enter/Espacio.
 */
function AdminMobileCards<T>({
  caption,
  className,
  columns,
  emptyContent,
  getRowKey,
  onRowClick,
  rowAriaLabel,
  rowClassName,
  rows,
}: AdminMobileCardsProps<T>) {
  const visibleColumns = columns.filter((column) => !column.mobileHidden);
  // Las columnas `mobilePrimary` encabezan la tarjeta y el resto son pares de
  // detalle. Cada par `dt`/`dd` se agrupa en un único `<div>` hijo directo del
  // `<dl>`: un solo nivel de agrupación es el patrón que valida axe (`dlitem`).
  const orderedColumns = [
    ...visibleColumns.filter((column) => column.mobilePrimary),
    ...visibleColumns.filter((column) => !column.mobilePrimary),
  ];
  const wrapperClassName = cn(
    'rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface)]',
    className,
  );

  if (rows.length === 0) {
    return (
      <div className={cn(wrapperClassName, 'px-4 py-8 text-center text-[color:var(--ui-ink-soft)]')}>
        {emptyContent}
      </div>
    );
  }

  return (
    <ul
      {...(caption ? { 'aria-label': caption } : {})}
      className={cn(wrapperClassName, 'divide-y divide-[var(--ui-line)] overflow-hidden')}
    >
      {rows.map((row, index) => {
        const activatable = Boolean(onRowClick);
        const accessibleName = activatable ? rowAriaLabel?.(row, index) : undefined;
        const cardBody = (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {orderedColumns.map((column) => {
              const primary = Boolean(column.mobilePrimary);

              return (
                <div key={column.key} className="min-w-0">
                  <dt
                    className={cn(
                      'text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]',
                      primary && 'font-medium uppercase tracking-[0.06em]',
                    )}
                  >
                    {column.header}
                  </dt>
                  <dd
                    className={cn(
                      '[overflow-wrap:anywhere]',
                      primary
                        ? 'mt-0.5 text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]'
                        : 'text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]',
                      alignClass(column.align),
                      column.className,
                    )}
                  >
                    {column.cell(row, index)}
                  </dd>
                </div>
              );
            })}
          </dl>
        );
        const cardBaseClassName = 'flex flex-col gap-3 p-4';
        const activatableClassName =
          'cursor-pointer transition-[background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] focus-visible:bg-[var(--ui-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

        function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
          if (event.key === 'Enter' || event.key === ' ') {
            // Espacio no debe desplazar la página al activar la tarjeta.
            event.preventDefault();
            onRowClick?.(row);
          }
        }

        return (
          <li key={getRowKey(row, index)} className={rowClassName?.(row)}>
            {activatable ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={accessibleName}
                onClick={() => onRowClick?.(row)}
                onKeyDown={handleCardKeyDown}
                className={cn(cardBaseClassName, activatableClassName)}
              >
                {cardBody}
              </div>
            ) : (
              <div className={cardBaseClassName}>{cardBody}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Vacíos, avisos y pasos                                                     */
/* -------------------------------------------------------------------------- */

export type AdminEmptyProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Renderiza el título como encabezado real de ese nivel en lugar de como
   * párrafo. Sólo se pasa donde el título **es** el encabezado de la página
   * (la 404 interna, que no tiene ningún otro H1 y fallaba `page-has-heading-one`);
   * el resto de consumidores conserva el `<p>` por defecto para no alterar la
   * jerarquía de vistas que ya abren con su propio H1.
   */
  headingLevel?: 1 | 2 | 3;
  className?: string;
};

export function AdminEmpty({
  action,
  className,
  description,
  headingLevel,
  title,
}: AdminEmptyProps) {
  const Title: 'h1' | 'h2' | 'h3' | 'p' = headingLevel ? (`h${headingLevel}` as 'h1' | 'h2' | 'h3') : 'p';

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-start gap-2 rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-5 py-8',
        className,
      )}
    >
      <Title className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">{title}</Title>
      {description ? (
        <p className="max-w-prose text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export type AdminCalloutTone = 'info' | 'success' | 'warn' | 'error';

const CALLOUT_TONES: Record<
  AdminCalloutTone,
  { border: string; text: string; role: 'status' | 'alert' }
> = {
  info: { border: 'border-l-[var(--ui-action)]', text: 'text-[color:var(--ui-action)]', role: 'status' },
  success: {
    border: 'border-l-[var(--ui-success)]',
    text: 'text-[color:var(--ui-success)]',
    role: 'status',
  },
  warn: { border: 'border-l-[var(--ui-warn)]', text: 'text-[color:var(--ui-warn)]', role: 'alert' },
  error: { border: 'border-l-[var(--ui-danger)]', text: 'text-[color:var(--ui-danger)]', role: 'alert' },
};

export type AdminCalloutProps = {
  tone?: AdminCalloutTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminCallout({ children, className, title, tone = 'info' }: AdminCalloutProps) {
  const meta = CALLOUT_TONES[tone];

  return (
    <div
      role={meta.role}
      className={cn(
        'rounded-[var(--ui-radius-control)] border-l-3 bg-[var(--ui-surface-alt)] px-4 py-3',
        meta.border,
        className,
      )}
    >
      {title ? (
        <p className={cn('text-[length:var(--ui-text-sm)] font-semibold', meta.text)}>{title}</p>
      ) : null}
      <div className="mt-0.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">{children}</div>
    </div>
  );
}

export type AdminStepItem = {
  id: string;
  label: ReactNode;
};

export type AdminStepProps = {
  steps: AdminStepItem[];
  current: number;
  ariaLabel: string;
  className?: string;
};

export function AdminStep({ ariaLabel, className, current, steps }: AdminStepProps) {
  return (
    <ol aria-label={ariaLabel} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';

        return (
          <li
            key={step.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-[length:var(--ui-text-xs)] font-semibold',
                state === 'current' &&
                  'border-[var(--ui-action)] bg-[var(--ui-action)] text-[color:var(--ui-action-foreground)]',
                state === 'done' && 'border-[var(--ui-success)] text-[color:var(--ui-success)]',
                state === 'upcoming' &&
                  'border-[var(--ui-line-strong)] text-[color:var(--ui-ink-soft)]',
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                'text-[length:var(--ui-text-sm)]',
                state === 'current'
                  ? 'font-semibold text-[color:var(--ui-ink)]'
                  : 'text-[color:var(--ui-ink-soft)]',
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="text-[color:var(--ui-line-strong)]">
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Composición de página (encabezado, chips, banda de indicadores, toolbar)    */
/* -------------------------------------------------------------------------- */

export type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  headingId?: string;
  className?: string;
};

/**
 * Encabezado de página del panel: título, contexto y acción primaria alineada a
 * la derecha, con una fila de metadatos (chips) bajo el título. Sustituye los
 * grandes titulares vacíos dentro de tarjetas y las franjas técnicas.
 */
export function AdminPageHeader({
  actions,
  className,
  description,
  headingId,
  meta,
  title,
}: AdminPageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 pb-2', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id={headingId}
            className="text-[length:var(--ui-text-2xl)] font-semibold tracking-tight text-[color:var(--ui-ink)]"
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
    </header>
  );
}

export type AdminChipProps = {
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
  children: ReactNode;
  className?: string;
};

const CHIP_TONES: Record<NonNullable<AdminChipProps['tone']>, string> = {
  neutral:
    'border-[var(--ui-line)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]',
  accent:
    'border-[var(--ui-action-subtle-strong)] bg-[var(--ui-action-subtle)] text-[color:var(--ui-action)]',
  success:
    'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
  warn: 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]',
  danger:
    'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]',
};

/** Etiqueta corta de contexto (ámbito, período, zona, filtros activos). */
export function AdminChip({ children, className, tone = 'neutral' }: AdminChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[length:var(--ui-text-xs)] font-medium',
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type AdminStatBandProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 2 | 3 | 4;
};

/** Banda de indicadores: una superficie con divisores, no cuatro tarjetas. */
export function AdminStatBand({ children, className, columns = 4, ...props }: AdminStatBandProps) {
  return (
    <div
      {...props}
      className={cn(
        'grid grid-cols-1 divide-y divide-[var(--ui-line)] overflow-hidden border-y border-[var(--ui-line)] bg-[var(--ui-surface)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x',
        columns === 2 && 'xl:grid-cols-2',
        columns === 3 && 'xl:grid-cols-3',
        columns === 4 && 'xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type AdminStatProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: AdminTone;
  className?: string;
};

/** Indicador dentro de una `AdminStatBand`. */
export function AdminStat({ className, hint, label, tone = 'default', value }: AdminStatProps) {
  return (
    <div className={cn('min-w-0 px-4 py-3.5', className)}>
      <p className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[length:var(--ui-text-metric)] font-semibold leading-none tabular-nums',
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <div className="mt-1.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">{hint}</div>
      ) : null}
    </div>
  );
}

/** Barra de herramientas (búsqueda + filtros + acciones) sobre tablas. */
export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* Diálogo centrado                                                           */
/* -------------------------------------------------------------------------- */

export type AdminDialogProps = {
  open: boolean;
  closeDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function AdminDialog({
  children,
  className,
  closeDisabled = false,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: AdminDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen || !closeDisabled) onOpenChange(nextOpen);
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-[var(--ui-scrim)]" />
        <DialogPrimitive.Content
          data-dialog-content
          data-slot="dialog-content"
          className={cn(
            // `ui-portal` restaura tipografía/tinta/anillo admin fuera de
            // .ui-root; `ui-portal-surface` impone la superficie admin
            // por encima de las utilidades R2 bg-popover/ring-foreground.
            // La sombra de elevación vive en `ui-portal-surface`
            // (`--shadow-overlay`, §3 de la identidad dark): sin sombra de 80 px
            // de la identidad light.
            'ui-portal ui-portal-surface fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--ui-radius-overlay)] bg-[var(--ui-elevated)] text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] outline-none',
            // Modal centrado: sin `transform-origin` de disparador. El movimiento
            // (entra desde scale(0.95)+opacity, nunca scale(0); sale antes que
            // entra) lo aporta la receta compartida por `data-state` de
            // styles.css para `[data-slot='dialog-content']`.
            'sm:max-w-lg',
            className,
          )}
        >
          <header className="flex shrink-0 flex-col gap-1 border-b border-[var(--ui-line)] py-5 pl-5 pr-14 sm:pl-6">
            <DialogPrimitive.Title className="font-[family-name:var(--ui-font-doc)] text-[length:var(--ui-text-lg)] font-semibold leading-tight text-[color:var(--ui-ink)]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-[length:var(--ui-text-sm)] leading-6 text-[color:var(--ui-ink-soft)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </header>
          <div className="min-h-0 overflow-y-auto p-5 text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)] sm:p-6">{children}</div>
          {footer ? <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--ui-line)] bg-[var(--ui-surface-hover)] px-5 py-4 sm:px-6">{footer}</div> : null}
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              data-slot="dialog-close"
              data-ui-press
              aria-label="Cerrar"
              disabled={closeDisabled}
              className={cn(
                'absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-[var(--ui-radius-control)] text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)] disabled:cursor-wait disabled:opacity-40',
                focusRing,
              )}
            >
              <XIcon aria-hidden="true" data-icon className="size-4" />
            </button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
