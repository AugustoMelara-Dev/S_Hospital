import { MoreHorizontal } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
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
  scannerEnabled,
  services,
  hasActiveFilters,
  isEmpty,
}: ServiceCatalogTableProps) {
  const columns = createServiceColumns({ canManage, onRowActions, scannerEnabled });

  return (
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
  );
}

type CreateServiceColumnsOptions = {
  canManage: boolean;
  onRowActions: ServiceCatalogTableProps['onRowActions'];
  scannerEnabled: boolean;
};

function createServiceColumns({
  canManage,
  onRowActions,
  scannerEnabled,
}: CreateServiceColumnsOptions): Array<DataTableColumn<Service>> {
  const columns: Array<DataTableColumn<Service>> = [
    {
      key: 'name',
      header: 'Nombre',
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
  ];

  if (scannerEnabled) {
    columns.push({
      key: 'code',
      header: 'Código',
      cellClassName: 'px-4 py-3 align-top text-sm text-muted-foreground',
      render: (service) => <ServiceCodeList service={service} />,
    });
  }

  columns.push({
    key: 'billing-state',
    header: 'Estado en caja',
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
  });

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

type ServiceCodeListProps = {
  service: Service;
};

function ServiceCodeList({ service }: ServiceCodeListProps) {
  const codes: Array<['Escaner' | 'Barra' | 'QR', string | null | undefined]> = [
    ['Escaner', service.scan_code],
    ['Barra', service.barcode],
    ['QR', service.qr_code],
  ];

  const visible = codes.filter(([, code]) => Boolean(code));

  if (visible.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {visible.map(([label, code]) => (
        <span key={`${service.id}-${label}`} className="break-all text-xs">
          {label}: {code}
        </span>
      ))}
    </div>
  );
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones de servicio ${service.name}`}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRowActions.onEdit(service)}>Editar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onRowActions.onToggleActive(service)}
          className={service.active ? 'text-destructive' : 'text-success'}
        >
          {service.active ? 'Desactivar' : 'Activar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatServicePrice(value: string | number | null | undefined): string {
  const cents = parseCents(value);
  return formatLempirasUIFromCents(cents);
}
