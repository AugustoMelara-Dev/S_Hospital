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
- Mutaciones criticas protegidas por middleware `idempotency` llevan
  `Idempotency-Key`.
- Paginacion: `page`, `per_page`; respuesta siempre incluye `meta`.
- Filtros: nombres snake_case alineados con Laravel.

## Headers personalizados

| Header | Cuando se envia | Significado |
|---|---|---|
| `Idempotency-Key` | Mutaciones criticas con middleware `idempotency`: emitir/anular/reversar factura, pagos, caja, recibos, respaldos | Backend deduplica retries con misma key y mismo payload. |
| `X-XSRF-TOKEN` | Requests con sesion activa | CSRF protection Sanctum. |
| `X-S-Hospital-Paper-Size-Warning: mid-shift-change` | `PUT /api/settings/fiscal` cuando cambia `receipt_paper_size` y hay caja abierta | Frontend muestra alerta al operador. |

## Endpoints clave (catálogo)

| Path | Método | Permiso | Descripcion |
|---|---|---|---|
| `/api/auth/login` | POST | publico | Inicia sesion. |
| `/api/auth/logout` | POST | autenticado | Cierra sesion (audita `auth.logout`). |
| `/api/auth/session` | GET | publico | Sesion actual (o null). |
| `/api/invoices` | GET / POST | `invoices.view` / `invoices.create` | Listado y emision (idempotente). |
| `/api/invoices/{id}` | GET | `invoices.view` | Detalle de factura. |
| `/api/invoices/{id}/void` | POST | `invoices.void` | Anulacion con motivo y auditoria. |
| `/api/invoices/{id}/reverse` | POST | `invoices.reverse` | Reversion de pagos/factura segun estado. |
| `/api/cash-sessions` | GET | `cash.view` | Listado de sesiones. |
| `/api/cash-sessions/open` | POST | `cash.open` | Apertura de caja. |
| `/api/cash-sessions/{id}/close` | POST | `cash.close` | Cierre (motivo obligatorio si diff != 0). |
| `/api/settings/fiscal` | GET / PUT | `settings.fiscal.view` / `settings.fiscal.update` | Configuracion fiscal. |
| `/api/settings/operational` | GET | autenticado | Scanner, abonos parciales, reglas. |
| `/api/settings/institutional-receipts` | GET | `receipt_settings.view` | Configuracion recibos. |
| `/api/settings/institutional-receipts/print-profiles/{id}` | PATCH | `receipt_settings.update` (+ `receipt_settings.advanced` para campos manuales) | Actualiza perfil. |
| `/api/backups` | GET / POST | `backups.view` / `backups.create` | Listado y creacion (audita sha256, filesize). |
| `/api/system/audit-logs` | GET | `audit.view` | Bitacora paginada y filtrable. |
| `/api/system/status` | GET | publico | Estado del sistema. |
| `/api/system/health` | GET | publico | Health check. |

## Permisos

Permisos en `RolesAndPermissionsSeeder`. Principales:

- `invoices.create`, `invoices.void`, `invoices.reverse`
- `payments.create`, `payments.void`
- `cash.view`, `cash.open`, `cash.close`, `cash.close_any`
- `settings.fiscal.view`, `settings.fiscal.update`
- `receipt_settings.view`, `receipt_settings.update`, `receipt_settings.advanced`
- `backups.view`, `backups.create`, `backups.download`
- `audit.view`
- `users.view`, `users.create`, `users.update`, `users.disable`, `users.assign_admin_role`
- `reports.view`, `reports.managerial.view`, `reports.cash_session.view`, `reports.export`

## CORS

Configuracion en `backend/config/cors.php`. Produccion rechaza wildcards (RuntimeException).
Variables de entorno: `CORS_ALLOWED_ORIGINS` (lista separada por comas),
`CORS_ALLOWED_ORIGIN_PATTERNS` (regex). Defaults: `http://localhost:5173,http://127.0.0.1:5173`.
Headers expuestos: `X-S-Hospital-Paper-Size-Warning`.

Rutas idempotentes actuales:

- `POST /api/invoices`
- `POST /api/invoices/{invoice}/void`
- `POST /api/invoices/{invoice}/reverse`
- `POST /api/cash-sessions/open`
- `POST /api/cash-sessions/{cashSession}/close`
- `POST /api/invoices/{invoice}/payments`
- `POST /api/invoices/{invoice}/payments/{payment}/void`
- `POST /api/payments/{payment}/void`
- `POST /api/invoices/{invoice}/reprint`
- `POST /api/institutional-receipts`
- `POST /api/institutional-receipts/{receipt}/pdf`
- `POST /api/institutional-receipts/{receipt}/print-events`
- `POST /api/backups`

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
