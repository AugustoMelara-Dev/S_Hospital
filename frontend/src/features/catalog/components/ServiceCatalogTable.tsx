import { HistoryIcon, MoreHorizontalIcon, PencilIcon, PowerIcon } from 'lucide-react';
import {
  AdminCallout,
  AdminEmpty,
  AdminTable,
  MoneyText,
  StatusStamp,
  type AdminColumn,
  type AdminStatus,
} from '@/design-system/admin/components';
import { AdminMenuContent, AdminMenuItem, AdminMenuRoot, AdminMenuSeparator, AdminMenuTrigger } from '@/design-system/admin/AdminMenu';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Service } from '@/lib/api';
import type { TaxRate } from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import { getServiceBillingSummary, type ServiceBillingBadge } from '@/lib/serviceBilling';
import { ICON_BUTTON, PINNED_ACTIONS_CELL, SECONDARY_BUTTON } from './catalogUi';
import { serviceOperationalNotes } from './serviceOperationalNotes';
import { serviceTaxLabel } from './catalogTax';
import type { ServiceCatalogTableProps } from './catalogTypes';

const TABLE_CAPTION = 'Listado de productos y servicios del catálogo';
const MOBILE_LIST_LABEL = 'Productos y servicios del catálogo en móvil';

const NAME_CLASS = 'block font-semibold text-[color:var(--ui-ink)] [overflow-wrap:anywhere]';
const SOFT_CLASS = 'text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)] [overflow-wrap:anywhere]';
const CELL_CLASS = 'text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)] [overflow-wrap:anywhere]';

/**
 * Solo se colorean las excepciones del resumen de facturación (aviso, bloqueo y
 * regla especial). Los valores por defecto no generan ruido: quedan fuera.
 */
const BADGE_TONE_CLASS: Record<ServiceBillingBadge['tone'], string> = {
  warning: 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]',
  destructive: 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]',
  outline: 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink)]',
  secondary: 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]',
  default: 'border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[color:var(--ui-ink)]',
};

const EMPTY_STATE = {
  withFilters: {
    title: 'Sin coincidencias',
    description: 'No se encontraron productos o servicios con los filtros seleccionados.',
  },
  initial: {
    title: 'No hay productos ni servicios',
    description: 'Comience agregando el primer concepto al catálogo.',
  },
} as const;

/**
 * Lista administrativa del catálogo. El precio vive a la derecha en semibold y
 * el estado se lee como `StatusStamp`; las reglas especiales acompañan al
 * estado para que "Receta diálisis" siga visible a 1366 px. La columna de
 * acciones queda fijada al borde derecho: si la tabla desplaza en horizontal,
 * el menú por fila sigue a la vista y alcanzable con teclado.
 */
export function ServiceCatalogTable({
  canManage,
  hasActiveFilters,
  isEmpty,
  isLoading,
  loadError,
  onClearFilters,
  onRetry,
  onRowActions,
  services,
  taxRates = [],
}: ServiceCatalogTableProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const showActions = true;

  const columns: Array<AdminColumn<Service>> = [
    {
      key: 'service',
      header: 'Producto o servicio',
      mobilePrimary: true,
      cell: (service) => <ServiceIdentity service={service} />,
    },
    {
      key: 'category',
      header: 'Categoría',
      cell: (service) => <span className={CELL_CLASS}>{service.category?.name ?? 'Sin categoría'}</span>,
    },
    {
      key: 'area',
      header: 'Área',
      cell: (service) => <span className={CELL_CLASS}>{service.area?.name ?? 'Sin área'}</span>,
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      cell: (service) => <MoneyText cents={parseCents(service.price)} emphasis="strong" />,
    },
    {
      key: 'tax',
      header: 'Impuesto',
      cell: (service) => <span className={CELL_CLASS}>{serviceTaxLabel(service, taxRates)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (service) => <ServiceState service={service} />,
    },
  ];

  if (showActions) {
    columns.push({
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      className: PINNED_ACTIONS_CELL,
      cell: (service) => (
        <ServiceActions canManage={canManage && onRowActions.canManage} service={service} onEdit={onRowActions.onEdit} onHistory={onRowActions.onHistory} onToggle={onRowActions.onToggleActive} />
      ),
    });
  }

  const emptyCopy = hasActiveFilters ? EMPTY_STATE.withFilters : EMPTY_STATE.initial;

  return (
    <section aria-labelledby="service-catalog-results-title" className="flex flex-col gap-3 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h2
          id="service-catalog-results-title"
          className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]"
        >
          Productos y servicios disponibles
        </h2>
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          Precio vigente, disponibilidad en caja y reglas especiales.
        </p>
      </header>

      {isLoading ? <LoadingState /> : null}

      {!isLoading && loadError ? (
        <AdminCallout tone="error" title="No se pudo cargar el catálogo">
          <p>{loadError}</p>
          <button
            type="button"
            data-ui-press
            className={`${SECONDARY_BUTTON} mt-2`}
            onClick={onRetry}
          >
            Reintentar
          </button>
        </AdminCallout>
      ) : null}

      {!isLoading && !loadError && isEmpty ? (
        <AdminEmpty
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            hasActiveFilters ? (
              <button
                type="button"
                data-ui-press
                className={SECONDARY_BUTTON}
                onClick={onClearFilters}
              >
                Limpiar filtros
              </button>
            ) : undefined
          }
        />
      ) : null}

      {!isLoading && !loadError && !isEmpty ? (
        <div role="region" aria-label={TABLE_CAPTION}>
          {isMobile ? (
            <ServiceMobileList services={services} showActions={showActions} onRowActions={onRowActions} taxRates={taxRates} />
          ) : (
            <AdminTable<Service>
              caption={TABLE_CAPTION}
              columns={columns}
              rows={services}
              getRowKey={(service) => String(service.id)}
              minTableWidth="42rem"
              rowClassName={() => 'hover:bg-[var(--ui-surface-alt)]'}
              empty={<AdminEmpty title={emptyCopy.title} description={emptyCopy.description} />}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label="Cargando productos y servicios del catálogo" className="flex flex-col gap-2">
      <span className="sr-only">Cargando productos y servicios del catálogo…</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          /* Receta única de esqueleto (§5): dos tonos del sistema + pulso de
             opacidad; sin barrido luminoso (shimmer). Static con reduced-motion. */
          className="h-12 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[image:linear-gradient(90deg,var(--ui-skel-from),var(--ui-skel-to))] motion-safe:ui-skel"
        />
      ))}
    </div>
  );
}

function ServiceIdentity({ service }: { service: Service }) {
  const note = serviceOperationalNotes(service)[0];

  if (!note) {
    return (
      <div className="min-w-0">
        <span className={NAME_CLASS}>{service.name}</span>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <span className={NAME_CLASS}>{service.name}</span>
      <span className={`mt-0.5 block ${SOFT_CLASS}`}>
        {note.text}
        {note.moneyCents !== undefined ? (
          <>
            {' '}
            <MoneyText cents={note.moneyCents} className="text-[length:var(--ui-text-xs)] font-semibold" />
          </>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Nota operativa de la tarjeta móvil: la misma frase del catálogo que la tabla,
 * con el importe vigente dibujado por `MoneyText` (nunca un literal).
 */
function MobileServiceNote({ service }: { service: Service }) {
  const note = serviceOperationalNotes(service)[0];

  if (!note) {
    return null;
  }

  return (
    <p className={SOFT_CLASS}>
      {note.text}
      {note.moneyCents !== undefined ? (
        <>
          {' '}
          <MoneyText cents={note.moneyCents} className="text-[length:var(--ui-text-xs)] font-semibold" />
        </>
      ) : null}
    </p>
  );
}

function ServiceState({ service }: { service: Service }) {
  // El estado activo/inactivo ya lo lleva el `StatusStamp`; se omite el badge
  // "Inactivo" duplicado y se conservan las excepciones y la regla especial.
  const badges = getServiceBillingSummary(service).badges.filter((badge) => badge.label !== 'Inactivo');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusStamp status={statusStampFor(service)} label={service.active ? 'Activo' : 'Inactivo'} />
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium ${BADGE_TONE_CLASS[badge.tone]}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function statusStampFor(service: Service): AdminStatus {
  return service.active ? 'cobrado' : 'borrador';
}

function ServiceActions({
  canManage,
  service,
  onEdit,
  onHistory,
  onToggle,
}: {
  canManage: boolean;
  service: Service;
  onEdit: (service: Service) => void;
  onHistory: (service: Service) => void;
  onToggle: (service: Service) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {canManage ? (
        <button
          type="button"
          data-ui-press
          className={SECONDARY_BUTTON}
          aria-label={`Editar precio de ${service.name}`}
          onClick={() => onEdit(service)}
        >
          <PencilIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
          Editar precio
        </button>
      ) : null}
    <AdminMenuRoot>
      <AdminMenuTrigger asChild>
        <button
          type="button"
          data-ui-press
          className={ICON_BUTTON}
          aria-label={`Acciones de servicio ${service.name}`}
        >
          <MoreHorizontalIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </AdminMenuTrigger>
      <AdminMenuContent>
          {canManage ? (
            <AdminMenuItem onSelect={() => onEdit(service)}>
              <PencilIcon aria-hidden="true" />
              Editar
            </AdminMenuItem>
          ) : null}
          <AdminMenuItem onSelect={() => onHistory(service)}>
            <HistoryIcon aria-hidden="true" />
            Ver historial
          </AdminMenuItem>
        {canManage ? (
          <>
            <AdminMenuSeparator />
              <AdminMenuItem
                destructive={service.active}
                onSelect={() => onToggle(service)}
              >
                <PowerIcon aria-hidden="true" />
                {service.active ? 'Desactivar' : 'Activar'}
              </AdminMenuItem>
          </>
        ) : null}
      </AdminMenuContent>
    </AdminMenuRoot>
    </div>
  );
}

/**
 * Tarjeta móvil (`< md`): conserva la distinción entre servicios homónimos por
 * categoría y área sin exponer códigos internos. Las acciones de fila siguen
 * siendo alcanzables con el mismo botón que en la tabla.
 */
function ServiceMobileList({
  services,
  showActions,
  onRowActions,
  taxRates,
}: {
  services: Service[];
  showActions: boolean;
  onRowActions: ServiceCatalogTableProps['onRowActions'];
  taxRates: TaxRate[];
}) {
  return (
    <ul
      aria-label={MOBILE_LIST_LABEL}
      className="divide-y divide-[var(--ui-line)] overflow-hidden rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface)]"
    >
      {services.map((service) => (
        <li key={service.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className={`min-w-0 ${NAME_CLASS}`}>{service.name}</span>
            <MoneyText cents={parseCents(service.price)} emphasis="strong" className="shrink-0" />
          </div>
          <p className={SOFT_CLASS}>
            {service.category?.name ?? 'Sin categoría'} · {service.area?.name ?? 'Sin área'} · {serviceTaxLabel(service, taxRates)}
          </p>
          <MobileServiceNote service={service} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ServiceState service={service} />
            {showActions ? (
              <ServiceActions
                canManage={onRowActions.canManage}
                service={service}
                onEdit={onRowActions.onEdit}
                onHistory={onRowActions.onHistory}
                onToggle={onRowActions.onToggleActive}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
