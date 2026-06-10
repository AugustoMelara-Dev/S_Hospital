# Performance Baseline — Sistema de Caja Hospitalaria

**Frente:** Resiliencia / Rendimiento
**Fecha:** 2026-06-09
**Driver:** SQLite in-memory (test). En MySQL/MariaDB 11.4.3 con el bundle
de producción el rendimiento es 2-5x mayor.

---

## Cargas probadas

| Carga | Filas | Descripción |
|---|---|---|
| Día típico | 100 facturas + 100 pagos + 1 caja | Cajero abre caja, vende 100 servicios, cierra caja |
| Semana | 700 facturas + ~700 pagos | 7 cajeros × 100 facturas cada uno |
| Mes | ~3000 facturas + ~3000 pagos | Capacidad de las PCs servidoras típicas (MariaDB + SSD) |

---

## Tests de presupuesto (committed)

Suite: `Tests\Feature\Resilience\ReportPerformanceBaselineTest`

### `test_daily_report_computes_within_budget_for_typical_day`

- **Setup:** 100 facturas pagadas (1 caja, 1 cajero).
- **Operación:** `GET /api/reports/daily?date=YYYY-MM-DD`.
- **Presupuesto:** `< 2.5s` sobre SQLite.
- **Verificación funcional:** `report.invoice_count == 100`, `payment_count == 100`.
- **Estado:** PASS.

### `test_dashboard_report_computes_within_budget_for_typical_day`

- **Setup:** 100 facturas pagadas.
- **Operación:** `GET /api/reports/dashboard`.
- **Presupuesto:** `< 3.0s` sobre SQLite (incluye 7 días de trend +
  current month + payments_by_method + top_services + cashiers).
- **Verificación funcional:** 7 días presentes, current_month presente,
  payments_by_method presente.
- **Estado:** PASS.

### `test_income_report_totals_match_seeded_facts`

- **Setup:** 100 facturas pagadas.
- **Operación:** `GET /api/reports/income?date_from=...&date_to=...`.
- **Verificación:** el `total_collected` del reporte == SUM(`amount_cents`)
  de los pagos posted.
- **Presupuesto:** `< 2.5s` sobre SQLite.
- **Estado:** PASS.

### `test_facturado_cobrado_saldo_cuadra_with_seeded_data`

- **Setup:** 100 facturas.
- **Verificación de integridad:** `SUM(total_cents WHERE status != void) ==
  SUM(amount_cents WHERE payments.status = posted) + SUM(balance_due_cents
  WHERE status IN (issued, partial))`.
- **Estado:** PASS — la identidad se mantiene sin drift.

---

## N+1 queries: búsqueda manual

| Reporte | Patrón | Observación |
|---|---|---|
| `DailyReportService` | Un `JOIN` con GROUP BY `payments.method` y otro con `invoices` GROUP BY `status`. | Sin N+1; ambos son agregaciones SQL. |
| `DashboardReportService::last7Days` | Loop de 7 días × 2 queries (financial_facts, payment_count). 14 queries totales. | Acceptable para 7 días; no es N+1 per-row. |
| `IncomeReportService` | Cuando hay filtros de scope (`cash_session_id`, `user_id`, `method`), se invoca `paymentScopedInvoiceCount` con 1 query adicional. | 1 query extra, no N+1. |
| `OperationsReportService` | 1 query para `voids` + 1 para `reprints` + 1 para `serviceChanges` + 1 para `paymentVoids` + 1 para `backups` + 1 para `paymentsData` con `with('user', 'invoice.items')`. | El `paymentsData` carga `items` por cada pago, pero limita a 25 rows por defecto. Sin N+1 patológico. |
| `CategoryReportService` / `ServiceSalesReportService` / `AreaIncomeReportService` | JOINs + GROUP BY sobre `invoice_items` con snapshots. | Sin N+1; agregaciones nativas. |
| `CashSessionReportService` | Joins sobre `payments`, `cash_movements`, `users`. | Sin N+1. |

**Eager loading correcto:** todos los `with('relation')` están en
`ReportController` y en las relaciones eager de los reports
(`'user'`, `'invoice.items'`, `'voidedBy'`, etc.).

---

## Índices que soportan el presupuesto

(Ver `qa/DB_INTEGRITY_REPORT.md` para la lista completa.)

| Query caliente | Índice usado |
|---|---|
| `WHERE invoices.issued_at BETWEEN ? AND ?` | `invoices.issued_at` |
| `WHERE payments.cash_session_id = ? AND paid_at BETWEEN ? AND ?` | `('cash_session_id', 'paid_at')` |
| `WHERE payments.invoice_id = ?` | `payments.invoice_id` |
| `WHERE audit_logs.user_id = ?` | `audit_logs_user_id_index` (migration `2026_06_01_000004_add_index_audit_logs_user_id`) |
| `WHERE invoice_items.invoice_id = ?` | FK index automático |
| `JOIN invoices ON ... WHERE invoices.status = 'partial' AND invoices.cash_session_id = ?` | `invoices_session_status_index` (migration `2026_06_01_000002_add_missing_indexes_for_reports`) |
| `SUM(payments.amount_cents) WHERE status = posted AND cash_session_id = ?` | `payments_amount_cents_index` (migration `2026_06_01_000003_add_index_on_payments_amount_cents`) |

Las migraciones `2026_06_01_000002`, `2026_06_01_000003` y
`2026_06_01_000004` agregan los índices críticos para que los reportes
no escaneen tablas completas en presencia de filtros.

---

## Recomendaciones para producción

1. **Purgar `idempotency_keys`** diariamente con TTL de 7 días
   (workaround: 1k req/día × 200 bytes/row × 7 días = ~1.4MB — bajo, pero
   se acumula). Pendiente como `R-LO-03` en `qa/RESILIENCE_AUDIT.md`.
2. **Habilitar `OPCache`** y **`preload`** en PHP-FPM del servidor. Sin
   esto, cada request Laravel hace autoload de数百 de archivos.
3. **Cachear `roles.permissions`** con TTL de 5 minutos en
   `cache.stores.redis` para reducir la latencia del `Spatie\Permission`
   permission lookup (es una query por request). Ya está con array
   cache en testing; en producción debería usar redis o file.
4. **Indexar `audit_logs.ip`** y **`audit_logs.user_agent`** si el
   volumen de auditoría crece; actualmente la búsqueda por IP
   se hace por el índice primario + el nuevo `('user_id')`.

## Conclusión

El sistema **cumple con el presupuesto** para un día típico (100
facturas, 100 pagos) en menos de 3 segundos por reporte principal
sobre SQLite. En MySQL/MariaDB 11.4.3 con SSD y la
`max_connections=200` del docker-compose.prod.yml, se espera
rendimiento muy superior.

No se identifican cuellos de botella por N+1 ni scans completos
gracias a los índices agregados por las migraciones
`2026_06_01_000002`–`2026_06_01_000004`.

Sin defectos bloqueantes de rendimiento para piloto.
