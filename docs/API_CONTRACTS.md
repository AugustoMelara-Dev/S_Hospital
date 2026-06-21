# API Contracts - Sistema de Caja Hospitalaria

## Convenciones generales

- Base path: `/api`.
- Auth: Sanctum SPA/cookie para el panel local.
- Formato de respuesta exitosa:

```json
{
  "data": {},
  "meta": {}
}
```

- Formato de error:

```json
{
  "message": "Validation failed.",
  "errors": {}
}
```

- Dinero: strings decimales con dos digitos, por ejemplo `"125.00"`.
- Fechas: ISO 8601.
- El backend valida permisos con Policies/Gates.
- El frontend no es fuente de seguridad.
- El frontend no debe guardar tokens secretos en `localStorage` ni `sessionStorage`.
- Produccion LAN debe usar cookies/sesion protegidas, `HttpOnly` cuando aplique, `SameSite=Lax` o mas estricto, y HTTPS local si se configura certificado.
- Las acciones de factura, pagos, caja, anulacion y correlativo fiscal son transaccionales.

## Auth

### Flujo Sanctum SPA/cookie

El flujo preferido es same-origin: el frontend compilado se sirve desde el mismo host LAN que Laravel, evitando tokens bearer persistidos en el navegador. Si durante desarrollo frontend y API corren en puertos distintos, se debe configurar Sanctum stateful domains y CORS de forma explicita.

Flujo obligatorio:

1. `GET /sanctum/csrf-cookie` antes del primer login o despues de un error 419.
2. `POST /api/auth/login` con credenciales.
3. `GET /api/auth/me` para hidratar usuario, roles, permisos y banderas de seguridad.
4. `POST /api/auth/logout` para cerrar sesion.

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | Publico | N/A | Cookie CSRF/session preparada | Endpoint Sanctum web, no `/api`. Requerido antes de login en SPA/cookie. |
| POST | `/api/auth/login` | Publico | `{ "login": "cajero", "password": "secret" }` | Usuario autenticado, roles, permisos | `login` acepta username o email. |
| POST | `/api/auth/logout` | Autenticado | `{}` | `{ "ok": true }` | Invalida sesion/token. |
| GET | `/api/auth/me` | Autenticado | N/A | Usuario, roles, permisos, `must_change_password` | Usado para boot del frontend. |

Errores esperados:

| Status | Caso | Respuesta esperada | Accion frontend |
|---|---|---|---|
| 401 | No autenticado o sesion invalida | `{ "message": "Unauthenticated." }` | Limpiar estado local no secreto y redirigir a login. |
| 419 | CSRF/session expired | `{ "message": "CSRF token mismatch." }` o respuesta Laravel equivalente | Solicitar de nuevo `/sanctum/csrf-cookie` y pedir reintento/login. |
| 422 | Credenciales invalidas o validacion | `{ "message": "...", "errors": {} }` | Mostrar errores de formulario. |

Respuesta `me` minima:

```json
{
  "data": {
    "id": 1,
    "name": "Cajero Principal",
    "username": "cajero",
    "roles": ["cajero"],
    "permissions": ["invoices.create", "payments.create"],
    "must_change_password": false
  }
}
```

### Credenciales iniciales

Las credenciales iniciales de produccion deben crearse localmente y exigir cambio de contrasena antes de operar.

Reglas minimas:

- Seeder/instalacion de produccion debe crear un admin inicial con password temporal o documentar un procedimiento local equivalente antes del primer uso real.
- El admin inicial de produccion debe tener `must_change_password=true` hasta que cambie su password.
- Mientras `must_change_password=true`, el backend solo debe permitir `GET /api/auth/me`, cambio de password y logout.

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| POST | `/api/auth/change-password` | Autenticado | `{ "current_password": "...", "password": "...", "password_confirmation": "..." }` | Usuario actualizado con `must_change_password=false` | Requerido para admin inicial/usuarios temporales. |

## Users, Roles, Permissions

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/users` | `users.view` | Query: `page`, `search`, `active` | Lista paginada | Solo admin. |
| POST | `/api/users` | `users.create` | Nombre, username/email, password temporal, roles, active, `must_change_password` | Usuario creado | Password nunca se devuelve; usuarios creados por admin deben iniciar con cambio obligatorio salvo decision local documentada. |
| GET | `/api/users/{id}` | `users.view` | N/A | Usuario | Incluye roles. |
| PATCH | `/api/users/{id}` | `users.update` | Campos editables | Usuario actualizado | Auditar cambios sensibles. |
| POST | `/api/users/{id}/disable` | `users.disable` | `{ "reason": "..." }` | Usuario inactivo | No borrar usuarios. |
| GET | `/api/roles` | `users.view` | N/A | Roles y permisos | Para formularios admin. |

## Fiscal Settings

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/settings/branding` | Publico | N/A | Nombre institucional, color y lineas publicas | Para login/branding. No expone RTN, CAI, scanner, pagos ni configuracion operativa. |
| GET | `/api/settings/fiscal` | `settings.fiscal.view` | N/A | Config fiscal actual | Admin/supervisor lectura. |
| PUT | `/api/settings/fiscal` | `settings.fiscal.update` | Hospital, RTN, impuesto, recibo, secuencia fiscal | Config actualizada | Solo admin. Auditar. |
| GET | `/api/fiscal-sequences` | `settings.fiscal.view` | N/A | Secuencias | Para factura/recibo. |
| POST | `/api/fiscal-sequences` | `settings.fiscal.update` | `document_type`, `prefix`, `min_number`, `max_number`, `current_number`, `cai`, `valid_until`, `active` | Secuencia creada | Validar rango. |
| PATCH | `/api/fiscal-sequences/{id}` | `settings.fiscal.update` | Campos editables | Secuencia actualizada | No permitir bajar correlativo por debajo de emitidos. |

Payload fiscal minimo:

```json
{
  "hospital_name": "Hospital San Isidro",
  "rtn": "RTN_AUTORIZADO",
  "default_tax_rate": "15.00",
  "receipt_paper_size": "half_letter",
  "invoice_sequence": {
    "document_type": "invoice",
    "prefix": "000-001-01",
    "current_number": 0,
    "min_number": 1,
    "max_number": 99999999,
    "cai": "CAI_AUTORIZADO",
    "valid_until": "2026-12-31",
    "active": true
  }
}
```

## Categories and Services

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/categories` | `catalog.view` | Query: `active` | Categorias | Cajero puede leer. |
| POST | `/api/categories` | `catalog.manage` | `name`, `active`, `sort_order` | Categoria creada | Admin/supervisor. |
| PATCH | `/api/categories/{id}` | `catalog.manage` | Campos editables | Categoria actualizada | Auditar cambios. |
| GET | `/api/services` | `catalog.view` | Query: `search`, `category_id`, `active`, `page` | Servicios paginados | Usado por facturacion. |
| POST | `/api/services` | `catalog.manage` | Categoria, nombre, precio, taxable, active, special_rule_code | Servicio creado | No afecta facturas historicas. |
| PATCH | `/api/services/{id}` | `catalog.manage` | Campos editables | Servicio actualizado | Auditar precio. |

Servicio minimo:

```json
{
  "id": 10,
  "category_id": 3,
  "name": "Eritropoyetina",
  "price": "25.00",
  "taxable": true,
  "active": true,
  "special_rule_code": "ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION"
}
```

## Invoices

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/invoices` | `invoices.view` | Query: `date_from`, `date_to`, `status`, `patient`, `page` | Lista paginada | Rango por defecto del dia. |
| POST | `/api/invoices` | `invoices.create` | Paciente, items, flags de reglas especiales | Factura emitida | Transaccional; reserva correlativo dentro de la creacion. |
| GET | `/api/invoices/{id}` | `invoices.view` | N/A | Factura con items/pagos | Incluye snapshots. |
| POST | `/api/invoices/{id}/void` | `invoices.void` + alcance operativo | `{ "reason": "..." }` | Factura anulada | Alcance operativo: factura propia del dia o `invoices.operate_any`. Requiere motivo y auditoria. |

Payload crear factura:

```json
{
  "patient_name": "Maria Lopez",
  "items": [
    {
      "service_id": 12,
      "quantity": "1.00",
      "dialysis_prescription": false,
      "notes": null
    }
  ]
}
```

Respuesta factura minima:

```json
{
  "data": {
    "id": 100,
    "invoice_number": "000-001-01-00000001",
    "patient_name": "Maria Lopez",
    "subtotal": "100.00",
    "tax_amount": "15.00",
    "discount_amount": "0.00",
    "total": "115.00",
    "paid_amount": "0.00",
    "balance_due": "115.00",
    "status": "issued",
    "issued_at": "2026-05-16T10:00:00-06:00",
    "items": []
  }
}
```

## Invoice Items

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/invoices/{invoice}/items` | `invoices.view` | N/A | Items snapshot | Solo lectura despues de emitir. |

Los items emitidos no se editan. Si hay error, se anula la factura y se emite una nueva.

## Cash Sessions

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/cash-sessions/current` | `cash.view` | N/A | Caja abierta del usuario o null | Usado por caja/facturacion. |
| POST | `/api/cash-sessions/open` | `cash.open` | `{ "opening_amount": "500.00", "notes": null }` | Sesion abierta | Una caja abierta por cajero salvo decision posterior. |
| POST | `/api/cash-sessions/{id}/close` | `cash.close` | `{ "closing_amount": "1200.00", "notes": "..." }` | Sesion cerrada | Calcula esperado/diferencia. |
| GET | `/api/cash-sessions` | `cash.view` | Query: `date_from`, `date_to`, `status`, `user_id`, `page` | Lista paginada | Supervisor/admin ven mas de una caja. |

## Payments

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| POST | `/api/invoices/{invoice}/payments` | `payments.create` + alcance operativo | Metodo, monto, referencia | Pago registrado + recibo institucional si queda pagada | Alcance operativo: factura propia del dia o `invoices.operate_any`. Transaccional: payment + cash_movement + invoice totals. Si la factura queda pagada y existe configuracion de recibo, emite `institutional_receipt`; si falta configuracion, el pago queda registrado y retorna `institutional_receipt_error`. |
| GET | `/api/invoices/{invoice}/payments` | `payments.view` + alcance operativo | N/A | Pagos | Incluye estado. |
| POST | `/api/invoices/{invoice}/payments/{payment}/void` | `payments.void` + alcance operativo | `{ "reason": "..." }` | Pago anulado | Auditar y recalcular factura. |

Payload pago:

```json
{
  "cash_session_id": 5,
  "method": "cash",
  "amount": "115.00",
  "reference": null
}
```

## Receipts and Reprint

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| POST | `/api/institutional-receipts` | `receipts.view` + `payments.create` | `{ "invoice_id": 10, "payment_id": 50, "profile_code": "media_carta_horizontal" }` | Recibo institucional emitido | Reserva correlativo con bloqueo, guarda snapshot y rechaza duplicados/rango agotado. |
| GET | `/api/institutional-receipts/{receipt}/pdf` | `receipts.view`; reimpresion requiere `receipts.reprint` + motivo por POST | Sin payload | PDF institucional clasico | Usa tamano real del perfil guardado. Primera descarga registra impresion. No acepta motivos por query string. |
| POST | `/api/institutional-receipts/{receipt}/pdf` | `receipts.view`; reimpresion requiere `receipts.reprint` + `reason` | `{ "reason": "Reposicion solicitada" }` | PDF institucional clasico | Descargas posteriores son reimpresion auditada. El motivo viaja en cuerpo JSON, no en URL. |
| POST | `/api/settings/institutional-receipts/test-print` | `receipts.print_test` | Datos de prueba/perfil | PDF con marca `PRUEBA - SIN VALIDEZ` | No reserva correlativo real. |
| GET | `/api/invoices/{invoice}/receipt` | `receipts.view` | Query: `width=half_letter|letter|a5|80mm|58mm` | Datos renderizables de recibo | Usa snapshots. |
| POST | `/api/invoices/{invoice}/reprint` | `receipts.reprint` | `{ "width": "half_letter", "reason": "copia solicitada por paciente" }` | Datos recibo + audit log | Auditar reimpresion. Acepta media carta, carta, A5, 80mm y 58mm. |

El recibo institucional principal debe incluir Gobierno, Secretaria, hospital, numero/serie, fecha, paciente o enterante, concepto, monto numerico, monto en letras, firma del enterante, espacio para sello/firma oficial y leyenda de copias. No debe imprimir QR, codigo de barras, codigos internos, IDs, logs, auditoria ni datos tecnicos. No debe renderizar sello/firma oficial digital por defecto.

El endpoint antiguo `/api/invoices/{invoice}/receipt` se conserva como compatibilidad para la vista HTML previa y formatos heredados; el flujo principal de cobro debe preferir la entidad `institutional_receipts` y su PDF.

## Reports

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/reports/daily` | `reports.view` | Query: `date` | Resumen diario | Rango obligatorio o default hoy. |
| GET | `/api/reports/income` | `reports.view` | Query: `date_from`, `date_to`, `cash_session_id`, `user_id`, `category_id`, `area_id`, `method`, `status` | Ingresos agregados | Sumar en backend; separar facturado, cobrado, pendiente, parcial y anulado. |
| GET | `/api/reports/categories` | `reports.view` | Query: filtros de rango (`date_from`, `date_to`, caja, cajero, categoria, area, metodo, estado) | Totales por categoria | Usa snapshots historicos; no traer todo al frontend. |
| GET | `/api/reports/areas` | `reports.view` | Query: filtros de rango (`date_from`, `date_to`, caja, cajero, categoria, area, metodo, estado) | Totales por area | Usa snapshots historicos y fuente de monto declarada. |
| GET | `/api/reports/services` | `reports.view` | Query: filtros de rango (`date_from`, `date_to`, caja, cajero, categoria, metodo, estado) | Servicios mas cobrados/facturados | Usa snapshots historicos de factura; no recalcula desde catalogo vigente. |
| GET | `/api/reports/cash-sessions/{id}` | `reports.view` | N/A | Resumen de caja | Esperado vs contado. |
| GET | `/api/reports/operations` | `reports.view` | Query: `date_from`, `date_to`, filtros operativos | Anulaciones, reimpresiones, reversos, respaldos y cajeros | Vista normal no expone IDs internos, checksum de backup ni rutas locales; soporte tecnico debe usar fuentes administrativas protegidas. |
| GET | `/api/reports/export` | `reports.export` | Query: filtros de rango (`date_from`, `date_to`, caja, cajero, categoria, area, metodo, estado) | Excel de cierre | Debe mostrar filtros aplicados con etiquetas humanas, no `Caja #id` ni codigos internos. |
| GET | `/api/reports/pdf` | `reports.export` | Query: `date` o filtros de rango (`date_from`, `date_to`, caja, cajero, categoria, area, metodo, estado) | Archivo PDF de cierre | PDF diario requiere `reports.managerial.view`; PDF por rango permite scoping por caja para usuarios con `reports.cash_session.view`; filtros impresos usan etiquetas humanas. |

Los filtros tecnicos `cash_session_id`, `user_id`, `category_id` y `area_id` solo viajan como query params. Las pantallas y exportaciones deben resolverlos a etiquetas humanas (caja con cajero/fecha/estado, cajero, categoria y area) antes de mostrarlos a administracion.

## Backups

| Metodo | Ruta | Permiso | Payload | Respuesta | Notas |
|---|---|---|---|---|---|
| GET | `/api/backups` | `backups.view` | Query: `page` | Lista de backups | Admin. |
| POST | `/api/backups` | `backups.create` | `{}` | Backup manual registrado en cola local | Responde `202` con `status=pending`; el worker local ejecuta el dump y actualiza `success/failed`. |
| GET | `/api/backups/{id}/download` | `backups.download` | N/A | Archivo backup | Proteger acceso. |

Restore no se expone como accion web en la primera version vendible. Debe documentarse en `docs/BACKUP_RESTORE.md` para evitar restauraciones accidentales desde UI.
