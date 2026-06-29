# Contratos API

La fuente de verdad es `backend/routes/api.php`, los `FormRequest` y los tipos
en `frontend/src/lib/api`.

## Formatos

Recurso:

```json
{ "data": {} }
```

Coleccion paginada:

```json
{
  "data": [],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 0
  }
}
```

Error de validacion:

```json
{
  "message": "Revise los datos del formulario.",
  "errors": {
    "campo": ["Mensaje en espanol."]
  }
}
```

## Convenciones

- Fechas: ISO 8601 desde backend; render local en frontend.
- Dinero: strings decimales para UI/API y columnas `_cents` para calculos.
- IDs: enteros internos; no exponer codigos tecnicos en recibos principales.
- Mutaciones: `POST`, `PUT`, `PATCH`, `DELETE` llevan `Idempotency-Key`.
- Paginacion: `page`, `per_page`; respuesta siempre incluye `meta`.
- Filtros: nombres snake_case alineados con Laravel.

## Modulos API

- Auth: `/api/auth/*`
- Configuracion fiscal: `/api/settings/*`, `/api/fiscal-sequences`
- Catalogo: `/api/categories`, `/api/areas`, `/api/service-areas`,
  `/api/services`
- Facturacion: `/api/invoices/*`
- Caja y pagos: `/api/cash-sessions/*`, `/api/invoices/{invoice}/payments`
- Recibos: `/api/institutional-receipts/*`, `/api/invoices/{invoice}/receipt`
- Reportes: `/api/reports/*`
- Backups: `/api/backups/*`
- Admin: `/api/admin/users`, `/api/admin/roles`
- Sistema: `/api/system/*`
