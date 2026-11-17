import { useDeferredValue, useState } from 'react';
import { FileSpreadsheet, History, Package, Pencil, Percent, Plus, Search } from 'lucide-react';
import { formatRateBp } from '@/lib/money';
import { ERYTHROPOIETIN_RULE } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, DataTable, EmptyState, IconButton, Input, Money, Select } from '@/ui';
import { type CatalogService, useCategories, useServices } from './api';
import { BulkTaxDialog, HistoryDialog, ImportExportDialog } from './ServiceDialogs';
import { ServiceDrawer } from './ServiceDrawer';

export function ServiceStatusBadges({ s }: { s: CatalogService }) {
  return (
    <div className="flex flex-wrap gap-1">
      {s.active ? <Badge tone="ok" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>}
      {s.active && !s.visible_in_billing && <Badge tone="warn">Oculto en caja</Badge>}
      {!s.is_billable && <Badge tone="warn">No facturable</Badge>}
      {s.special_rule_code === ERYTHROPOIETIN_RULE && <Badge tone="info">Regla eritropoyetina</Badge>}
    </div>
  );
}

export function ServicesTab() {
  const { can } = usePermissions();
  const canManage = can('catalog.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CatalogService | null | 'new'>(null);
  const [history, setHistory] = useState<CatalogService | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);

  const categories = useCategories();
  const q = useServices({ search: deferredSearch, category_id: category, active, page });

  return (
    <>
      <Card flush>
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          <Input
            aria-label="Buscar concepto"
            placeholder="Buscar por nombre o alias"
            prefix={<Search />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full sm:w-72"
          />
          <Select
            aria-label="Categoría"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            placeholder="Todas las categorías"
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            wrapperClassName="w-full sm:w-56"
          />
          <Select
            aria-label="Estado"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
            placeholder="Todos los estados"
            options={[
              { value: '1', label: 'Activos' },
              { value: '0', label: 'Inactivos' },
            ]}
            wrapperClassName="w-full sm:w-44"
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button leftIcon={<FileSpreadsheet />} onClick={() => setIoOpen(true)}>
              Importar / Exportar
            </Button>
            {canManage && (
              <>
                <Button leftIcon={<Percent />} onClick={() => setBulkOpen(true)}>
                  Impuesto en lote
                </Button>
                <Button variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
                  Nuevo concepto
                </Button>
              </>
            )}
          </div>
        </div>
        <DataTable
          caption="Conceptos del catálogo"
          rows={q.data?.items}
          loading={q.isFetching}
          rowKey={(s) => s.id}
          onRowClick={canManage ? (s) => setEditing(s) : undefined}
          empty={
            <EmptyState
              compact
              icon={<Package />}
              title={search || category || active ? 'Sin resultados' : 'El catálogo está vacío'}
              description={search || category || active ? 'Pruebe con otro nombre o quite los filtros.' : 'Cree el primer concepto o importe un CSV.'}
            />
          }
          pagination={
            q.data ? { page: q.data.page, perPage: q.data.per_page, total: q.data.total, onPageChange: setPage } : undefined
          }
          columns={[
            { key: 'name', header: 'Producto o servicio', cell: (s) => <span className="font-medium text-ink">{s.name}</span> },
            { key: 'category', header: 'Categoría', cell: (s) => s.category?.name ?? '—' },
            { key: 'area', header: 'Área', cell: (s) => s.area?.name ?? <span className="text-ink-3">—</span> },
            { key: 'price', header: 'Precio', numeric: true, cell: (s) => <Money cents={s.price_cents} /> },
            {
              key: 'tax',
              header: 'Impuesto',
              cell: (s) => (s.tax_rate ? `${s.tax_rate.name} · ${formatRateBp(s.tax_rate.rate_bp)}` : <span className="text-ink-2">Exento</span>),
            },
            { key: 'status', header: 'Estado', cell: (s) => <ServiceStatusBadges s={s} /> },
          ]}
          rowActions={(s) => (
            <>
              <IconButton size="sm" label={`Historial de precios de ${s.name}`} icon={<History />} onClick={() => setHistory(s)} />
              {canManage && <IconButton size="sm" label={`Editar ${s.name}`} icon={<Pencil />} onClick={() => setEditing(s)} />}
            </>
          )}
        />
      </Card>

      {editing !== null && (
        <ServiceDrawer
          key={editing === 'new' ? 'new' : editing.id}
          open
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <HistoryDialog service={history} onClose={() => setHistory(null)} />
      {canManage && <BulkTaxDialog key={String(bulkOpen)} open={bulkOpen} onClose={() => setBulkOpen(false)} />}
      <ImportExportDialog open={ioOpen} onClose={() => setIoOpen(false)} canManage={canManage} />
    </>
  );
}
