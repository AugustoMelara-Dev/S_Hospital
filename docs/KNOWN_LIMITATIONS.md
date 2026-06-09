# Known limitations

## Estado v1.0.0 (2026-06-02)

### Cerradas en v1.0.0

- ~~Restore MySQL/MariaDB local validado~~ (Fase 11 v1.0.0-rc.3)
- ~~Concurrencia MySQL/MariaDB local validada~~ (Fase 11 v1.0.0-rc.3)
- ~~E2E local Playwright verde~~ (Fase 10 v1.0.0-rc.3)
- ~~Hardening headers HTTP, CSP, rate limit, lockout, login
  attempts, CSP report endpoint, health endpoint~~ (Fases 7-19 rc.3)
- ~~Centavos en facturas y pagos con backfill~~
  (Fase A2.1, A2.2 rc.3)
- ~~Secrets playbook + pre-commit guard + sin defaults dev en
  .env.example~~ (Fase A1 v1.0.0)
- ~~HTTPS opcional con CA local + nginx con TLS~~
  (Fase A3 v1.0.0)
- ~~CORS/SANCTUM sin Vite dev port en prod~~ (Fase A4 v1.0.0)
- ~~TanStack Query invalidations multi-PC LAN~~
  (Fase B1 v1.0.0)
- ~~apiClient timeout + CSRF reset + Set handlers~~
  (Fase B4 v1.0.0)
- ~~phpstan nivel 5~~ (Fase C5 v1.0.0)

### Pendientes para v1.1

- **NewInvoiceView refactor**: ~490 lineas, objetivo <200 con
  sub-reducers por paso (paciente / servicio / revision / pago).
  Diferido por tamaño del cambio; cubierto por E2E.
- **Cobertura >80% en modulos criticos**: gate opt-in via
  `--with-coverage`. Falta promover a obligatorio en CI.
- **Auditoria de cambios de permisos**: Spatie Activitylog ya
  registra; falta listener para `Role::attachPermission` /
  `detachPermission` y `User::roleChanged`.
- **Rate limit por usuario**: middleware `ThrottleByUser` en
  `/api/invoices`, `/api/payments`, `/api/cash-sessions`.
- **Health dashboard admin**: UI con Recharts para latencia P50/
  P95/P99, conexiones DB, espacio disco, ultimo backup.
- **Stack auto-start en reboot**: tarea Windows
  `SistemaCajaHospitalaria-StackAutostart` con trigger
  `AtStartup`.
- **Comando `hospital:maintenance`**: para poner el sistema en
  estado de "en mantenimiento" durante incidentes.
- **Deprecacion de `install_hospital_os.ps1`**: marcar como legacy;
  el installer soportado es `deploy_hospital_lan.ps1`.
- **IP detection robusta**: usar `Get-NetRoute` con metrica y
  multiples adaptadores; eliminar placeholder `192.168.1.100`.
- **`database/schema_extensions_for_barcode_reports.sql`**:
  referencia a columna `source_hash` que no existe. Mover a
  `_reference_DO_NOT_EXECUTE/` o convertir a migracion Laravel.
- **ESLint warnings a error**: 28 warnings documentados en FASE B5
  para promover a error en v1.1.
- **CSP report channel opcional**: validar que
  `/api/system/csp-report` esta implementado y acepta reportes.

### Pendientes de entorno fisico (FASE G)

- **LAN client validation**: probar `/up`, `/login`, `/verify-email`
  desde segunda PC por IP fija.
- **Impresora fisica media carta/carta/A5/80mm/58mm**: imprimir
  factura pagada en los 5 tamanos y validar margenes.
- **Restore real final**: backup desde UI -> restore en base
  descartable, validar SHA256 + conteos.
- **Concurrencia final**: doble apertura de caja, doble emision de
  factura, doble pago contra target descartable.
- **Worker continuo de backups**: tareas Windows
  `SistemaCajaHospitalaria-BackupWorker` y
  `SistemaCajaHospitalaria-DailyBackup` instaladas y activas.
- **Handoff final**: `scripts/final_production_handoff.ps1` exit 0
  sin `-AllowMissingPhysicalProof`.

### Alcance del producto (no se cierra)

- No hay expediente clinico. Paciente en factura es solo nombre.
- No hay inventario.
- No hay dashboard complejo (solo KPIs y graficos basicos).
- No hay cloud sync ni replica off-site.
- No hay restore UI (restore es por CLI con `restore_hospital_windows.ps1`).
- No hay PDF avanzado como modulo de entrega (factura es HTML/print).

### Operacion (documentado)

- Backup manual desde UI requiere worker local de cola `backups`.
- Backup real MySQL/MariaDB requiere `mariadb-dump` o `mysqldump`
  en PATH del backend container (ya esta en
  `docker-compose.prod.yml` HOSPITAL_DUMP_BINARY).
- Produccion offline debe crear `.env` real fuera del repositorio
  y no copiar credenciales de desarrollo.
- Los usuarios de validacion local solo se crean en `local` o
  `testing` (no en `production`).
- `HOSPITAL_LICENSE_SALT` debe ser 32+ chars aleatorios en
  produccion; el default embebido solo es dev.
- `HOSPITAL_INITIAL_ADMIN_PASSWORD` se pide por entrada oculta en
  el installer; nunca se acepta como argumento CLI.

## Issues diferidos a v1.0.0+1 (2026-06-09 round)

Items identificados durante la ronda de hardening de seguridad
del 2026-06-09 que NO bloquean el piloto y se difieren a la
siguiente version. Severidad:

- **PILOT_SAFE** - el piloto puede operar sin resolverlo.
- **PILOT_RISK** - el piloto puede operar, pero el equipo de
  soporte debe estar al tanto.
- **DEFERRED** - trabajo conocido, no urgente, vive en el
  roadmap de v1.0.0+1 / v1.1.

### Lazy-loading incompleto en `AppRoutes` — DEFERRED

`frontend/src/AppRoutes.lazy.test.ts` sigue asertando que las
nueve vistas pesadas (About, Backups, Catalog, Dashboard, Fiscal
Settings, Help, Invoice History, Reports, Users) estan cargadas
detras de `React.lazy()`. En el estado actual solo
`DashboardView` permanece lazy-loaded. El refactor para volver
a poner las nueve bajo lazy esta parqueado en `stash@{0}` en
la rama de auditoria y se re-tomara en la Fase 4 del plan
`docs/PLAN_7_FASES.md`. El test que falla por esto es
pre-existente a esta ronda y no es regresion introducida por
los commits del 2026-06-09.

### `phpstan analyse` no ejecutable en dev — DEFERRED

`vendor/larastan/larastan/extension.neon` no esta presente en
el entorno de desarrollo. El comando `phpstan analyse` falla
por setup, no por error en el codigo. Es un gap pre-existente
del entorno, no introducido por los commits de esta ronda. Se
volvera a correr en el servidor del piloto una vez que el
entorno tenga larastan instalado via `composer require
--dev`. La baseline rc.3 nivel 5 sigue siendo la fuente de
verdad de tipos hasta que se re-ejecute.

### `offline-release/` regenerado y no commiteado — PILOT_SAFE

`offline-release/` se regenera desde
`scripts/make_offline_release.ps1` y NO esta commiteado al
repositorio. La primera ejecucion del installer en una laptop
del hospital (`scripts/deploy_hospital_lan.ps1`) jalara el
ultimo estado del codigo fuente al momento de generar el
paquete. El guard `scripts/assert_offline_release_clean.ps1
-RequireCurrentCommit` valida que el paquete generado
corresponda al commit actual. Esto es intencional: evita
versionar artefactos binarios grandes en git.

### Tests de eritropoyetina actualizados al flag de top-level — PILOT_SAFE

`backend/tests/Unit/CalculateInvoiceTotalsActionTest` (casos
`test_erythropoietin_rule_with_dialysis_prescription_is_free`
y `test_erythropoietin_rule_requires_dialysis_prescription`)
y `backend/tests/Feature/InvoiceCreationTest`
(`test_erythropoietin_with_dialysis_prescription_is_free_and_snapshotted`,
`test_dialysis_prescription_does_not_discount_other_services`)
fueron migrados del API per-line al API de top-level
`dialysis_prescription` introducido en
`CreateInvoiceAction` (commit `8fe44203`). Los tests pasan
contra el nuevo contrato; cualquier codigo de llamada que
todavia envie el flag per-line en JSON sera rechazado por la
validacion 422 de `StoreInvoiceRequest`. No requiere
accion del operador, pero queda documentado para futuros
mantenedores.
