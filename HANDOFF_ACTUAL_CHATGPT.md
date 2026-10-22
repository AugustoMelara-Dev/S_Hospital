# HANDOFF_ACTUAL_CHATGPT.md — S_Hospital

> **Handoff autocontenido de la campaña vigente (2026-09-17).** Creado por
> `hs-release` en `M-W1-REL-01` y **refrescado en `M-W1-REL-02` con los hechos
> verificados de wave 2** (comprobante vertical, multicaja, preview fiel,
> rediseño estructural y estado de medición actual). Bajo
> `hospital-ai/MANDATO_DEFINITIVO.md` §23, §24.
>
> **Documentos de coordinación vigentes:** matriz §20 en
> `hospital-ai/progreso/MATRIZ_ACEPTACION.md`; tablero en
> `hospital-ai/progreso/TABLERO_MANDATO.md`; estado canónico en
> `reports/CURRENT_RELEASE_TRUTH.md`.
>
> **Leyenda de confianza.** Cada afirmación se marca:
> **[V]** verificado en este árbol por lectura de fuente/lockfile/comando
> ejecutado; **[I]** inferido o pendiente de verificación end-to-end; **[N]**
> no verificado (requiere hardware, VM, segunda PC, impresora o aprobación
> externa). No se incluyen credenciales ni valores de secretos. Estado canónico
> del release: `reports/CURRENT_RELEASE_TRUTH.md`.

---

## 1. Identidad del workspace y revisión

| Campo | Valor | Marca |
|---|---|---|
| Raíz escribible | `C:\Projects\S_Hospital_AI` (worktree aislado, detached) | [V] |
| Origen intocable | `C:\Projects\S_Hospital` (`source_repo`) | [V] |
| HEAD | `baa41f97310a578f8fd417a1e9b4b5d06c380670` | [V] |
| Rama | detached (`git branch --show-current` vacío) | [V] |
| Commits creados | 0 (sin commit/push/reset/clean) | [V] |
| Árbol | sucio por diseño: 274 rastreados modificados + 123 entradas no rastreadas (captura 2026-09-17 en REL-02; `M-W1-QA-01` midió 260+119 antes en la misma jornada) | [V] |
| Modelo | `opencode-go/deepseek-v4.1-flash` | [V] |
| Mandato vigente | `hospital-ai/MANDATO_DEFINITIVO.md` (§20, §23, §24) | [V] |
| Matriz §20 vigente | `hospital-ai/progreso/MATRIZ_ACEPTACION.md` | [V] |
| Tablero | `hospital-ai/progreso/TABLERO_MANDATO.md` | [V] |
| Evidencia REL-01 | `hospital-ai/evidencia/M-W1-REL-01/` | [V] |
| Evidencia REL-02 | `hospital-ai/evidencia/M-W1-REL-02/` | [V] |

- El conteo del árbol es una captura puntual: otras tareas wave 1/2 escriben en
  paralelo. Comando y salida cruda en
  `hospital-ai/evidencia/M-W1-REL-01/git-fingerprint-2026-09-17.log` y
  `hospital-ai/evidencia/M-W1-REL-02/`.
- `hospital-ai/WORKSPACE.json` registra `commits_created: 0` y
  `original_worktree_unchanged: true`.
- Documentos vivos relacionados: `hospital-ai/progreso/ESTADO.md`,
  `MATRIZ_ACEPTACION.md`, `TABLERO_MANDATO.md`, `AGENTES.jsonl`.

---

## 2. Stack y versiones (desde lockfiles reales)

### Backend [V]

| Componente | Versión |
|---|---|
| PHP (`composer.json` require) | `^8.2` |
| Laravel framework (`backend/composer.lock`) | `v12.62.0` |
| Laravel Sanctum | `^4.0` |
| Spatie Laravel Permission | `6.25.0` |
| barryvdh/laravel-dompdf | `v3.1.2` |
| phpoffice/phpspreadsheet | `^5.7` |
| pusher/pusher-php-server | `^7.2` |
| PHPUnit (dev) | `^11.5.50` |
| Larastan (dev) | `^3.10` |
| Laravel Pint (dev) | `^1.24` |
| Base de datos objetivo | MySQL/MariaDB (compose dev `mariadb:11`; prod `mariadb:11.4.3` fijada por digest) |

### Frontend [V]

| Componente | Versión |
|---|---|
| React / React DOM | `^19.0.0` |
| TypeScript | `5.9.3` |
| Vite | `^8.0.16` |
| Vitest | `^4.1.11` |
| @playwright/test | `^1.60.0` (playwright `^1.61.1`) |
| React Router DOM | `^7.18.3` |
| TanStack Query | `^5.100.10` |
| TanStack Table | `^8.21.3` |
| React Hook Form | `^7.76.0` |
| Zod | `^4.4.3` |
| Tailwind CSS | `^4.3.0` |
| laravel-echo / pusher-js | `^2.3.4` / `^8.5.0` |
| Recharts | `3.8.0` |
| lockfile canónico (dev compose) | `frontend/pnpm-lock.yaml` (`lockfileVersion: 9.0`) |

- **[I]/riesgo:** también existe `frontend/package-lock.json`, rastreado y no
  ignorado. El compose de desarrollo usa `pnpm install --frozen-lockfile`
  (`docker-compose.yml:136`), por lo que **pnpm es el gestor canónico declarado**;
  la convivencia de ambos lockfiles es deuda de consistencia (PENDIENTE de
  decisión/limpieza, fuera del alcance de esta tarea documental).

---

## 3. Arquitectura y servicios

### Compose de producción (`docker-compose.prod.yml`) [V]

| Servicio | Rol | Notas |
|---|---|---|
| `backend` | Laravel PHP-FPM + copia de `frontend/dist` a `shared_public` | `APP_ENV=production`, `APP_DEBUG=false`; migra solo si `RUN_MIGRATIONS=true` |
| `nginx` | Sirve `shared_public` y `/up` | imagen fijada por digest; puerto `APP_PORT` (8000) |
| `mysql` | MariaDB 11.4.3 fijada por digest | `innodb_strict_mode=ON`, `skip-name-resolve` |
| `queue-worker` | Cola `backups` (`queue:work --queue=backups`) | sin bind de copia externa (fail-closed) |
| `realtime-worker` | Cola `default` | eventos en tiempo real |
| `scheduler` | `schedule:run` cada 60 s + `hospital:scheduler-tick` | único servicio con bind `/external-backups` y variables de copia externa |
| `soketi` | WebSocket compatible Pusher (`laravel-echo`/`pusher-js`) | puerto 6001; en modo TLS debe bindearse a 127.0.0.1 |

- Compose de desarrollo (`docker-compose.yml`): backend con PHP CLI server
  multi-worker, `frontend` con Vite (`pnpm run dev`), `queue-worker`,
  `realtime-worker`, `scheduler`, `mysql` (`mariadb:11`).
- Overlay TLS/WSS opt-in: `docker-compose.tls.yml` + `nginx/tls.conf`
  (ver `docs/HTTPS_OPTIONAL.md`). **No activado por defecto.**
- TLS real (CA en clientes, firewall 443, retiro de 6001): **[N]**.

### Flujo de build/servido [V]

El contenedor `backend` copia el `public/` de Laravel y `frontend/dist` a
`/shared_public`, que nginx sirve en solo lectura. El frontend se compila en
build-time; **no hay recompilación por cambio de IP** (ver §10).

---

## 4. Esquema crítico

Tablas centrales declaradas en `AGENTS.md` [V]: `users`, `roles`, `permissions`,
`categories`, `services`, `invoices`, `invoice_items`, `payments`,
`cash_register_sessions`, `cash_movements`, `settings`, `audit_logs`, `backups`.
Además (nombres reales en el árbol): `areas`, `service_areas` (legacy),
`fiscal_settings`, `fiscal_sequences`, `receipt_print_profiles`,
`institutional_receipts`, `institutional_receipt_series`, `backup_logs`,
`backup_external_copies`, `operation_idempotency_keys`, `idempotency_keys`,
`scheduler_ticks`, `sessions`, `cache`, `jobs`, `failed_jobs`, `login_attempts`.

Nuevas de wave 2 (multicaja, mandato §7) [V]:

- **`cash_registers`** (`code` UNIQUE, `name`, `active`, timestamps). Dimensión
  explícita de caja física/terminal; el modo simple siembra `principal`
  (`CashRegisterSeeder`, `firstOrCreate`, no sobrescribe).
- **`cash_register_sessions.cash_register_id`** (FK → `cash_registers`,
  `RESTRICT`, **nullable** por compatibilidad; backfill por lotes a `principal`).
  Se conserva `unique(open_user_id)`: un usuario no mantiene dos sesiones abiertas.
- **`cash_register_sessions.open_marker`** + UNIQUE
  `(cash_register_id, open_marker)`: `1` si la sesión está abierta, `NULL` si
  cerrada. Permite N cerradas y **exactamente una abierta por caja**, reemplazando
  la restricción global histórica sin borrar el lock. Fail-closed: aborta si hay
  sesiones abiertas sin caja o duplicadas.

Migraciones recientes (2026-09-13 a 2026-09-17) [V]:

| Migración | Propósito |
|---|---|
| `2026_09_13_100001_add_monetary_coherence_check_constraints` | CHECK de coherencia monetaria |
| `2026_09_13_100002_enforce_fiscal_settings_singleton` | singleton fiscal |
| `2026_09_13_100003_enforce_active_receipt_profile_assignment_unique` | asignación activa única |
| `2026_09_13_100004_add_sequence_range_check_constraints` | rangos de serie |
| `2026_09_13_100005_add_payment_and_movement_method_check_constraints` | métodos de pago/movimiento |
| `2026_09_13_100006_add_paid_invoice_cash_session_check` | caja en facturas pagadas/parciales |
| `2026_09_13_200001_create_backup_external_copies_table` | ledger de copia externa |
| `2026_09_13_200002_add_verification_columns_to_backup_logs` | verificación de respaldos |
| `2026_09_13_210001/210002` | backfill `audit_logs.ip_address` + FK `user_id` RESTRICT |
| `2026_09_13_220001/220002` | áreas canónicas por slug + deprecación idempotency legacy |
| `2026_09_14_000001_add_legacy_reprint_count_to_invoices_table` | contador de reimpresión heredado |
| `2026_09_17_000001_create_cash_registers_table` | dimensión de caja física (M-W2-DB-01) |
| `2026_09_17_000002_add_cash_register_id_to_cash_register_sessions_table` | FK + backfill a `principal` (FK solo en MariaDB) |
| `2026_09_17_000003_add_open_marker_to_cash_register_sessions_table` | UNIQUE `(cash_register_id, open_marker)` |
| `2026_09_17_000004_stabilize_cash_session_opened_at_timestamp` | quita el `ON UPDATE current_timestamp()` implícito de `opened_at` |
| `2026_09_17_000005_extend_receipt_print_profiles_paper_kind_enum` | enum `paper_kind` 6→8 valores (`letter_portrait`, `a4_portrait`) + reapunta perfiles verticales |

- Las 6 migraciones de la OLA 1 (CHECKs/singleton/series/caja) se probaron y
  revirtieron en base desechable MariaDB, pero **su aplicación real sobre una
  instalación existente sigue pendiente** con preflight + ventana de
  mantenimiento (`docs/CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md` §1). [V]/[I]
- Zona horaria de conexión: `DB_TIMEZONE=-06:00` por defecto. [V]

---

## 5. Roles

Fuente: `backend/database/seeders/RolesAndPermissionsSeeder.php` [V]. Cuatro
roles sembrados más `admin`:

| Rol | Alcance principal |
|---|---|
| `admin` | todos los permisos |
| `supervisor` | facturación/caja/pagos/reportes/auditoría + `receipt_settings.view` |
| `auditor` | lectura fiscal/catálogo/facturas/caja/pagos/recibos/reportes/respaldos/auditoría |
| `soporte_tecnico` | `system.status.view`, `receipt_settings.view/update/advanced` |
| `cajero` | catálogo, facturas (`invoices.create`), caja (`cash.open/close`), pagos, recibos, reportes de caja, `patients.mark_dialysis_prescription` |

- `patients.mark_dialysis_prescription`: **el rol `cajero` lo tiene sembrado**
  (`RolesAndPermissionsSeeder.php:128`), pese a que el comentario histórico lo
  cuestiona. Es un hallazgo F008 documentado como decisión pendiente. [V]
- **Wave 2 no introdujo permisos nuevos** (`RolesAndPermissionsSeeder` sigue con
  los mismos 40 permisos): la conciliación consolidada por caja reutiliza
  `reports.managerial.view` (`ConsolidatedCashSessionRequest`), y la caja física
  reutiliza `cash.view/open/close/close_any`. [V]
- Matriz completa permiso→rol→endpoint: ver §6. Checks de denegación por rol con
  permisos reales del seeder: `LanEndpointAccessTest` 11/77 y `--filter=Security`
  37/203 (matriz §20).

---

## 6. Inventario de rutas y estados

### 6.1 Rutas frontend (`frontend/src/navigation/appNavigation.ts` + `AppRoutes.tsx`) [V]

| Ruta | Componente | Permiso(s) | Carga | Vacío | Error |
|---|---|---|---|---|---|
| `/` → `/dashboard` | redirect | — | — | — | — |
| `/dashboard` | `DashboardView` | autenticado | Sí (Skeleton/RouteState) | Sí | Sí |
| `/billing/new` | `NewInvoiceView` | `invoices.create`+`catalog.view`+`cash.view`+`payments.create`+`receipts.view` (all, con `PermissionGate`) | Sí (Suspense) | **PENDIENTE** | **PENDIENTE** |
| `/cashbox` | `CashBoxView` | `cash.view` | Sí | Sí | Sí |
| `/catalog` | `CatalogView` | `catalog.view` | Sí | Sí (`ServiceCatalogTable`) | Sí |
| `/invoices` | `InvoiceHistoryView` | `invoices.view` | Sí (Skeleton) | Sí | Sí (`loadError`) |
| `/reports/*` | `ReportsView` (subrutas executive/cash/audit) | `reports.managerial.view` \| `reports.cash_session.view` \| `audit.view` (any) | Parcial | Sí (subrutas) | Sí (subrutas) |
| `/backups` | `BackupsView` | `backups.view` | Sí | Sí | Sí |
| `/settings/fiscal` | `FiscalSettingsView` | `settings.fiscal.view` \| `settings.operational.update` (any) | **PENDIENTE** | **PENDIENTE** | **PENDIENTE** |
| `/settings/institutional-receipts` | `InstitutionalReceiptSettingsView` | `receipt_settings.view` | Sí | **PENDIENTE** | Sí |
| `/admin/users` | `UsersView` | `users.view` | Sí (Skeleton) | Sí | **PENDIENTE** |
| `/support` | `SupportCenterView` | autenticado (no listado en nav) | **PENDIENTE** | — | Sí (`Empty role=alert`) |
| `/help` | `HelpView` | autenticado | — | — | — |
| `/about` | `AboutView` | autenticado | — | — | — |
| `*` | `NotFoundView` | — | — | — | n/a |

- `receiptSettings` tiene `navigation: false` salvo para un perfil con
  `receipt_settings.view` sin `settings.fiscal.view`
  (`shouldExposeReceiptSettingsNavigation`). [V]
- **Rediseño wave 2 (M-W2-FE-01/02/03):** tokens v2, POS con columna estable,
  historial+detalle, shell con usuario/caja/conexión y caja; `M-W2-FE-02`
  entregado y en revisión de coordinación. Incluye el fix real de seguridad §10:
  un `Enter` suelto **ya no** registra el pago, solo `Ctrl/Cmd+Enter`
  (`frontend/src/features/invoices/components/PaymentModal.tsx:219-228`,
  `InvoiceConfirmation.tsx`), con regresión en tests. [V]
- Las celdas **PENDIENTE** significan "no se encontró estado de carga/vacío/error
  en el barrido de esta tarea"; `M-W2-FE-02` entregó las superficies, pero el
  estado por celda no se re-midió aquí. La responsabilidad de cerrarlas es de
  `hs-frontend` (mandato §9). [I]

### 6.2 Endpoints API (`backend/routes/api.php`) y permiso exigido [V]

Permiso entre paréntesis = verificado en FormRequest/Policy/controlador.

**Públicos**

| Método y ruta | Permiso |
|---|---|
| `GET /api/health` | público |
| `GET /api/system/health` | público (liveness: status/service/version) |
| `POST /api/system/csp-report` | público (throttle) |
| `GET /api/settings/logo`, `/logo/file`, `/settings/branding` | público |
| `POST /api/auth/login` | público (LoginLockout) |
| `GET /api/auth/session` | web |

**Autenticados (auth:web + user.active)**

| Método y ruta | Permiso |
|---|---|
| `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout` | autenticado |
| `GET /api/system/health/detail` | `system.status.view` |
| `GET /api/system/echo-config` | autenticado (**permiso específico no verificado — PENDIENTE M-W1-SEC-01**) [I] |
| `GET /api/system/setup-status` | autenticado (**ídem**) [I] |
| `GET /api/system/openapi` | autenticado (sin permiso específico en ruta) [I] |

**Configuración (password.changed)**

| Método y ruta | Permiso |
|---|---|
| `GET /api/settings/operational` | autenticado (**sin permiso específico verificado**) [I] |
| `PUT /api/settings/operational` | `settings.operational.update` |
| `GET /api/settings/fiscal` | `settings.fiscal.view` |
| `PUT /api/settings/fiscal` | `settings.fiscal.update` |
| `POST /api/settings/logo` | `settings.fiscal.update` |
| `GET /api/fiscal-sequences` | `settings.fiscal.view` |
| `POST /api/fiscal-sequences` | `settings.fiscal.update` |
| `PATCH /api/fiscal-sequences/{id}` | `settings.fiscal.update` (+ `fiscal.sequences.reset` para correlativo) |
| `GET /api/settings/institutional-receipts` | `receipt_settings.view` |
| `PUT /api/settings/institutional-receipts/institution` | `receipt_settings.update` |
| `GET /api/settings/institutional-receipts/series` | `receipt_settings.view` |
| `POST`/`PATCH /api/settings/institutional-receipts/series[/{series}]` | `receipt_settings.update` |
| `GET /api/settings/institutional-receipts/print-profiles` | `receipt_settings.view` |
| `PATCH .../print-profiles/{profile}` | `receipt_settings.update` (+ `receipt_settings.advanced` para campos avanzados) |
| `PUT .../assignments` | `receipt_settings.update` |
| `POST .../test-preview` | `receipts.print_test` \| `receipt_settings.update` — devuelve el **HTML real del motor** (misma fuente blade/dompdf que el PDF), `reserved_number=false` y `next_receipt_number`; **no consume correlativo**. El frontend lo renderiza en `<iframe sandbox="">` con `srcDoc` (`ReceiptSettingsPreview.tsx`). [V] |
| `POST .../test-print` | `receipts.print_test` \| `receipt_settings.update` |

**Recibos institucionales**

| Método y ruta | Permiso |
|---|---|
| `POST /api/institutional-receipts` | `receipts.view` + `payments.create` (idempotency) |
| `GET /api/institutional-receipts/{receipt}/pdf` | `receipts.view` (servicio) |
| `POST /api/institutional-receipts/{receipt}/pdf` | `receipts.reprint` (+ `receipts.reprint_any`; idempotency) |
| `POST /api/institutional-receipts/{receipt}/print-events` | `receipts.view` (idempotency) |

**Catálogo**

| Método y ruta | Permiso |
|---|---|
| `GET /api/categories` | `catalog.view` |
| `POST /api/categories` | `catalog.manage` (Policy create) |
| `PATCH /api/categories/{category}` | `catalog.manage` (Policy update) |
| `GET /api/areas` | `catalog.view` \| `reports.managerial.view` |
| `GET /api/service-areas` | `catalog.view` (controlador) |
| `POST`/`PATCH /api/service-areas[/{id}]` | `catalog.manage` |
| `GET /api/services` | `catalog.view` |
| `POST`/`PATCH`/`DELETE /api/services[/{service}]` | `catalog.manage` |

**Facturación y pagos**

| Método y ruta | Permiso |
|---|---|
| `GET /api/invoices` | `invoices.view` |
| `POST /api/invoices` | `invoices.create` (idempotency) |
| `GET /api/invoices/{invoice}` | `invoices.view` |
| `POST /api/invoices/{invoice}/void` | `invoices.void` (idempotency) |
| `POST /api/invoices/{invoice}/reverse` | `invoices.reverse` (idempotency) |
| `POST /api/invoices/{invoice}/payments` | `payments.create` (idempotency) |
| `GET /api/invoices/{invoice}/payments` | `payments.view` \| `payments.create` |
| `POST /api/invoices/{invoice}/payments/{payment}/void` | `payments.void` (idempotency) |
| `POST /api/payments/{payment}/void` | `payments.void` (idempotency) |
| `GET /api/invoices/{invoice}/receipt` | `receipts.view` |
| `POST /api/invoices/{invoice}/reprint` | `receipts.reprint` (+ `receipts.reprint_any`) |

**Caja**

| Método y ruta | Permiso |
|---|---|
| `GET /api/cash-sessions/current` | `cash.view`; filtra por `cash_register_id` y por usuario (salvo `cash.close_any` con `scope=closable`) |
| `GET /api/cash-sessions/consolidated` | `reports.managerial.view` (`ConsolidatedCashSessionRequest`, rango ≤31 días, `cash_register_id` opcional) |
| `POST /api/cash-sessions/open` | `cash.open` (idempotency); resuelve/crea la caja del registro |
| `POST /api/cash-sessions/{cashSession}/close` | `cash.close` \| `cash.close_any` + `Gate::authorize('close')` (idempotency) |
| `GET /api/cash-sessions` | `cash.view`; filtra por usuario, `status` y `cash_register_id` (scope `closable` requiere `cash.close_any`) |

**Reportes y sistema**

| Método y ruta | Permiso |
|---|---|
| `GET /api/reports/dashboard` | `reports.managerial.view` |
| `GET /api/reports/today` | `reports.view` \| `cash.view` \| `invoices.view` |
| `GET /api/reports/executive` | `reports.managerial.view` \| `reports.cash_session.view` |
| `GET /api/reports/executive/pdf`, `/excel` | `reports.export` + (managerial \| cash_session) |
| `GET /api/reports/daily`, `/monthly` | `reports.managerial.view` |
| `GET /api/reports/income`, `/categories`, `/areas`, `/services`, `/operations` | (managerial \| cash_session) |
| `GET /api/reports/export` | `reports.export` |
| `GET /api/reports/pdf` | `reports.export` + (managerial \| cash_session) |
| `GET /api/reports/cash-sessions/{cashSession}` | `cash.close_any` \| `reports.cash_session.view` \| `reports.managerial.view` |
| `GET /api/system/status-summary` | autenticado (**permiso específico no verificado**) [I] |
| `GET /api/system/status` | `system.status.view` |
| `GET /api/system/audit-logs` | `audit.view` |
| `POST /api/system/client-errors` | autenticado |
| `GET /api/backups` | `backups.view` |
| `POST /api/backups` | `backups.view` + `backups.create` (idempotency) |
| `GET /api/backups/{backupLog}/download` | `backups.view` + `backups.download` |
| `GET /api/admin/users` | `users.view` |
| `POST /api/admin/users` | `users.create` |
| `PATCH /api/admin/users/{user}` | `users.update` |
| `POST /api/admin/users/{user}/toggle-active` | `users.disable` |
| `POST /api/admin/users/{user}/reset-password` | Policy `resetPassword` |
| `GET /api/admin/roles` | `users.view` |
| `POST`/`PATCH /api/admin/roles[/{role}]` | `users.assign_admin_role` |

- Los endpoints sensibles están bajo `throttle.user:*` y `password.changed`
  donde corresponde. [V]

---

## 7. Flujos de caja

Flujo verificable por fuente (mandato §11) [V]/[I]:

1. **Abrir caja:** `POST /api/cash-sessions/open` (`cash.open`, idempotency).
2. **Atender:** identificación mínima del paciente (solo nombre obligatorio),
   búsqueda/selección de servicios, cantidades, revisión.
3. **Cobrar:** `POST /api/invoices` (`invoices.create`) y
   `POST /api/invoices/{invoice}/payments` (`payments.create`), ambos con
   middleware `idempotency`; el servidor decide totales.
4. **Emitir recibo:** `POST /api/institutional-receipts` o
   `GET/POST /api/invoices/{invoice}/receipt`.
5. **Cerrar:** `POST /api/cash-sessions/{cashSession}/close` con arqueo;
   `Gate::authorize('close')` valida `cash.close`/`cash.close_any` y autoría.
6. **Conciliación:** `GET /api/reports/cash-sessions/{cashSession}` (por sesión) y
   `GET /api/cash-sessions/consolidated` (consolidado por caja física,
   `reports.managerial.view`).

- **Multi-caja (wave 2, mandato §7):** el modelo pasó de una restricción global
  a un guard del alcance correcto: `cash_registers` + UNIQUE
  `(cash_register_id, open_marker)`. **El default del sistema sigue siendo UNA
  caja** (`principal`); habilitar puestos adicionales es agregar filas, no
  rediseñar el dominio. [V]
- **Concurrencia real medida (MariaDB, procesos/conexiones independientes):**
  `--group=concurrent` 6 tests / 32 aserciones — 2 aperturas de la misma caja
  (1 gana), cajas distintas (ambas ganan, tras corregir deadlock InnoDB 1213),
  mismo usuario bloqueado, cierre vs cobro ×3, retry con misma `Idempotency-Key`
  → replay 1 sesión/1 movimiento (matriz §20, M-W2-FIN-01). [V]
- **Pendiente:** total consolidado multi-caja en la UI/regresión 403 real
  (M-W2-FIN-02, en curso). Segunda máquina física: **[N]**. [I]

---

## 8. Contratos monetarios

- **Aritmética entera, sin floats**, para montos; totales y snapshots los decide
  el backend (mandato §11, `AGENTS.md`). [V]
- `invoice_items` guarda snapshots de precio/nombre; nunca se recalculan facturas
  históricas desde el catálogo actual. [V]
- Constraints de coherencia monetaria en migraciones
  `2026_09_13_100001`/`100004`/`100005`/`100006` (CHECKs, series, métodos, caja en
  facturas pagadas/parciales), probadas en base desechable MariaDB. [V]
- Idempotencia: middleware `idempotency` en emisión de facturas, pagos,
  anulaciones, apertura/cierre de caja, recibos y respaldos; tablas
  `idempotency_keys` (canónica) y `operation_idempotency_keys` (legacy,
  `@deprecated`, retiro diferido F014). [V]
- Reglas de negocio no negociables en `AGENTS.md`: nombre de paciente en factura,
  eritropoyetina (L.25, gratis con receta de diálisis), recibos institucionales
  PDF/papel, anulación con permiso+motivo+auditoría, no borrar facturas. [V]
- **[I]:** La exactitud de aritmética en todos los caminos sólo queda demostrada
  por las suites; su corrida actual está en curso (§12).

---

## 9. Impresión y plantilla

Fuente: `backend/database/seeders/ReceiptPrintProfileSeeder.php`,
`InstitutionalReceiptPdfService`, `backend/app/Support/PaperSize.php`,
migración `2026_09_17_000005`, `docs/print-profiles.md`. [V]

| Perfil sembrado (`code`) | Papel | Orientación | Copias (`copies_mode`) | Activo |
|---|---|---|---|---|
| `custom_small` | 180×95 mm | landscape | `original_only` | no |
| `half_letter` | 215.9×139.7 mm | landscape | `original_first_second` | **sí (global default)** |
| `a5` | 210×148 mm | landscape | `original_only` | sí |
| `letter` | 279.4×215.9 mm | landscape | `original_only` | sí |
| `carta_vertical` | **215.9×279.4 mm = 612×792 pt** (`letter_portrait`) | portrait | `original_first_second` | **sí (no global default)** |
| `a4_vertical` | **210×297 mm = 595.28×841.89 pt** (`a4_portrait`) | portrait | `original_only` | sí |
| `thermal_80` | 80×200 mm | portrait | `original_only` | no |
| `thermal_58` | 58×200 mm | portrait | `original_only` | no |

- **Perfiles nuevos (mandato §12):** `carta_vertical` (612×792 pt, márgenes 12 mm)
  es el diseño principal propuesto para instalación nueva; `a4_vertical`
  (595.28×841.89 pt) es la alternativa configurable. Ambos nacen **activos pero
  no se promueven silenciosamente a default global**: la instalación ya sembrada
  conserva media carta como default y promover carta vertical es acción explícita
  del admin (`receipt_settings.update`, default único). [V]
- **`paper_kind` nativo:** la migración `2026_09_17_000005` expande el enum de 6 a
  8 valores (`letter_portrait`, `a4_portrait`) y reapunta de forma idempotente los
  perfiles sembrados solo si su geometría coincide; `PaperSize` unifica la
  conversión mm→pt. `down()` no destruye datos si hay filas con los valores nuevos. [V]
- **PDFs reales del motor (M-W2-RCP-01, evidencia `M-W2-RCP-01/dimensions.txt`):**
  carta vertical **612.00×792.00 pt** y A4 **595.28×841.89 pt**, casos corto,
  largo (15 páginas), cero, anulado y reimpreso. Los marcadores de texto
  (`pdf-text-markers.txt`) muestran **ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA** y
  **"REIMPRESIÓN #2"** (extracción del texto del PDF; la tilde se pierde en la
  extracción, no en el PDF). [V]
- **Preview fiel (M-W2-RCP-02):** `POST .../test-preview` devuelve el HTML real del
  motor; el iframe `sandbox=""` del frontend lo muestra sin scripts. **No consume
  correlativo**: con `current_number=7`, la respuesta da `next_receipt_number=8` y
  `reserved_number=false`. [V]
- Plantilla: `template_code = institutional_classic`, fuente Arial, escalas por
  perfil; `show_copy_legend`, `show_physical_seal_space`, `use_logo=false`. [V]
- `firstOrCreate` no sobreescribe perfiles existentes: instalaciones ya sembradas
  conservan su configuración. Los recibos snapshotan el modo vigente al emitirse. [V]
- Reimpresión: contador persistente (`invoices.legacy_reprint_count`), motivo
  humano backend, marca visible; `pdf` on-demand (F018: no hay PDF firmado
  persistido). [V]
- **Límite:** impresión física real, márgenes, área imprimible, cancelación y
  popup bloqueado en hardware: **[N]** (sin impresora). Los PDFs/tamaños/páginas
  anteriores son evidencia lógica del motor, no prueba de papel. [N]

---

## 10. Modelo de operación LAN

- **Dos modos, un producto:** servidor+navegador en una PC, o servidor local con
  varias PCs cliente por navegador; base de datos central. [V]/[I]
- El frontend se sirve same-origin (nginx sirve `shared_public`); origen/API/
  cookies/realtime se derivan de `SERVER_IP`, `APP_SCHEME`, `APP_PORT`
  (`docker-compose.prod.yml:22,55-67`), por lo que **no se recompila el frontend
  por cada dirección LAN**. [V]
- `SANCTUM_STATEFUL_DOMAINS` y `CORS_ALLOWED_ORIGINS` se derivan de esas variables
  (fail-closed si están mal). [V]
- Soketi en 6001 para eventos en tiempo real; un fallo de WebSocket no cambia la
  verdad financiera (mandato §6). [V]/[I]
- Página de estado: `GET /api/system/status` (`system.status.view`) y
  `status-summary` exponen modo, dirección de acceso y diagnóstico. [V]
- **Separación de cajas por caja física:** probada con procesos/conexiones
  independientes en MariaDB (matriz §20, M-W2-FIN-01); en el modo LAN la caja se
  resuelve por `cash_register_id`, no por el ID que envíe el navegador. [V]
- Segunda PC real, login/refresh/cobro/PDF/reportes/backup sin WAN y
  reconexión: **[N]** (solo contextos de navegador). La matriz §20 marca LAN
  como PARTIAL: separación de cajas sí, segunda máquina física no.

---

## 11. Instalación

- Runbook de operador: `docs/OFFLINE_LAN_INSTALL.md`; build del instalador:
  `docs/GENERAR_INSTALADOR_WINDOWS.md`; licencia de runtime:
  `docs/OFFLINE_RUNTIME_LICENSE.md`; integridad offline:
  `docs/OFFLINE_RELEASE_INTEGRITY.md`. [V]
- Scripts: `scripts/deploy_hospital_lan.ps1`,
  `scripts/production_readiness_preflight.ps1`,
  `scripts/load_offline_images.ps1`, `scripts/make_offline_release.ps1`,
  `installer/S_Hospital.iss`. [V]
- `installer-output/` **no existe**; no hay `.exe` candidato ni hash. [V]
- La decisión de licencia de Docker Desktop (gubernamental) queda documentada y
  **pendiente institucional**; no se compró ni se cambió el SO. [I]
- VM Windows limpia, instalación offline desde cero, reinicio, UAC y
  desinstalación: **[N]**. `qa/pre-installation-final/windows-clean/RESULT.json`
  está en `PENDING` y refiere otro commit.

---

## 12. Backup y restore

- Runbooks: `docs/BACKUP_RESTORE.md`, `docs/SAFE_UPDATE_ROLLBACK.md`,
  `docs/DISASTER_RECOVERY.md`, `docs/HTTPS_OPTIONAL.md`. [V]
- Worker de respaldos (cola `backups`) + scheduler (tick cada 60 s); guard
  pre-migración (`VerifyMigrationBackupCommand`, ventana 72 h). [V]
- Copia externa cifrada: ledger `backup_external_copies`, verificación,
  key_identifier y guard fail-closed de destino. **No desplegada**:
  `HOSPITAL_BACKUP_EXTERNAL_ENABLED=false`; bind por defecto `./backup-external`
  (mismo host). [V]
- Custodia de claves (`HOSPITAL_BACKUP_ENCRYPTION_KEY`, `APP_KEY`) y RPO/RTO:
  decisión externa pendiente; **no se copian cifras históricas** sin recalcular. [V]/[N]
- Restore real en hardware objetivo y reconciliación de correlativos posterior:
  **[N]**; `M-W1-REC-01` aceptado, pero su drill real con contenedor quedó
  `BLOQUEADO_EXTERNO` (daemon Docker apagado). 10 suites PowerShell exit 0.

---

## 13. Pruebas y artefactos

- Evidencia acumulada: `hospital-ai/evidencia/T1-*`, `T2-*`, `T3-*`, `T4-*`,
  `M-W1-*`, `M-W2-*`, `qa/`, `qa/pre-installation-final/`. Revisión independiente
  en `hospital-ai/evidencia/revisiones/`. [V]
- Estados **medidos el 2026-09-17** (fuente `M-W1-QA-01/INFORME.md` y
  `logs/`). **No son definitivos: varios están en reparación** y el árbol sigue
  cambiando, por lo que no se fijan como PASS de cierre:

| Comprobación | Medido 2026-09-17 | Estado |
|---|---|---|
| Backend SQLite (`phpunit.xml`) | Tests 1194 / Assertions 8197 / Skipped 57 / 0 fallos (exit 0) | **PASS medido** |
| Backend MariaDB (`phpunit.mysql.xml`) | Tests 1198 / Assertions 8384 / **6 errors + 2 failures** / 11 skipped (exit 2) | **FAIL — en reparación (M-W1-QA-02)** |
| Driver efectivo | SQLite `3.39.2`; MariaDB `10.4.32` (`probe_driver.php` + `DatabaseDriverGuardTest` in-process) | **PASS medido** |
| Frontend typecheck / lint / build | exit 0; `built in 4.56s` | **PASS medido** |
| Frontend tests | **166 archivos / 1258 tests** (1256 unidad jsdom + 2 storybook chromium) | **PASS medido** |
| Bundle budget | Inicio 218.8 KiB gzip (límite 488.3) | **PASS medido** |
| E2E mock (Playwright) | **44 passed / 5 failed** (specs obsoletas) | **FAIL — en reparación (M-W1-QA-02)** |
| Pint / PHPStan / audits | — | **NOT VERIFIED** (no incluidos en esa corrida) |

- **MariaDB 10.4.32 (XAMPP) local no es paridad** con la imagen `mariadb:11.4.3`
  de CI/compose (daemon Docker apagado). La suite MariaDB se corrió contra 10.4.32;
  el resultado puede variar en 11.4.3. [V]
- **Dos clases de fallo MariaDB:** 6 errores por **contaminación de orden**
  (`RefreshDatabase` + DDL con commit implícito; pasan aislados) y **2 fallos
  reales**, uno de ellos la regresión 403 de
  `InstitutionalReceiptPaymentIntegrationTest:137` dependiente de driver/fecha
  (`COORD-11`, en reparación por M-W2-FIN-02). [V]
- **E2E:** `44/5` con `print-profiles.spec.ts` (selector `/^Carta\b/i` ambiguo por
  "Carta horizontal" vs "Carta vertical"), `backups-flow` (heading/endpoint
  desactualizados) y 2 specs de fecha/catálogo; specs obsoletas a reparar, no
  borrar (COORD-09). [V]
- Gates de CI `backend-mariadb` y `e2e-mocked` están **rojos** con el árbol
  actual: bloquean cualquier declaración de "verde" de la campaña. [V]
- No se reutilizan cifras de campañas previas como actuales. Cualquier cambio
  posterior en el árbol invalida las pruebas afectadas (mandato §19). [V]
- **Verificación de concurrencia/RBAC/seguridad con evidencia real:** matriz §20
  (`hospital-ai/progreso/MATRIZ_ACEPTACION.md`) — Security 37/203 PASS, concurrencia
  MariaDB 6/32 PASS, LAN PARTIAL, impresión PARTIAL. [V]

---

## 14. Hallazgos cerrados / abiertos

- Registro: `hospital-ai/progreso/HALLAZGOS.json` (F001…F035) y
  `docs/CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md`. [V]
- Cerrados/decididos (histórico de campaña): F013/F017 (constraints, pendiente de
  aplicación real), F014/F015/F016/F018 (retiros diferidos), F019/F020, entre
  otros. [V]
- Abiertos de mandato vigente: F008 (autorización EPO), F011 (multicaja),
  F002 (copias por recibo), F010 (adopción TLS), HS-BK-KEY (custodia de claves),
  HS-BK-RPO (RPO/RTO), F009 (firma de código), F015 (retención), bare-metal,
  destino externo, F031 (MFA). [V]
- **Cerrados/entregados en wave 2:** perfil carta vertical/A4 con PDFs reales
  (M-W2-RCP-01/02/03); multicaja con guard por caja (M-W2-DB-01, M-W2-FIN-01);
  `opened_at` ya no se corrompe al cerrar (M-W2-DB-02, `COORD-07`);
  white-on-white HIGH corregido con test (M-W2-FE-01); **Enter suelto ya no cobra**
  (M-W2-FE-02). [V]
- **Abiertos en reparación (declarados, no inventados):** `COORD-11` regresión 403
  real en MariaDB (M-W2-FIN-02); `COORD-12` job MariaDB rojo por contaminación de
  orden y `COORD-13` `tests/Concurrent` sin testsuite (M-W1-QA-02); `COORD-09`
  specs E2E obsoletas (M-W1-QA-02); `COORD-04` check global de caja remanente en
  `OpenCashSessionAction` (en corrección). [V]
- **Deuda de higiene:** lockfiles duales frontend (`COORD-06`, pnpm canónico +
  `package-lock.json` residual); `frontend/.env.production` versionado/des-ignorado
  en `.dockerignore:42` con valor actual público/vacío (SEC-01-F1). [V]

---

## 15. Archivos y símbolos relevantes

| Tema | Archivo/símbolo |
|---|---|
| Rutas frontend | `frontend/src/navigation/appNavigation.ts`, `frontend/src/AppRoutes.tsx`, `frontend/src/components/PermissionGate.tsx` |
| Rutas API | `backend/routes/api.php` |
| Roles/permisos | `backend/database/seeders/RolesAndPermissionsSeeder.php`, `backend/app/Policies/*` |
| Caja | `backend/app/Http/Controllers/CashSessionController.php`, `backend/app/Http/Requests/Cash/ConsolidatedCashSessionRequest.php`, `backend/app/Policies/CashSessionPolicy.php`, `frontend/src/features/cash/CashBoxView.tsx` |
| Multicaja | `backend/database/seeders/CashRegisterSeeder.php`, migraciones `2026_09_17_000001..000004`, `backend/app/Models/CashRegister.php` |
| Facturación/pagos | `backend/app/Actions/Billing/*`, `backend/app/Http/Requests/Billing/*`, `backend/app/Http/Requests/Payments/*`, `frontend/src/features/invoices/components/PaymentModal.tsx` (fix Ctrl/Cmd+Enter) |
| Recibos | `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptPdfService.php`, `backend/database/seeders/ReceiptPrintProfileSeeder.php`, `backend/app/Support/PaperSize.php`, `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx` (iframe `sandbox=""`), `docs/print-profiles.md` |
| Respaldos | `backend/app/Actions/Backups/*`, `backend/config/backups.php`, `docker-compose.prod.yml` (servicio `scheduler`) |
| Recuperación | `scripts/maintenance_hospital_windows.ps1`, `scripts/restore_hospital_windows.ps1`, `scripts/lib/recovery_*.ps1` |
| Instalación | `scripts/deploy_hospital_lan.ps1`, `installer/S_Hospital.iss`, `docs/OFFLINE_*.md` |
| Estado/health | `backend/app/Http/Controllers/HealthController.php`, `SystemStatusController.php` |
| Compose | `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.tls.yml` |
| Diseño | `hospital-ai/diseno/TOKENS_V2.md`, `CONTRATO_PANTALLAS_V2.md`, `CRITERIOS_RECIBO_V2.md` |
| Estado | `reports/CURRENT_RELEASE_TRUTH.md`, `hospital-ai/progreso/*` |

---

## 16. Comandos y dependencias externas

Comandos base (`AGENTS.md`) [V]:

```
docker compose up -d
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
```

- Gestor de paquetes canónico frontend: **pnpm** (compose dev usa
  `pnpm install --frozen-lockfile`); backend: Composer. [V]
- Imágenes externas fijadas por digest: `nginx:1.25.4-alpine`,
  `mariadb:11.4.3`, `quay.io/soketi/soketi:1.6-16-alpine`. [V]
- Dependencias externas que bloquean comprobaciones: daemon Docker (por
  verificar), impresora física, segunda PC/VM, certificado de firma, destino
  USB/NAS, licencia Docker Desktop. Todas **[N]** y documentadas como pendientes;
  no se declara certificación.

---

## 17. Cómo congelar (procedimiento; NO ejecutado en REL-02 ni en C1-REL-01)

Procedimiento que se usará al final de la campaña. **No se ejecuta aquí** y no
declara nada por sí mismo. `C1-REL-01` dejó listo el *instrumento* (manifiesto
de producto + prueba de reconstrucción, ver paso 2) pero **no** ejecutó la
congelación: 5 tareas seguían escribiendo.

1. **Detener escritores.** Confirmar que ninguna tarea wave 1/2 sigue escribiendo
   en el worktree (checkpoint/cierre); sin esto no hay congelación válida.
2. **Fingerprint del árbol.** Registrar en
   `hospital-ai/evidencia/<tarea-de-congelacion>/`:
   - `git rev-parse HEAD` (SOURCE_COMMIT);
   - conteo y volcado de `git status --porcelain`;
   - hash del diff rastreado: `git diff HEAD --binary > f; git hash-object f`
     *(corrección C1-REL-01: el comando sin `HEAD` compara índice contra
     worktree y, con el índice vacío, devuelve vacío — no es el fingerprint);*
   - `git diff --stat` y lista de archivos no rastreados relevantes.
   - **[C1-REL-01] Instrumento ya disponible:** `hospital-ai/release/` contiene
     el manifiesto de producto reproducible (420 entradas con SHA-256 completo),
     el parche binario, la instantánea de alcance y
     `tools/{generar_manifiesto,verificar_manifiesto,reconstruir_y_verificar,
     inventario_no_rastreados,esperar_estabilidad}.py`. Usar
     `esperar_estabilidad.py` para verificar la precondición 1 (que nadie
     escriba) antes de declarar una congelación. Procedimiento en
     `hospital-ai/release/README_MANIFIESTO.md`; resultado medido y limitaciones
     en `hospital-ai/evidencia/C1-REL-01/INFORME.md`.
3. **Construir el candidato una sola vez.** `scripts/make_offline_release.ps1`
   (imágenes/tars) y `scripts/build_windows_installer.ps1` (ISCC). **No volver a
   compilar** después.
4. **Manifiesto del candidato.**
   `scripts/certification/regenerate_candidate_manifest.ps1 -ProjectRoot .`
   lee `SOURCE_COMMIT` con `git rev-parse HEAD` y registra el **SHA-256 y tamaño
   reales** del `.exe`; sin binario queda
   `BLOCKED_ON_ISCC_NOT_AVAILABLE`, y con binario
   `BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION`.
5. **Prueba en Windows limpio (humana, sin recompilar).** Registrar y cerrar con
   `scripts/certification/record_windows_clean_test.ps1` +
   `finalize_windows_clean_result.ps1`; validar con
   `scripts/certification/validate_windows_clean_result.ps1`. El validador exige
   `RESULT.json` con los campos/checks completos; hoy está en `PENDING`.
6. **Promover solo con PASSED.** `scripts/certification/promote_to_usb.ps1` no
   invoca ISCC, exige un `RESULT.json` con `status = PASSED`, verifica que el
   SHA-256 de la copia coincide con el manifiesto y re-verifica origen/destino.

**Hashes a calcular:** `SOURCE_COMMIT`; SHA-256 y bytes del
`S_Hospital-Instalador.exe`; SHA-256 de los `offline-images/*.tar`; hash del diff
rastreado; hash de `MANIFIESTO_PRODUCTO.json` (C1-REL-01) y de
`CANDIDATE-MANIFEST.json`. **Un hash junto a un archivo no es
firma/autenticidad** (mandato §16).

**Qué NO declarar en la congelación:** `PRODUCTION_READY` ni certificación sin
`RESULT.json` con evidencia real de VM; no reutilizar la certificación de otro
binario; no editar `RESULT.json` a mano; no promover USB sin PASSED; no marcar
impresora/LAN/firma como PASS; no copiar RTO/RPO de campañas previas.

---

## 18. Notas de honestidad

- Este handoff **no certifica** el producto. Remite a
  `reports/CURRENT_RELEASE_TRUTH.md`, donde los cuatro estados del mandato se
  reportan por separado y lo físico queda **NOT VERIFIED**.
- Las cifras del árbol y de las corridas son capturas fechadas; el árbol es un
  objetivo móvil mientras wave 1/2 siguen activas.
- **Refresh REL-02 (2026-09-17):** incorpora hechos verificados de wave 2
  (comprobante vertical, multicaja, preview fiel, rediseño y fix §10). Lo aún
  medido-en-reparación se rotula así y **no se fija como definitivo**; la matriz
  §20 vigente es `hospital-ai/progreso/MATRIZ_ACEPTACION.md`.
- No se incluyen credenciales, tokens ni valores de `.env`; sólo nombres de
  variables.
