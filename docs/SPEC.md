# S_Hospital v2 — Especificación técnica (contrato único)

Este documento es el contrato que comparten backend (`api/`) y frontend (`web/`).
Si el código y este documento discrepan, se corrige uno de los dos en el mismo cambio.

## 0. Producto

Sistema local de caja hospitalaria (Honduras): facturación con numeración fiscal CAI,
cobros, caja por turnos, recibos institucionales PDF, catálogo, reportes, usuarios/roles,
auditoría y respaldos. Opera **sin internet** en una LAN: un servidor ejecuta API + BD,
los clientes usan el navegador. Idioma de UI: español (es-HN). Moneda HNL ("L 1,234.00").
Zona horaria de negocio: `America/Tegucigalpa` (UTC-6, sin horario de verano).

## 1. Stack

| Capa | Tecnología |
|---|---|
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (ORM, estilo 2.0), Alembic |
| BD | MariaDB 11 / MySQL 8 en producción (driver PyMySQL). SQLite solo para pruebas. |
| Auth | Sesión por cookie httpOnly opaca (`shs_session`), hash argon2 (`argon2-cffi`) |
| PDF | ReportLab (puro Python, offline) |
| Excel | openpyxl |
| Cifrado respaldos | `cryptography` (AES-256-GCM) |
| Pruebas API | pytest + httpx TestClient, SQLite temporal |
| Web | React 19, TypeScript estricto, Vite, React Router 7, TanStack Query 5, React Hook Form + Zod, Tailwind CSS 4 |
| Fuentes | `@fontsource-variable/*` empaquetadas (sin CDN) |
| Pruebas web | Vitest + Testing Library; Playwright para E2E |

Despliegue: la API sirve también el build estático del SPA (`web/dist`) en `/`, de modo que
un solo proceso (uvicorn) + MariaDB bastan. Docker Compose (`mariadb` + `app`) y script Windows.

## 2. Convenciones API

- Prefijo `/api`. JSON UTF-8. Fechas ISO-8601 con offset (`2026-11-17T10:30:00-06:00`); fechas sin hora `YYYY-MM-DD`.
- **Dinero siempre en centavos enteros** (`*_cents: int`). Nunca floats. Entrada de montos desde UI también en centavos.
- Cantidades: `quantity_hundredths: int` (1.5 unidades = 150), mínimo 1, máximo 2 decimales en UI.
- Tasas: `rate_bp: int` (puntos básicos: 15 % = 1500).
- Lista paginada: `{"items": [...], "page": 1, "per_page": 25, "total": 123}`. Objeto: el objeto directo (sin envoltorio).
- Errores: `{"error": {"code": "snake_code", "message": "Texto en español para el usuario", "fields": {"campo": "mensaje"}}}`.
  - 400 regla de negocio / 401 sin sesión / 403 sin permiso / 404 / 409 conflicto / 422 validación / 423 bloqueo login / 428 falta Idempotency-Key / 429.
- **CSRF**: cookie `SameSite=Strict`; todo método no-GET exige header `X-Requested-With: shospital`.
- **Idempotencia**: los endpoints marcados [IDEM] exigen header `Idempotency-Key` (1–100 chars). Por usuario+ruta+clave:
  misma clave y mismo cuerpo → se repite la respuesta guardada con header `Idempotent-Replay: true`;
  misma clave con cuerpo distinto → 409; solo se guardan respuestas 2xx.
- `must_change_password=true` → toda ruta excepto `/api/auth/*` responde 403 `password_change_required`.

## 3. Permisos y roles

Permisos (códigos estables):
```
settings.view settings.update
catalog.view catalog.manage
invoices.view invoices.create invoices.operate_any invoices.void invoices.reverse
cash.view cash.open cash.close cash.close_any
payments.create payments.view payments.void
receipts.view receipts.reprint receipts.reprint_any
receipt_settings.view receipt_settings.update
reports.own reports.all reports.export
users.view users.manage
backups.view backups.create backups.download
audit.view system.status
patients.mark_dialysis_prescription
```
Roles sembrados (no se pueden borrar; `admin` no se puede editar):

| Rol | Etiqueta | Permisos |
|---|---|---|
| admin | Administración | todos |
| supervisor | Supervisión | settings.view, catalog.*, invoices.*, cash.*, payments.*, receipts.*, receipt_settings.view, reports.all, reports.export, audit.view |
| auditor | Auditoría | settings.view, catalog.view, invoices.view, cash.view, payments.view, receipts.view, reports.all, backups.view, audit.view |
| soporte | Soporte técnico | system.status, receipt_settings.view, receipt_settings.update, backups.view |
| cajero | Caja | catalog.view, invoices.view, invoices.create, cash.view, cash.open, cash.close, payments.create, payments.view, receipts.view, receipts.reprint, reports.own, patients.mark_dialysis_prescription |

Un usuario tiene **un rol**. Roles personalizados: CRUD con lista de permisos.
"Operar" una factura (cobrar, anular, revertir, reimprimir) = `invoices.operate_any` **o** (`issued_by == yo` y emitida hoy en hora de Honduras).
Ver facturas ajenas o de días previos requiere `invoices.operate_any` o `reports.all`.

## 4. Modelo de datos (tablas)

Todas con `id BIGINT PK autoincrement`, `created_at`, `updated_at` (UTC en BD, se presenta en hora de Honduras).

- **users**: name(120), username(60, unique), email(160, unique, null), password_hash, role_id FK, active bool, must_change_password bool, last_login_at.
- **roles**: code(40 unique), name(80), is_system bool. **role_permissions**: role_id, permission(60) — PK compuesta.
- **user_sessions**: token_hash(64 unique), user_id, ip, user_agent(255), created_at, last_seen_at, expires_at (12 h deslizante).
- **login_attempts**: login(160), ip(45), success, attempted_at. Bloqueo 15 min tras 5 fallos del mismo login en 15 min o 20 fallos de la misma IP → 423.
- **settings** (singleton id=1): hospital_name, rtn, address, phone, slogan, government_line, secretariat_line, receipt_location, receipt_footer_text, default_tax_rate_bp(default 1500), partial_payments_enabled bool, logo (LONGBLOB null) + logo_mime.
- **fiscal_sequences**: prefix(32), cai(128), min_number, max_number, current_number, valid_until date, active bool, active_marker (1 cuando activa, null si no; unique) → una sola activa.
- **tax_rates**: name(60), rate_bp int (0–9999), active, is_default.
- **categories**: name(120), slug(unique), active, sort_order.
- **areas**: name(120), slug(unique), active, sort_order.
- **services**: category_id FK, area_id FK null, name(160), slug, source_key(unique null), aliases text, description(255), price_cents (>=0), tax_rate_id FK null (null = exento), active, visible_in_billing, is_billable, special_rule_code(80 null). Unique(category_id, slug).
- **service_price_history**: service_id, old_price_cents, new_price_cents, reason, changed_by, changed_at.
- **cash_registers**: code(32 unique), name(80), active. Sembrada: `principal` / "Caja principal".
- **cash_sessions**: cash_register_id, user_id, status(open|closed), open_register_marker (=register_id cuando abierta, null cerrada; unique), open_user_marker (=user_id cuando abierta; unique), opening_cents, opening_notes, opened_at, closed_at, closed_by, counted_cents, expected_cash_cents, difference_cents, closing_notes, closing_breakdown JSON, method_totals JSON, payments_count, payments_total_cents.
- **cash_movements**: cash_session_id, payment_id null, user_id, type(opening|payment|payment_void|closing), method null, amount_cents (con signo), notes, occurred_at.
- **invoices**: number(40 unique), fiscal_sequence_id, snapshots: fiscal_cai, fiscal_range_from, fiscal_range_to, fiscal_valid_until, hospital_name, hospital_rtn, hospital_address, hospital_phone, government_line, secretariat_line, receipt_location, receipt_footer_text; patient_name(180, indexed), subtotal_cents, exempt_cents, taxable_cents, tax_cents, total_cents, paid_cents, balance_cents, tax_breakdown JSON, status(issued|partial|paid|void), settlement(pending|paid|free_by_rule|zero_price), dialysis_prescription bool, cash_session_id, issued_by, issued_at, voided_by, voided_at, void_reason, reversed bool. Nunca se borra.
- **invoice_items**: invoice_id, service_id null, service_name, category_name, area_name, quantity_hundredths, unit_price_registered_cents, unit_price_cents, rule_adjustment_cents, rate_bp, line_subtotal_cents, tax_cents, line_total_cents, special_rule_applied bool, position.
- **payments**: invoice_id, cash_session_id, user_id, method(cash|transfer|card|other), amount_cents, received_cents null, change_cents null, reference(120), status(posted|void), void_reason, voided_by, voided_at, paid_at.
- **receipt_series**: series(32), prefix(32), min_number, max_number, current_number, range_authorization(128), legal_text, number_color(#b91c1c), active (una activa). Sembrada: REC-A, formato `{series}-{number:08}` → `REC-A-00000001`.
- **print_profiles**: code(unique), name, paper(half_letter|letter_portrait|letter_landscape|a5_landscape|a4_portrait|thermal_80|thermal_58), width_mm, height_mm, margins_mm, copies_mode(original_only|original_first|original_first_second), show_seal_space, use_logo, active, is_default (uno).
- **institutional_receipts**: invoice_id (unique cuando issued), series_id, number, number_full(unique), status(issued|void), amount_cents, amount_words, payer_name, cash_session_id, issued_by, issued_at, snapshot JSON (institución, items, pagos, fiscales), reprint_count, voided_at, void_reason.
- **receipt_print_events**: receipt_id, type(first_print|reprint|test), reason, user_id, created_at.
- **audit_logs** (solo inserción): user_id, action(80), entity_type, entity_id, result(success|failed|denied), reason, old_values JSON, new_values JSON, ip, created_at.
- **idempotency_keys**: user_id, route, key, fingerprint, status_code, body, created_at. Unique(user_id, route, key).
- **backups**: filename, size_bytes, sha256, status(pending|success|failed), kind(manual|scheduled), error, created_by, created_at, completed_at.

## 5. Reglas de negocio (no negociables)

1. **Totales** (servidor es la fuente de verdad):
   - Por línea: `registered = price_cents del catálogo`; `unit = 0 si aplica eritropoyetina, si no registered`.
     `line_subtotal = (unit * qty_hundredths + 50) // 100`; `rule_adjustment = (registered*qty+50)//100 - line_subtotal`.
   - Tasa por línea = `service.tax_rate.rate_bp` (null → exento, 0).
   - ISV se calcula por grupo de tasa sobre la base total del grupo: `group_tax = (base*bp + 5000)//10000`; se reparte a líneas con
     `floor(base_line*bp/10000)` y los centavos restantes a las líneas de mayor residuo (`base_line*bp % 10000` desc, empate por índice).
   - `exempt = subtotal - taxable_base`; `total = subtotal + tax`. Invariante: Σ line_total = total.
   - `tax_breakdown = [{rate_bp, base_cents, tax_cents, label:"ISV 15 %"}]` + `{rate_bp:0, base_cents, label:"Exento"}` si hay.
2. **Eritropoyetina**: solo líneas con `special_rule_code = "ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION"` y solo si la factura trae
   `dialysis_prescription=true` (requiere permiso `patients.mark_dialysis_prescription`, si no 403 y auditoría). Esas líneas quedan en 0; el resto se cobra normal.
   Nunca se vuelve gratuita la factura completa. `special_rule_code` no se puede crear ni quitar por API.
3. **Emisión de factura** (transacción): requiere caja propia abierta; servicios activos, visibles, facturables y con categoría activa;
   `patient_name` obligatorio (espacios colapsados, 1–180); 1–100 líneas; numeración fiscal: única secuencia activa, CAI no vacío,
   `valid_until >= hoy`, `next = current+1` dentro de [min,max]; número `{prefix}-{next:08d}` (bloqueo FOR UPDATE).
   Snapshots de institución, fiscales y de cada línea. Total 0 → `status=paid`, `settlement=free_by_rule|zero_price`, sin pago ni movimiento, y se emite el recibo institucional.
4. **Pago** [IDEM]: caja propia abierta; factura no anulada ni pagada; `amount <= balance`; si `amount < balance` solo con
   `partial_payments_enabled`; card/transfer exigen referencia; efectivo admite `received_cents >= amount` y calcula `change_cents`.
   Crea payment + movimiento `payment`; actualiza paid/balance/status. Al quedar en 0 se **emite automáticamente el recibo institucional**.
5. **Anular factura**: permiso `invoices.void`, operar, motivo ≥5, sin pagos registrados, caja de la factura abierta. No se borra.
6. **Revertir**: permiso `invoices.reverse`, operar, motivo ≥5, ≥1 pago posted, cajas abiertas. Anula pagos (movimiento `payment_void` negativo), anula recibo, anula factura (`reversed=true`).
7. **Caja**: una sesión abierta por caja y por usuario. Apertura `opening_cents >= 0`. Esperado en efectivo = apertura + pagos en efectivo − anulados en efectivo.
   Cierre bloqueado si hay facturas `issued|partial` de la sesión o pagadas sin recibo. `difference = counted - expected`; diferencia ≠ 0 exige nota ≥5.
   Desglose opcional por denominaciones L 500,200,100,50,20,10,5,2,1 + `coins_cents`; debe sumar `counted_cents`. Cerrar ajena requiere `cash.close_any`. Sesión cerrada es inmutable.
8. **Recibo institucional**: uno emitido por factura pagada; número de la serie activa (`next = max(current+1,min)`, agotada → error).
   `amount_words` en español: "UN MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 05/100". Primera impresión libre; reimpresión exige
   `receipts.reprint` (+`reprint_any` si no la opera) y motivo ≥5; marca "REIMPRESIÓN #n". Sin QR, códigos de barras ni códigos internos.
   Perfiles térmicos no válidos para el recibo institucional principal.
9. **Auditoría**: toda acción sensible escribe `audit_logs` (login ok/fallido, cambios de precio/impuesto/disponibilidad, apertura/cierre de caja,
   emisión, pago, anulación, reversión, reimpresión, cambios de ajustes/secuencia/usuarios/roles, respaldos). La tabla no admite UPDATE/DELETE por la app.
10. **Cambios sensibles con motivo ≥5**: precio, impuesto, disponibilidad de servicio/categoría, cambio de RTN o secuencia fiscal, desactivar usuario, reset de clave.
11. Contraseñas: ≥12 caracteres con minúscula, mayúscula, número y símbolo. Usuarios nuevos y reseteos → `must_change_password`.

## 6. Endpoints

Auth (sin permiso): `POST /api/auth/login {login,password}` → `Me` · `POST /api/auth/logout` · `GET /api/auth/me` → `Me|401` · `POST /api/auth/change-password {current_password,new_password}`.
`Me = {id,name,username,email,role:{code,name},permissions[],must_change_password}`.

Públicos: `GET /api/health` → `{status:"ok",version}` · `GET /api/branding` → `{hospital_name,slogan,has_logo}` · `GET /api/branding/logo`.

Ajustes (`settings.view` / `settings.update`):
`GET|PUT /api/settings` · `POST /api/settings/logo` (multipart) · `DELETE /api/settings/logo` ·
`GET|POST /api/fiscal-sequences`, `PATCH /api/fiscal-sequences/{id}` (motivo) ·
`GET|POST /api/tax-rates`, `PATCH|DELETE /api/tax-rates/{id}` (motivo; no borrar si está en uso).

Catálogo (`catalog.view` lectura, `catalog.manage` escritura):
`GET /api/categories`, `POST`, `PATCH /{id}` · `GET /api/areas`, `POST`, `PATCH /{id}` ·
`GET /api/services?search&category_id&area_id&active&billing=1&page&per_page` (billing=1 → solo activos+visibles+facturables; búsqueda por nombre/alias sin acentos) ·
`GET /api/services/{id}` · `POST /api/services` · `PATCH /api/services/{id}` (motivos) · `GET /api/services/{id}/history` ·
`PATCH /api/services/bulk-tax {category_id|service_ids, tax_rate_id|null, reason}` · `GET /api/services/export.csv` · `GET /api/services/export.xlsx` ·
`POST /api/services/import?mode=preview|apply` (CSV; columnas `categoria,servicio,precio_lps,area,tasa,activo,visible_en_cobro,facturable,descripcion,aliases`).

Caja: `GET /api/cash-registers` · `GET /api/cash-sessions/current` → `CashSession|null` (con `reconciliation`) ·
`POST /api/cash-sessions/open {cash_register_id?, opening_cents, notes?}` [IDEM] ·
`POST /api/cash-sessions/{id}/close {counted_cents, notes?, breakdown?:{bills:{"500":n,...}, coins_cents}}` [IDEM] ·
`GET /api/cash-sessions?status&user_id&cash_register_id&date_from&date_to&difference=all|balanced|shortage|overage&page` ·
`GET /api/cash-sessions/{id}` (con reconciliation y movements) · `GET /api/cash-sessions/{id}/summary.pdf`.
`reconciliation = {opening_cents, expected_cash_cents, method_totals:{cash,transfer,card,other}, payments_count, payments_total_cents, pending_count, pending_cents, missing_receipts_count, can_close, blockers:[{code,message,count}]}`.

Facturas: `POST /api/invoices/preview {items:[{service_id,quantity_hundredths}], dialysis_prescription}` → totales sin persistir ·
`POST /api/invoices {patient_name, items, dialysis_prescription}` [IDEM] → `Invoice` ·
`GET /api/invoices?search&status&date_from&date_to&cash_session_id&pending=1&page` · `GET /api/invoices/{id}` (items, payments, receipt) ·
`POST /api/invoices/{id}/payments {method, amount_cents, received_cents?, reference?}` [IDEM] → `{invoice, payment, receipt|null}` ·
`POST /api/invoices/{id}/void {reason}` [IDEM] · `POST /api/invoices/{id}/reverse {reason}` [IDEM] ·
`POST /api/invoices/draft-receipt.pdf` (borrador con marca "BORRADOR - SIN VALIDEZ", sin consumir números).

Recibos: `GET /api/receipts/{id}` · `GET /api/receipts/{id}/pdf?profile=code` (primera impresión registra `first_print`) ·
`POST /api/receipts/{id}/reprint {reason, profile?}` [IDEM] → PDF · `POST /api/invoices/{id}/receipt` [IDEM] (emite si falta) ·
Ajustes de recibo (`receipt_settings.*`): `GET /api/receipt-settings` → `{series[], profiles[]}` · `POST /api/receipt-series`, `PATCH /api/receipt-series/{id}` · `PATCH /api/print-profiles/{id}` · `POST /api/print-profiles/{code}/test.pdf`.

Reportes (`reports.own` fuerza user_id propio; `reports.all` todo):
`GET /api/reports/today` → KPIs del día (billed, collected, pending, without_charge_count, voided_count, by method, sesión actual) ·
`GET /api/reports/summary?date_from&date_to&method&status&user_id&cash_session_id&category_id` (≤92 días) →
`{summary:{billed_cents,collected_cents,pending_cents,without_charge_count,invoices_count,paid_count,partial_count,average_ticket_cents,voided_cents,reversed_cents,free_lines_count,free_value_cents}, by_method[], daily[], operations[], lines[], payments[], sessions[], gratuities[], top_services[]}` ·
`GET /api/reports/summary.pdf` · `GET /api/reports/summary.xlsx` (`reports.export`).

Usuarios (`users.view` / `users.manage`): `GET /api/users`, `POST`, `PATCH /{id}`, `POST /{id}/toggle-active {reason}`, `POST /{id}/reset-password {password, reason}` ·
`GET /api/roles` (con `permission_catalog` agrupado por módulo y etiquetas en español), `POST /api/roles`, `PATCH /api/roles/{id}`.
Reglas: no cambiar el propio rol; no desactivarse; nunca dejar el sistema sin admin activo.

Sistema: `GET /api/audit-logs?search&action&user_id&date_from&date_to&page` (`audit.view`) ·
`GET /api/backups` (`backups.view`), `POST /api/backups` (`backups.create`) , `GET /api/backups/{id}/download` (`backups.download`) ·
`GET /api/system/status` (`system.status`): versión, BD, migración, espacio en disco, último respaldo.

## 7. Diseño (identidad visual v2 — nueva, no hereda la v1)

Concepto **"Mostrador clínico"**: sobrio, denso pero respirable, pensado para caja rápida con teclado.
- Paleta (tokens CSS en `web/src/styles/tokens.css`, modo claro y oscuro):
  - `--bg` #F6F5F1 (papel cálido), `--surface` #FFFFFF, `--surface-2` #EFEDE7, `--line` #DAD6CC
  - `--ink` #1B1F1D, `--ink-2` #4A524E, `--ink-3` #7A817D
  - `--brand` #0F5C4D (verde pino), `--brand-ink` #FFFFFF, `--brand-soft` #DCEBE6
  - `--ok` #1E7A46, `--warn` #A15C07, `--danger` #B42318, `--info` #1D5FA8 (+ variantes `-soft`)
  - Oscuro: `--bg` #121614, `--surface` #1A1F1C, `--ink` #ECEFEC, `--brand` #4FB39B …
- Tipografía: **Instrument Sans** (UI) y **JetBrains Mono** para montos/números de documento, con `font-variant-numeric: tabular-nums`.
- Layout: barra lateral fija estrecha (72px, iconos + etiqueta corta) y barra superior con estado de caja permanente; contenido máx 1440px.
- Componentes propios (sin librería de UI pesada): Button, IconButton, Input, MoneyInput, Select, Checkbox, Switch, Dialog, Drawer, Tabs, Table (ordenable, paginada), Badge/Stamp, Toast, EmptyState, Skeleton, KPI tile, CommandPalette (Ctrl+K).
- Iconos: `lucide-react`.
- Radios 6/10px, sombras mínimas, bordes 1px `--line`, foco visible 2px `--brand`.
- Accesible: contraste AA, navegación por teclado completa, `aria-live` para totales y toasts.

Rutas web: `/login`, `/cambiar-clave`, `/` (Resumen), `/cobrar`, `/recibos`, `/recibos/:id`, `/caja`, `/reportes`,
`/admin/catalogo`, `/admin/usuarios`, `/admin/ajustes`, `/admin/respaldos`, `/admin/auditoria`, `/ayuda`.
Atajos: Ctrl+K paleta, F2 nueva operación (foco en paciente), F4 cobrar, Esc cerrar.
Terminología: ver `docs/TERMINOLOGIA.md`.
