import { useState } from 'react';
import { EditOutlined, MoreOutlined, PoweroffOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Tag, Typography, type MenuProps } from 'antd';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import { getServiceBillingSummary } from '../../../lib/serviceBilling';
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
  const [openActionsServiceId, setOpenActionsServiceId] = useState<number | null>(null);
  const columns: InstitutionalColumn<Service>[] = [
    {
      field: 'name',
      headerName: 'Servicio',
      priority: 'primary',
      flex: 2,
      minWidth: 190,
      cellRenderer: ({ data }: { data?: Service }) =>
        data ? <ServiceName service={data} /> : null,
    },
    {
      colId: 'category',
      headerName: 'Categoría',
      priority: 'secondary',
      valueGetter: ({ data }) => (data as Service | undefined)?.category?.name ?? 'Sin categoría',
      flex: 1,
    },
    {
      colId: 'area',
      headerName: 'Área',
      priority: 'tertiary',
      valueGetter: ({ data }) => (data as Service | undefined)?.area?.name ?? 'Sin área',
      flex: 1,
    },
    {
      field: 'price',
      headerName: 'Precio',
      priority: 'primary',
      type: 'rightAligned',
      cellRenderer: ({ data }: { data?: Service }) =>
        data ? (
          <span className="tabular-nums">{formatLempirasUIFromCents(parseCents(data.price))}</span>
        ) : null,
    },
    {
      colId: 'status',
      headerName: 'Estado',
      priority: 'secondary',
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: Service }) =>
        data ? <ServiceState service={data} /> : null,
    },
  ];

  if (canManage) {
    columns.push({
      colId: 'actions',
      headerName: 'Acciones',
      pinned: 'right',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: Service }) =>
        data ? (
          <ServiceActions
            service={data}
            open={openActionsServiceId === data.id}
            onOpenChange={(open) => setOpenActionsServiceId(open ? data.id : null)}
            onEdit={onRowActions.onEdit}
            onToggle={onRowActions.onToggleActive}
          />
        ) : null,
    });
  }

  const state = isLoading ? 'loading' : loadError ? 'error' : isEmpty ? 'empty' : 'ready';

  // Empty message varies depending on whether filters are active.
  const emptyMessage = hasActiveFilters
    ? 'No se encontraron servicios con los filtros seleccionados.'
    : 'No hay servicios. Comience agregando su primer servicio al catálogo.';

  return (
    <section aria-labelledby="service-catalog-results-title">
      <Space className="w-full justify-between">
        <div>
          <Typography.Title id="service-catalog-results-title" level={3}>
            Servicios disponibles
          </Typography.Title>
          <Typography.Paragraph>
            Precio vigente, disponibilidad en caja y reglas especiales.
          </Typography.Paragraph>
        </div>
        <Typography.Text>{services.length} en esta vista</Typography.Text>
      </Space>

      <InstitutionalDataGrid<Service>
        ariaLabel="Listado de servicios del catálogo"
        rows={services}
        columns={columns}
        getRowId={(service) => String(service.id)}
        state={state}
        errorMessage={loadError}
        emptyMessage={emptyMessage}
        gridOptions={{
          pagination: false,
          rowHeight: 56,
          rowSelection: { mode: 'singleRow', enableClickSelection: true },
        }}
        actions={
          loadError ? (
            <Button onClick={onRetry}>Reintentar</Button>
          ) : hasActiveFilters && isEmpty ? (
            <Button onClick={onClearFilters}>Limpiar filtros</Button>
          ) : null
        }
      />

    </section>
  );
}

function ServiceName({ service }: { service: Service }) {
  const summary = getServiceBillingSummary(service);
  return (
    <div>
      <Typography.Text strong>{service.name}</Typography.Text>
      {summary.reasons[0] ? (
        <Typography.Text type="secondary" className="block">
          {summary.reasons[0]}
        </Typography.Text>
      ) : null}
    </div>
  );
}

function ServiceState({ service }: { service: Service }) {
  return (
    <Space size={4}>
      {getServiceBillingSummary(service).badges.map((badge) => (
        <Tag
          key={badge.label}
          color={
            badge.tone === 'destructive' ? 'error'
            : badge.tone === 'secondary' ? 'blue'
            : 'default'
          }
        >
          {badge.label}
        </Tag>
      ))}
    </Space>
  );
}

// Inline dropdown for desktop AG Grid column (visual only).
function ServiceActions({
  service,
  open,
  onOpenChange,
  onEdit,
  onToggle,
}: {
  service: Service;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (service: Service) => void;
  onToggle: (service: Service) => void;
}) {
  const items: MenuProps['items'] = [
    { key: 'edit', icon: <EditOutlined />, label: 'Editar', onClick: () => onEdit(service) },
    { type: 'divider' },
    {
      key: 'toggle',
      danger: service.active,
      icon: <PoweroffOutlined />,
      label: service.active ? 'Desactivar' : 'Activar',
      onClick: () => onToggle(service),
    },
  ];
  return (
    <Dropdown menu={{ items }} open={open} onOpenChange={onOpenChange} trigger={['click']}>
      <Button
        aria-label={`Acciones de servicio ${service.name}`}
        icon={<MoreOutlined />}
        onClick={(event) => event.stopPropagation()}
      />
    </Dropdown>
  );
}
