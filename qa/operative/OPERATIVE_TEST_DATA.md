# Datos de prueba — Auditoría operativa S_Hospital

Este archivo describe los datos de prueba y los fixtures lógicos (no
secreto) usados por la auditoría operativa. No incluye contraseñas
reales; en el sistema se crean con los seeders canónicos de Laravel.

## Usuarios de prueba

| Rol            | Username (lógico) | Notas                                            |
| -------------- | ----------------- | ------------------------------------------------ |
| admin          | `admin`           | Permiso `*` vía rol `admin`                      |
| supervisor     | `supervisor`      | Permisos gerenciales (ver `RolesAndPermissionsSeeder`) |
| cajero A       | `cajero_a`        | Caja principal del día                           |
| cajero B       | `cajero_b`        | Caja alterna / segundo PC en LAN                |
| sin permisos   | `sinpermisos`     | User sin rol, sin permisos                       |
| mark-dialysis  | `clinico`         | User con permiso `patients.mark_dialysis_prescription` |

Los nombres de usuario anteriores son etiquetas lógicas; el seeder
de desarrollo puede crear los usuarios reales. Lo importante para
la auditoría son los **permisos** asignados a cada rol según
`backend/database/seeders/RolesAndPermissionsSeeder.php`.

## Servicios de catálogo (resumen)

- `Glucosa` (15.00, gravable, billable, visible)
- `Hemograma Completo` (10.00, gravable, billable, visible)
- `Eritropoyetina` (28.75, gravable, billable, regla
  `ERYTHROPOIETIN_RULE`, visible)

Estos servicios se cargan desde
`backend/database/seeders/data/catalogo_servicios_inicial.csv`
vía `ServiceCatalogSeeder`.

## Escenarios de pacientes para pruebas de búsqueda

| Caso                       | Patient name                  | Esperado              |
| -------------------------- | ----------------------------- | --------------------- |
| Nombre exacto              | `Maria Lopez`                 | Encuentra             |
| Acentos                    | `José Pérez Hernández`        | Encuentra             |
| Doble apellido             | `Lopez Hernandez`             | Encuentra             |
| Espacios extra              | `  Maria   Lopez  `           | Normaliza (frontend)  |
| Búsqueda con typo          | `Maria Lopes`                 | LIKE `%...%`          |
| Nombre largo (>180)        | Cadena de 200 caracteres      | Rechazado backend     |
| Solo nombre obligatorio    | Paciente sin RTN/datos extra  | Permitido (regla)     |

## Casos de pago (matriz financiera)

| # | Servicio       | Cant | Precio | Subtotal | ISV 15% | Total   |
| - | -------------- | ---- | ------ | -------- | ------- | ------- |
| 1 | Glucosa        | 1.00 | 15.00  | 15.00    | 2.25    | 17.25   |
| 2 | Hemograma      | 1.00 | 10.00  | 10.00    | 1.50    | 11.50   |
| 3 | Eritropoyetina | 1.00 | 28.75  | 28.75    | 4.31    | 33.06   |
| 4 | Glucosa + Hmga | 1+1  |        | 25.00    | 3.75    | 28.75   |

Casos especiales:

- **Eritropoyetina gratis con receta de diálisis**: total 0.00, status
  `paid`, genera `Payment::METHOD_OTHER` con amount 0.00 y
  reference `Factura sin cobro por regla autorizada`.
- **Pago parcial de 10.00 sobre Glucosa 17.25**: status pasa a
  `partial`, `paid_amount=10.00`, `balance_due=7.25`.
- **Pago mixto**: 10.00 cash + 7.25 transfer sobre Glucosa → status
  `paid`, total cobrado 17.25.
- **Pago cero o negativo**: rechazado por Form Request + `Money::parsePositiveCents`.
- **Pago mayor al saldo**: Modal del frontend recorta al saldo
  pendiente (cap), backend rechaza `> balance_due`.

## Casos de cierre de caja

- Caja sin pagos: `expected_cash_amount = opening_amount`, `payments_total = 0.00`.
- Caja con pago cash 17.25: `expected = 500.00 + 17.25 = 517.25`.
- Caja con pagos mixtos (transfer + card + other): `expected_cash_amount`
  solo suma efectivo, los demás métodos quedan en `payments_by_method`
  pero **no** inflan el expected de caja.
- Caja con diferencia positiva/negativa: requiere `notes` no vacíos.
- Caja con factura pendiente: `close` retorna 422 con
  `pending_invoice_count` y `pending_amount`.

## Casos de reimpresión

- Reimpresión de factura propia del día con cajero: permitida vía
  `receipts.reprint`.
- Reimpresión histórica (cajero): prohibida por
  `wasIssuedDuringCurrentOperationalDay`.
- Reimpresión por supervisor/admin: permitida con `receipts.reprint_any`.
- Toda reimpresión queda registrada en `audit_logs` con
  `action=invoice.reprinted`.

## Filtros de reporte

- `date_from` y `date_to` validados, rango máximo 31 días.
- Filtro por `cash_session_id` solo permitido para dueño o
  `cash.close_any`.
- Filtro por `method` (cash/transfer/card/other).
- Filtro por `category_id`, `area_id`, `user_id`, `status`.

## Datos simulados de apagón / reinicio

- Apagón durante pago: backend maneja con DB transactions
  (`RegisterPaymentAction` y `CreateInvoiceAction`); si el commit
  no ocurre, no se persiste.
- Reinicio del servidor: caja, facturas, pagos y movimientos se
  recuperan desde `invoices`, `payments`, `cash_register_sessions`,
  `cash_movements`, `audit_logs`.

## Salida esperada de conciliación (caso canónico)

Asumiendo 2 facturas pagadas y 1 factura pendiente del día:

| Métrica                | Valor esperado     |
| ---------------------- | ------------------ |
| `total_billed`         | 39.81              |
| `total_collected`      | 39.81              |
| `total_pending`        | 0.00               |
| `payments_count`       | 2                  |
| `payments_by_method.cash`     | 17.25      |
| `payments_by_method.transfer` | 22.56      |
| `payments_by_method.card`     | 0.00       |
| `payments_by_method.other`    | 0.00       |
| `expected_cash_amount` (caja A) | 517.25   |

(Detalle por escenario en la matriz principal.)
