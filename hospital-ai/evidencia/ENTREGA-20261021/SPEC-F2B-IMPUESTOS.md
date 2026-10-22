# Spec F2B — Impuestos configurables por producto (H-15 / H-02)

Decisión del propietario (2026-10-21): el catálogo semilla se instala **exento**
y con aviso de revisar impuestos. Cada hospital configura sus tasas en la app.
Nada de un hospital concreto en código, instalador ni seeders de producción.

## Modelo de datos (migración aditiva)

`tax_rates`
- `id` bigint PK
- `name` string(60) — p. ej. «ISV 15 %», «ISV 18 %», «Exento»
- `percentage` decimal(5,2) — 15.00, 18.00, 0.00; rango 0.00–99.99
- `active` boolean default true
- `is_default` boolean default false — como máximo una fila `true` por instalación
- `created_by`/`updated_by` nullable FK users nullOnDelete
- timestamps
- índices: `active`, `is_default`

`services.tax_rate_id`
- nullable FK → `tax_rates.id`, `nullOnDelete`
- `NULL` = exento (no se aplica impuesto a la línea)
- Se conserva `services.taxable` por compatibilidad de lectura, pero deja de ser
  la fuente de verdad; un job/migración lo sincroniza (`taxable = tax_rate_id !== null`).

Backfill de la migración (no reescribir historia):
- Si existe `fiscal_settings.default_tax_rate` > 0, crear/obtener la fila
  `tax_rates` con ese porcentaje y `is_default = true`.
- `services.taxable = true` → `tax_rate_id` = tasa predeterminada.
- `services.taxable = false` → `tax_rate_id = NULL`.
- `invoice_items.tax_rate` NO se toca (snapshot histórico por línea).

## Cálculo (backend = única fuente de verdad)

`CalculateInvoiceTotalsAction` pasa a resolver la tasa **por línea**:
- `tax_rate_id` de la línea → `percentage`; null → exento.
- Redondeo: medio centavo hacia arriba por **grupo de tasa**, repartido por resto
  mayor dentro del grupo (misma política actual, sin banquero).
- Salida nueva, conservando las claves actuales:
  - `tax_breakdown`: lista ordenada por tasa desc de
    `{ rate: "15.00", base_cents, tax_cents, label: "Gravado 15 %" }` + exento.
  - `exempt_cents` = suma de líneas sin tasa.
  - `tax_amount_cents` = suma de `tax_cents` de todos los grupos.
  - `taxable_base_cents` = suma de bases gravadas.
  - Cada item conserva `tax_rate` (string "15.00" o "0.00") y `tax_amount_cents`.
- La gratuidad EPO solo cambia el importe efectivo de la línea; el tratamiento
  fiscal sigue viniendo del catálogo (si la EPO estuviera gravada y se libera,
  la base gravada de esa línea es 0).
- `invoice.tax_rate_snapshot` se conserva con la tasa predeterminada (compat);
  el desglose real vive en `invoice_items.tax_rate` y en `tax_breakdown`.

## API y permisos

- `GET/POST/PUT/DELETE /api/tax-rates` (CRUD) con `settings.fiscal.view` /
  `settings.fiscal.update`; cambios con `reason` obligatorio y auditoría
  (mismo patrón que otras settings auditadas).
- `GET /api/tax-rates` disponible para el catálogo (selección por producto).
- Catálogo: `POST/PUT /api/services` acepta `tax_rate_id`; actualización en lote
  `PATCH /api/services/bulk-tax` por categoría o ids.
- Import/Export catálogo (H-16): `POST /api/services/import` (CSV/XLSX multipart,
  modo `preview|apply`) y `GET /api/services/export?format=csv|xlsx`.

## Reglas de negocio obligatorias

- No recalcular facturas históricas: el recibo usa `invoice_items.tax_rate`.
- Exento se muestra como «Exento» y su base suma a `exempt_cents`.
- La EPO gratuita sigue siendo solo su línea; el resto se cobra.
- Aviso visible en Catálogo y en Cobrar mientras el catálogo semilla siga exento:
  «Revise impuestos del catálogo antes de cobrar».

## Pruebas mínimas

- Unit: mezcla 15 % + 18 % + exento + EPO gratuita; redondeo de centavos;
  distribución por resto mayor; total = suma de bases + impuestos.
- Feature: CRUD de tasas con auditoría; servicio con `tax_rate_id`; cambio en
  lote; import preview rechaza filas inválidas sin escribir; export conserva
  columnas.
- Regresión: factura histórica conserva su `tax_rate` aunque cambie la tasa.
- Receipt/report: desglose por tasa coincide con la API para el mismo filtro.
