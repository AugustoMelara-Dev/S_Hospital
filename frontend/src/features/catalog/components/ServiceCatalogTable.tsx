import { Pencil, Power, PowerOff } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ActionMenu, type ActionMenuGroup } from '../../../components/ui/action-menu';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import { getServiceBillingSummary } from '../../../lib/serviceBilling';
import type { ServiceBillingBadge } from '../../../lib/serviceBilling';
import type { Service } from '../../../lib/api';
import type { ServiceCatalogTableProps } from './catalogTypes';

export function ServiceCatalogTable({
  canManage,
  isLoading,
  loadError,
  onClearFilters,
  onRetry,
  onRowActions,
  services,
  hasActiveFilters,
  isEmpty,
}: ServiceCatalogTableProps) {
  const columns = createServiceColumns({ canManage, onRowActions });

  return (
    <section className="overflow-hidden rounded-xl border border-operational-border bg-operational-surface shadow-operational" aria-labelledby="service-catalog-results-title">
      <header className="flex flex-col gap-1 border-b border-border bg-muted/35 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="service-catalog-results-title" className="text-lg font-semibold tracking-tight">Servicios disponibles</h2>
          <p className="text-xs text-muted-foreground">Precio vigente, disponibilidad en caja y reglas especiales.</p>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{services.length} en esta vista</span>
      </header>
      <div className="p-4 sm:p-5">
      <DataTable
      columns={columns}
      containerLabel="Listado de servicios del catálogo"
      emptyAction={
        hasActiveFilters ? (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : null
      }
      emptyDescription={
        hasActiveFilters
          ? 'No se encontraron servicios con los filtros seleccionados.'
          : 'Comience agregando su primer servicio al catálogo.'
      }
      emptyTitle="No hay servicios"
      error={Boolean(loadError)}
      errorDescription={loadError}
      getRowClassName={() => 'border-b transition-colors hover:bg-muted/30'}
      getRowKey={(service) => service.id}
      loading={isLoading}
      loadingLabel="Cargando servicios del catálogo..."
      onRetry={onRetry}
      rows={isEmpty ? [] : services}
      />
      </div>
    </section>
  );
}

type CreateServiceColumnsOptions = {
  canManage: boolean;
  onRowActions: ServiceCatalogTableProps['onRowActions'];
};

function createServiceColumns({
  canManage,
  onRowActions,
}: CreateServiceColumnsOptions): Array<DataTableColumn<Service>> {
  const columns: Array<DataTableColumn<Service>> = [
    {
      key: 'name',
      header: 'Servicio',
      cellClassName: 'px-4 py-3 align-top',
      render: (service) => {
        const billingSummary = getServiceBillingSummary(service);
        return (
          <div className="flex flex-col gap-1">
            <span className="break-words font-medium">{service.name}</span>
            {billingSummary.reasons.length > 0 ? (
              <span className="text-xs text-muted-foreground">{billingSummary.reasons[0]}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Categoría',
      cellClassName: 'px-4 py-3 align-top text-sm',
      render: (service) => service.category?.name ?? 'Sin categoría',
    },
    {
      key: 'area',
      header: 'Área',
      cellClassName: 'px-4 py-3 align-top text-sm',
      render: (service) => service.area?.name ?? 'Sin área',
    },
    {
      key: 'price',
      header: 'Precio',
      numeric: true,
      cellClassName: 'px-4 py-3 align-top',
      render: (service) => {
        const billingSummary = getServiceBillingSummary(service);
        return (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="font-semibold tabular-nums">{formatServicePrice(service.price)}</span>
            {!billingSummary.hasConfiguredPrice ? (
              <span className="text-xs text-warning-foreground">Sin tarifa operativa</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'billing-state',
      header: 'Estado',
      cellClassName: 'px-4 py-3 align-top',
      render: (service) => {
        const billingSummary = getServiceBillingSummary(service);
        return (
          <div className="flex flex-wrap gap-1">
            {billingSummary.badges.map((badge) => (
              <ServiceBillingBadgeView key={`${service.id}-${badge.label}`} badge={badge} />
            ))}
          </div>
        );
      },
    },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'px-4 py-3 text-right align-top',
      render: (service) => <ServiceRowActions service={service} onRowActions={onRowActions} />,
    });
  }

  return columns;
}

function ServiceBillingBadgeView({ badge }: { badge: ServiceBillingBadge }) {
  return (
    <Badge variant={badge.tone} aria-label={`Indicador: ${badge.label}`}>
      {badge.label}
    </Badge>
  );
}

type ServiceRowActionsProps = {
  onRowActions: ServiceCatalogTableProps['onRowActions'];
  service: Service;
};

function ServiceRowActions({ onRowActions, service }: ServiceRowActionsProps) {
  const groups: ActionMenuGroup[] = [
    {
      key: 'service',
      items: [
        {
          key: 'edit',
          label: 'Editar',
          icon: <Pencil aria-hidden="true" className="size-4" />,
          onSelect: () => onRowActions.onEdit(service),
        },
      ],
    },
    {
      key: 'state',
      items: [
        {
          key: service.active ? 'disable' : 'enable',
          label: service.active ? 'Desactivar' : 'Activar',
          icon: service.active
            ? <PowerOff aria-hidden="true" className="size-4" />
            : <Power aria-hidden="true" className="size-4" />,
          destructive: service.active,
          onSelect: () => onRowActions.onToggleActive(service),
        },
      ],
    },
  ];

  return (
    <ActionMenu
      ariaLabel={`Acciones de servicio ${service.name}`}
      groups={groups}
    />
  );
}

function formatServicePrice(value: string | number | null | undefined): string {
  const cents = parseCents(value);
  return formatLempirasUIFromCents(cents);
}
