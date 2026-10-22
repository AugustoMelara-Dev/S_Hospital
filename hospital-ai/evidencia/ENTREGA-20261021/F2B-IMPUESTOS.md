# F2B — Impuestos configurables y producto genérico para 2 hospitales

Fecha: 2026-10-21/22 · Rama `release/entrega-20261021`.

## Entregado

### Modelo y migraciones (H-15)
- `tax_rates` (nombre, porcentaje, activa, predeterminada, auditoría) y
  `services.tax_rate_id` nullable (NULL = exento).
- Backfill aditivo (`2026_10_22_000002`): materializa la tasa configurada en
  `fiscal_settings.default_tax_rate` y apunta los servicios `taxable=true` sin
  tasa. **No toca** `invoice_items.tax_rate` (snapshot histórico).
- `taxable` se conserva sincronizado como lectura legacy.

### Cálculo (backend = fuente de verdad)
- `CalculateInvoiceTotalsAction` resuelve la tasa **por línea** y devuelve
  `tax_breakdown` agrupado por tasa. Retrocompatible: una sola tasa produce
  totales idénticos (19 tests previos + caso mixto 15/18/exento/EPO).
- `PreviewInvoiceTotalsAction` expone `tax_breakdown` e `items[].tax_rate_id`.
- `BuildInstitutionalReceiptSnapshotAction` congela `tax_breakdown` en el
  recibo desde `invoice_items` (nunca del catálogo vigente), con forma
  `{rate, base_cents, tax_cents, base_label, tax_label}`.

### Catálogo (H-16)
- Alta/edición de servicio acepta `tax_rate_id` (tasa activa o null).
- `PATCH /api/services/bulk-tax` por categoría o selección, con motivo y auditoría.
- `POST /api/services/import` CSV/XLSX (`preview|apply`) con errores por línea;
  `GET /api/services/export?format=csv|xlsx` con la tasa incluida.
- Semilla **exenta** en producción (`seed_exempt`), sin sobrescribir servicios
  ya administrados; dev/tests conservan el CSV para no romper suites.
- Aviso derivado `catalog_tax_review_required` (meta de `GET /api/tax-rates` y
  `GET /api/settings/catalog-tax-status`): se apaga cuando hay al menos un
  servicio facturable con tasa.

### UI (H-17)
- Ajustes → **Impuestos** (CRUD con motivo, permisos, estados).
- Catálogo: selector por producto, cambio en lote, columna «Impuesto», aviso
  «Revise impuestos del catálogo antes de cobrar», importar/exportar con vista
  previa.
- Nada de un hospital concreto: el catálogo semilla es exento y el nombre cae a
  `S_Hospital` hasta completar Identidad (ver F4).

## Verificación

- PHPStan (PHP 8.3 payload): **0 errores**.
- Pint: **passed**.
- PHPUnit focal F2B: **120/120 OK** (TaxRateManagement, TaxRateInvoiceSnapshot,
  ServiceBulkTax, ServiceCatalogImportExport, ServiceCatalogTest,
  ProductionInstallationSeederTest, CalculateInvoiceTotals×2, InvoicePreviewContract).
- Suite backend completa y gates frontend: ver F1-GATES / cierre de campaña.

## Decisiones

- `seed_exempt` explícito por `Seeder::call` (además del fallback por
  `APP_ENV=production`), para que el contrato del instalador sea testeable.
- El aviso es derivado, no persistido (se limpia solo al configurar tasas).
- H-02 queda resuelto por diseño: cada hospital decide sus tasas; el CSV
  original no se modifica.

## No verificado

- Import XLSX contra archivos reales de terceros (solo sintéticos).
- Backfill de la migración sobre MariaDB real (se prueba en F3 con la base de
  laboratorio y en F5 con la instalación).
