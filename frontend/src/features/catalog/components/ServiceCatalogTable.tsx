import { EditIcon, MoreHorizontalIcon, PowerIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import { getServiceBillingSummary } from '../../../lib/serviceBilling';
import type { Service } from '../../../lib/api';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ServiceCatalogTableProps } from './catalogTypes';

export function ServiceCatalogTable({ canManage, isLoading, loadError, onClearFilters, onRetry, onRowActions, services, hasActiveFilters, isEmpty }: ServiceCatalogTableProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [openActionsServiceId, setOpenActionsServiceId] = useState<number | null>(null);
  const columns: Array<InstitutionalColumn<Service>> = [
    { id: 'name', accessorKey: 'name', header: 'Servicio', cell: ({ row }) => <ServiceName service={row.original} /> },
    { id: 'category', accessorFn: (service) => service.category?.name ?? 'Sin categoría', header: 'Categoría' },
    { id: 'area', accessorFn: (service) => service.area?.name ?? 'Sin área', header: 'Área' },
    { id: 'price', accessorKey: 'price', header: 'Precio', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatLempirasUIFromCents(parseCents(row.original.price))}</span> },
    { id: 'status', header: 'Estado', enableSorting: false, cell: ({ row }) => <ServiceState service={row.original} /> },
  ];
  if (canManage) columns.push({ id: 'actions', header: 'Acciones', enableSorting: false, cell: ({ row }) => <ServiceActions service={row.original} open={openActionsServiceId === row.original.id} onOpenChange={(open) => setOpenActionsServiceId(open ? row.original.id : null)} onEdit={onRowActions.onEdit} onToggle={onRowActions.onToggleActive} /> });
  const emptyMessage = hasActiveFilters ? 'No se encontraron servicios con los filtros seleccionados.' : 'No hay servicios. Comience agregando su primer servicio al catálogo.';

  return <section aria-labelledby="service-catalog-results-title" className="flex flex-col gap-4">
    <header><h2 id="service-catalog-results-title" className="text-lg font-semibold">Servicios disponibles</h2><p className="text-sm text-muted-foreground">Precio vigente, disponibilidad en caja y reglas especiales.</p></header>
    {isLoading ? <div role="status" aria-label="Cargando servicios del catálogo" className="grid gap-2"><span className="sr-only">Cargando servicios del catálogo...</span><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
    {!isLoading && loadError ? <Alert variant="destructive"><AlertTitle>No se pudo cargar el catálogo</AlertTitle><AlertDescription>{loadError}</AlertDescription><AlertAction><Button type="button" variant="outline" onClick={onRetry}>Reintentar</Button></AlertAction></Alert> : null}
    {!isLoading && !loadError && isEmpty ? <Empty className="border"><EmptyHeader><EmptyTitle>Sin servicios</EmptyTitle><EmptyDescription>{emptyMessage}</EmptyDescription></EmptyHeader>{hasActiveFilters ? <EmptyContent><Button type="button" variant="outline" onClick={onClearFilters}>Limpiar filtros</Button></EmptyContent> : null}</Empty> : null}
    {!isLoading && !loadError && !isEmpty ? isMobile ? <ServiceMobileList canManage={canManage} services={services} openActionsServiceId={openActionsServiceId} setOpenActionsServiceId={setOpenActionsServiceId} onEdit={onRowActions.onEdit} onToggle={onRowActions.onToggleActive} /> : <DataTable ariaLabel="Listado de servicios del catálogo" data={services} columns={columns} getRowId={(service) => String(service.id)} emptyTitle="Sin servicios" emptyDescription={emptyMessage} /> : null}
  </section>;
}

function ServiceMobileList({ canManage, onEdit, onToggle, openActionsServiceId, services, setOpenActionsServiceId }: { canManage: boolean; onEdit: (service: Service) => void; onToggle: (service: Service) => void; openActionsServiceId: number | null; services: Service[]; setOpenActionsServiceId: (id: number | null) => void }) {
  return <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Servicios del catálogo en móvil">{services.map((service) => { const code = visibleServiceCode(service); const summary = getServiceBillingSummary(service); return <li key={service.id} className="grid gap-2 p-4"><div className="flex items-start justify-between gap-3"><strong className="min-w-0 text-base">{service.name}</strong><span className="shrink-0 font-semibold tabular-nums">{formatLempirasUIFromCents(parseCents(service.price))}</span></div><p className="text-sm text-muted-foreground">{service.category?.name ?? 'Sin categoría'} · {service.area?.name ?? 'Sin área'}</p>{code ? <p className="font-mono text-xs text-muted-foreground">Código {code}</p> : null}{summary.reasons[0] ? <p className="text-xs text-muted-foreground">{summary.reasons[0]}</p> : null}<div className="flex items-center justify-between gap-3"><Badge variant={service.active ? 'default' : 'secondary'}>{service.active ? 'Activo' : 'Inactivo'}</Badge>{canManage ? <ServiceActions ariaLabel={`Acciones móviles de servicio ${service.name}`} service={service} open={openActionsServiceId === service.id} onOpenChange={(open) => setOpenActionsServiceId(open ? service.id : null)} onEdit={onEdit} onToggle={onToggle} /> : null}</div></li>; })}</ul>;
}

function ServiceName({ service }: { service: Service }) { const summary = getServiceBillingSummary(service); const code = visibleServiceCode(service); const secondary = [code ? `Código ${code}` : null, summary.reasons[0]].filter(Boolean).join(' · '); return <div><strong>{service.name}</strong>{secondary ? <p className="truncate text-xs text-muted-foreground">{secondary}</p> : null}</div>; }
function ServiceState({ service }: { service: Service }) { return <div className="flex flex-wrap gap-1">{getServiceBillingSummary(service).badges.map((badge) => <Badge key={badge.label} variant={badge.tone === 'destructive' ? 'destructive' : badge.tone === 'secondary' ? 'secondary' : 'outline'}>{badge.label}</Badge>)}</div>; }
function ServiceActions({ ariaLabel, service, open, onOpenChange, onEdit, onToggle }: { ariaLabel?: string; service: Service; open: boolean; onOpenChange: (open: boolean) => void; onEdit: (service: Service) => void; onToggle: (service: Service) => void }) {
  return <DropdownMenu open={open} onOpenChange={onOpenChange}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={ariaLabel ?? `Acciones de servicio ${service.name}`} onClick={(event) => event.stopPropagation()}><MoreHorizontalIcon aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onSelect={() => onEdit(service)}><EditIcon data-icon="inline-start" />Editar</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem variant={service.active ? 'destructive' : 'default'} onSelect={() => onToggle(service)}><PowerIcon data-icon="inline-start" />{service.active ? 'Desactivar' : 'Activar'}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>;
}
function visibleServiceCode(service: Service): string | null { return service.scan_code ?? service.barcode ?? service.qr_code ?? null; }
