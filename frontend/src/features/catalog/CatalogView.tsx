import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  type AuthUser,
  type Category,
  type CategoryPayload,
  type PaginatedMeta,
  type Service,
  type ServicePayload,
  apiClient,
} from '../../lib/api';
import { DataTable, type DataTableColumn } from '../../components/ui/data-table';

const emptyCategory: CategoryPayload = {
  name: '',
  active: true,
  sort_order: 0,
};

const emptyService: ServicePayload = {
  category_id: 0,
  name: '',
  price: '0.00',
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  special_rule_code: null,
};

type CatalogViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function CatalogView({ user, onStatus }: CatalogViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [meta, setMeta] = useState<PaginatedMeta>({ current_page: 1, per_page: 15, total: 0 });
  const [categoryForm, setCategoryForm] = useState<CategoryPayload>(emptyCategory);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [serviceForm, setServiceForm] = useState<ServicePayload>(emptyService);
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const canManageCatalog = useMemo(
    () => user.permissions.includes('catalog.manage'),
    [user.permissions],
  );

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function loadCatalog(
    nextSearch = search,
    nextCategoryId = selectedCategoryId,
    nextPage = page,
    nextPerPage = perPage,
    nextActiveFilter = activeFilter,
  ) {
    setLoadingCatalog(true);
    setCatalogError('');

    try {
      const active =
        nextActiveFilter === 'all' ? undefined : nextActiveFilter === 'active';
      const [nextCategories, nextServices] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getServicesPage({
          search: nextSearch,
          categoryId: nextCategoryId,
          active,
          page: nextPage,
          perPage: nextPerPage,
        }),
      ]);
      setCategories(nextCategories);
      setServices(nextServices.data);
      setMeta(nextServices.meta);
      setPage(nextServices.meta.current_page);
      setPerPage(nextServices.meta.per_page);
      setServiceForm((current) => ({
        ...current,
        category_id: current.category_id || nextCategories[0]?.id || 0,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el catalogo.';
      setCatalogError(message);
      onStatus(message);
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    await loadCatalog(search, selectedCategoryId, 1);
  }

  async function filterByCategory(categoryId?: number) {
    setSelectedCategoryId(categoryId);
    setPage(1);
    await loadCatalog(search, categoryId, 1);
  }

  async function filterByActive(nextActiveFilter: 'all' | 'active' | 'inactive') {
    setActiveFilter(nextActiveFilter);
    setPage(1);
    await loadCatalog(search, selectedCategoryId, 1, perPage, nextActiveFilter);
  }

  async function changePerPage(nextPerPage: number) {
    setPerPage(nextPerPage);
    setPage(1);
    await loadCatalog(search, selectedCategoryId, 1, nextPerPage);
  }

  async function changePage(nextPage: number) {
    setPage(nextPage);
    await loadCatalog(search, selectedCategoryId, nextPage);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageCatalog) {
      return;
    }

    try {
      const saved = await apiClient.saveCategory(categoryForm, categoryId);
      setCategories((current) =>
        categoryId
          ? current.map((category) => (category.id === saved.id ? saved : category))
          : [...current, saved],
      );
      setCategoryForm(emptyCategory);
      setCategoryId(undefined);
      onStatus('Categoria guardada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la categoria.';
      setCatalogError(message);
      onStatus(message);
    }
  }

  async function handleServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageCatalog) {
      return;
    }

    try {
      await apiClient.saveService(serviceForm, serviceId);
      setServiceForm({ ...emptyService, category_id: categories[0]?.id || 0 });
      setServiceId(undefined);
      await loadCatalog(search, selectedCategoryId, serviceId ? page : 1);
      onStatus('Servicio guardado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el servicio.';
      setCatalogError(message);
      onStatus(message);
    }
  }

  function editCategory(category: Category) {
    setCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      active: category.active,
      sort_order: category.sort_order,
    });
  }

  function editService(service: Service) {
    setServiceId(service.id);
    setServiceForm({
      category_id: service.category_id,
      name: service.name,
      price: service.price,
      scan_code: service.scan_code ?? null,
      barcode: service.barcode ?? null,
      qr_code: service.qr_code ?? null,
      taxable: service.taxable,
      active: service.active,
      special_rule_code: service.special_rule_code,
    });
  }

  const serviceColumns: Array<DataTableColumn<Service>> = [
    { key: 'name', header: 'Nombre', render: (service) => service.name },
    {
      key: 'category',
      header: 'Categoria',
      render: (service) => service.category?.name ?? 'Sin categoria',
    },
    { key: 'price', header: 'Precio', render: (service) => `L. ${service.price}` },
    {
      key: 'code',
      header: 'Codigo',
      render: (service) => service.scan_code ?? service.barcode ?? service.qr_code ?? 'Sin codigo',
    },
    { key: 'status', header: 'Estado', render: (service) => (service.active ? 'Activo' : 'Inactivo') },
    { key: 'rule', header: 'Regla', render: (service) => service.special_rule_code ?? 'N/A' },
    ...(canManageCatalog
      ? [{
          key: 'action',
          header: 'Accion',
          render: (service: Service) => (
            <button type="button" className="secondary-button" onClick={() => editService(service)}>
              Editar
            </button>
          ),
        }]
      : []),
  ];

  return (
    <section id="catalogo" className="catalog-layout" aria-labelledby="catalog-title">
      <div className="catalog-main">
        <div className="section-heading">
          <div>
            <p className="app-kicker">Catalogo</p>
            <h2 id="catalog-title">Categorias y servicios</h2>
          </div>
          <form onSubmit={handleSearch} className="search-form">
            <label>
              Buscar servicio
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Glucosa, hemograma, eritropoyetina"
              />
            </label>
            <button type="submit">Buscar</button>
          </form>
        </div>

        <div className="category-strip" aria-label="Categorias">
          <button
            type="button"
            className={
              selectedCategoryId === undefined ? 'secondary-button selected-filter' : 'secondary-button'
            }
            onClick={() => void filterByCategory(undefined)}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                selectedCategoryId === category.id ? 'secondary-button selected-filter' : 'secondary-button'
              }
              onClick={() => {
                if (canManageCatalog) {
                  editCategory(category);
                }
                void filterByCategory(category.id);
              }}
            >
              {category.name} - {category.active ? 'Activa' : 'Inactiva'}
            </button>
          ))}
        </div>

        <div className="catalog-controls" aria-label="Filtros de catalogo">
          <label>
            Estado
            <select
              value={activeFilter}
              onChange={(event) =>
                void filterByActive(event.target.value as 'all' | 'active' | 'inactive')
              }
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
          <label>
            Registros
            <select
              value={perPage}
              onChange={(event) => void changePerPage(Number(event.target.value))}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
            </select>
          </label>
          <span className="muted">
            Mostrando {services.length} de {meta.total} servicios.
          </span>
        </div>
        {catalogError ? <p className="notice error-notice" role="alert">{catalogError}</p> : null}

        <DataTable
          columns={serviceColumns}
          emptyTitle="Sin servicios"
          emptyDescription="No hay servicios para mostrar con los filtros actuales."
          getRowKey={(service) => service.id}
          loading={loadingCatalog}
          loadingLabel="Cargando catalogo..."
          rows={services}
        />

        <div className="pagination-row" aria-label="Paginacion de catalogo">
          <button
            type="button"
            className="secondary-button"
            disabled={page <= 1 || loadingCatalog}
            onClick={() => void changePage(page - 1)}
          >
            Anterior
          </button>
          <span className="muted">
            Pagina {meta.current_page} de {Math.max(Math.ceil(meta.total / meta.per_page), 1)}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={page >= Math.ceil(meta.total / meta.per_page) || loadingCatalog}
            onClick={() => void changePage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {canManageCatalog ? (
        <aside className="catalog-forms">
          <form onSubmit={handleCategorySubmit} className="settings-form">
            <h2>{categoryId ? 'Editar categoria' : 'Nueva categoria'}</h2>
            <label>
              Nombre
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              />
            </label>
            <label>
              Orden
              <input
                type="number"
                value={categoryForm.sort_order}
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, sort_order: Number(event.target.value) })
                }
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={categoryForm.active}
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, active: event.target.checked })
                }
              />
              Categoria activa
            </label>
            <button type="submit">Guardar categoria</button>
          </form>

          <form onSubmit={handleServiceSubmit} className="settings-form">
            <h2>{serviceId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
            <label>
              Categoria
              <select
                value={serviceForm.category_id}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, category_id: Number(event.target.value) })
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre
              <input
                value={serviceForm.name}
                onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
              />
            </label>
            <label>
              Precio
              <input
                value={serviceForm.price}
                onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })}
              />
            </label>
            <label>
              Codigo scanner
              <input
                value={serviceForm.scan_code ?? ''}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, scan_code: event.target.value.trim() || null })
                }
                placeholder="LAB-GLU-001"
              />
            </label>
            <label>
              Barcode
              <input
                value={serviceForm.barcode ?? ''}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, barcode: event.target.value.trim() || null })
                }
                placeholder="Codigo de barra opcional"
              />
            </label>
            <label>
              QR
              <input
                value={serviceForm.qr_code ?? ''}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, qr_code: event.target.value.trim() || null })
                }
                placeholder="Codigo QR opcional"
              />
            </label>
            <label>
              Regla especial
              <select
                value={serviceForm.special_rule_code ?? ''}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    special_rule_code: event.target.value || null,
                  })
                }
              >
                <option value="">Sin regla</option>
                <option value="ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION">
                  Eritropoyetina con receta de dialisis
                </option>
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={serviceForm.taxable}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, taxable: event.target.checked })
                }
              />
              Aplica ISV
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={serviceForm.active}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, active: event.target.checked })
                }
              />
              Servicio activo
            </label>
            <button type="submit">Guardar servicio</button>
          </form>
        </aside>
      ) : (
        <aside className="notice">Cajero puede consultar catalogo, pero no editar precios.</aside>
      )}
    </section>
  );
}
