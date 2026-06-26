import { Boxes, MoreHorizontal } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Skeleton } from '../../../components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
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
  if (isLoading) {
    return (
      <Card className="border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="p-0">
          <Table containerLabel="Listado de servicios del catálogo en carga">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Área</TableHead>
                <TableHead data-numeric="true">Precio</TableHead>
                {scannerEnabled ? <TableHead>Código</TableHead> : null}
                <TableHead>Estado en caja</TableHead>
                {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  {scannerEnabled ? (
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-5 w-12" />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card role="alert" aria-live="assertive" className="border-destructive/35 bg-destructive/10 shadow-operational">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Boxes aria-hidden="true" className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No se pudo cargar</h3>
          <p className="max-w-md text-center text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="border-operational-border bg-operational-surface shadow-operational">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Boxes aria-hidden="true" className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No hay servicios</h3>
          <p className="mb-4 text-center text-muted-foreground">
            {hasActiveFilters
              ? 'No se encontraron servicios con los filtros seleccionados.'
              : 'Comience agregando su primer servicio al catálogo.'}
          </p>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Limpiar filtros
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-operational-border bg-operational-surface shadow-operational">
      <Table containerLabel="Listado de servicios del catálogo">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Área</TableHead>
            <TableHead data-numeric="true">Precio</TableHead>
            {scannerEnabled ? <TableHead>Código</TableHead> : null}
            <TableHead>Estado en caja</TableHead>
            {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              scannerEnabled={scannerEnabled}
              canManage={canManage}
              onRowActions={onRowActions}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

type ServiceRowProps = {
  canManage: boolean;
  onRowActions: ServiceCatalogTableProps['onRowActions'];
  scannerEnabled: boolean;
  service: Service;
};

function ServiceRow({ canManage, onRowActions, scannerEnabled, service }: ServiceRowProps) {
  const billingSummary = getServiceBillingSummary(service);

  return (
    <TableRow className="border-b transition-colors hover:bg-muted/30">
      <TableCell className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className="break-words font-medium">{service.name}</span>
          {billingSummary.reasons.length > 0 ? (
            <span className="text-xs text-muted-foreground">{billingSummary.reasons[0]}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm">
        {service.category?.name ?? 'Sin categoría'}
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm">{service.area?.name ?? 'Sin área'}</TableCell>
      <TableCell className="px-4 py-3 align-top" data-numeric="true">
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="font-semibold tabular-nums">{formatServicePrice(service.price)}</span>
          {!billingSummary.hasConfiguredPrice ? (
            <span className="text-xs text-warning-foreground">Sin tarifa operativa</span>
          ) : null}
        </div>
      </TableCell>
      {scannerEnabled ? (
        <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">
          <ServiceCodeList service={service} />
        </TableCell>
      ) : null}
      <TableCell className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {billingSummary.badges.map((badge) => (
            <ServiceBillingBadgeView key={`${service.id}-${badge.label}`} badge={badge} />
          ))}
        </div>
      </TableCell>
      {canManage ? (
        <TableCell className="px-4 py-3 text-right align-top">
          <ServiceRowActions service={service} onRowActions={onRowActions} />
        </TableCell>
      ) : null}
    </TableRow>
  );
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
