import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  type AuthUser,
  type Category,
  type CategoryPayload,
  type Service,
  type ServicePayload,
  apiClient,
} from '../../lib/api';

const emptyCategory: CategoryPayload = {
  name: '',
  active: true,
  sort_order: 0,
};

const emptyService: ServicePayload = {
  category_id: 0,
  name: '',
  price: '0.00',
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
  const [categoryForm, setCategoryForm] = useState<CategoryPayload>(emptyCategory);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [serviceForm, setServiceForm] = useState<ServicePayload>(emptyService);
  const [serviceId, setServiceId] = useState<number | undefined>();

  const canManageCatalog = useMemo(
    () => user.permissions.includes('catalog.manage'),
    [user.permissions],
  );

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function loadCatalog(nextSearch = search) {
    try {
      const [nextCategories, nextServices] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getServices({ search: nextSearch }),
      ]);
      setCategories(nextCategories);
      setServices(nextServices);
      setServiceForm((current) => ({
        ...current,
        category_id: current.category_id || nextCategories[0]?.id || 0,
      }));
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar el catalogo.');
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCatalog(search);
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
      onStatus(error instanceof Error ? error.message : 'No se pudo guardar la categoria.');
    }
  }

  async function handleServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageCatalog) {
      return;
    }

    try {
      const saved = await apiClient.saveService(serviceForm, serviceId);
      setServices((current) =>
        serviceId
          ? current.map((service) => (service.id === saved.id ? saved : service))
          : [saved, ...current],
      );
      setServiceForm({ ...emptyService, category_id: categories[0]?.id || 0 });
      setServiceId(undefined);
      onStatus('Servicio guardado.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo guardar el servicio.');
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
      taxable: service.taxable,
      active: service.active,
      special_rule_code: service.special_rule_code,
    });
  }

  return (
    <section className="catalog-layout" aria-labelledby="catalog-title">
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
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="secondary-button"
              onClick={() => {
                if (canManageCatalog) {
                  editCategory(category);
                }
              }}
            >
              {category.name} · {category.active ? 'Activa' : 'Inactiva'}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Regla</th>
                {canManageCatalog ? <th>Accion</th> : null}
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.category?.name ?? 'Sin categoria'}</td>
                  <td>L. {service.price}</td>
                  <td>{service.active ? 'Activo' : 'Inactivo'}</td>
                  <td>{service.special_rule_code ?? 'N/A'}</td>
                  {canManageCatalog ? (
                    <td>
                      <button type="button" className="secondary-button" onClick={() => editService(service)}>
                        Editar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
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
