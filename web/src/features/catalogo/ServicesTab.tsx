import { useDeferredValue, useState } from 'react';
import { FileSpreadsheet, History, Package, Pencil, Percent, Plus, Search } from 'lucide-react';
import { formatRateBp } from '@/lib/money';
import { ERYTHROPOIETIN_RULE } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, DataTable, EmptyState, IconButton, Input, Money, Select } from '@/ui';
import type { Service } from '@/api/types';
import { serviceCode, useCategories, useServices } from './api';
import { BulkTaxDialog, HistoryDialog, ImportExportDialog } from './ServiceDialogs';
import { ServiceDrawer } from './ServiceDrawer';
import { Count, Dash, Sheet, StateMark, Toolbar } from './ledger';

export function ServiceStatusBadges({ s }: { s: Service }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {!s.active ? (
        <StateMark shape="hollow">Inactivo</StateMark>
      ) : !s.visible_in_billing ? (
        <StateMark shape="half" tone="warn">Oculto en caja</StateMark>
      ) : (
        <StateMark shape="filled" tone="ok">Activo</StateMark>
      )}
      {!s.is_billable && <Badge tone="warn">No facturable</Badge>}
      {s.special_rule_code === ERYTHROPOIETIN_RULE && <Badge tone="info">Regla eritropoyetina</Badge>}
    </div>
  );
}

function taxLabel(s: Service) {
  if (!s.tax_rate) return <span className="text-ink-2">Exento</span>;
  const rate = formatRateBp(s.tax_rate.rate_bp);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="num font-medium">{rate}</span>
      {!s.tax_rate.name.includes('%') && <span className="text-[12.5px] text-ink-2">{s.tax_rate.name}</span>}
    </span>
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
  const [editing, setEditing] = useState<Service | null | 'new'>(null);
  const [history, setHistory] = useState<Service | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);

  const categories = useCategories();
  const q = useServices({ search: deferredSearch, category_id: category, active, page });

  return (
    <>
      <Sheet>
        <Toolbar>
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
            wrapperClassName="w-full sm:w-52"
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
          <span className="px-1">
            <Count n={q.data?.total} one="concepto" many="conceptos" />
          </span>
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
        </Toolbar>
        <DataTable
          caption="Conceptos del catálogo"
          rows={q.data?.items}
          loading={q.isFetching}
          rowKey={(s) => s.id}
          density="compact"
          onRowClick={canManage ? (s) => setEditing(s) : undefined}
          isRowSelected={(s) => editing !== null && editing !== 'new' && editing.id === s.id}
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
            {
              key: 'name',
              header: 'Producto o servicio',
              cell: (s) => <span className={s.active ? 'font-medium text-ink' : 'font-medium text-ink-2'}>{s.name}</span>,
            },
            { key: 'code', header: 'Código', numeric: true, width: '84px', cell: (s) => <span className="text-ink-2">{serviceCode(s)}</span> },
            { key: 'category', header: 'Categoría', cell: (s) => s.category?.name ?? <Dash /> },
            { key: 'area', header: 'Área', cell: (s) => s.area?.name ?? <Dash /> },
            { key: 'price', header: 'Precio', numeric: true, width: '128px', cell: (s) => <Money cents={s.price_cents} className="font-semibold text-ink" /> },
            { key: 'tax', header: 'ISV', width: '128px', cell: taxLabel },
            { key: 'status', header: 'Estado', width: '220px', cell: (s) => <ServiceStatusBadges s={s} /> },
          ]}
          rowActions={(s) => (
            <>
              <IconButton size="sm" label={`Historial de precios de ${s.name}`} icon={<History />} onClick={() => setHistory(s)} />
              {canManage && <IconButton size="sm" label={`Editar ${s.name}`} icon={<Pencil />} onClick={() => setEditing(s)} />}
            </>
          )}
        />
      </Sheet>

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
