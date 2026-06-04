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
- ~~Installer legacy compatibility guarded~~: `setup.bat` delega al
  instalador LAN soportado, `install_hospital_os.ps1` queda solo por
  compatibilidad y `qa/INSTALLER_LEGACY_SAFETY_2026_06_03.md` lo valida.
- ~~LAN/IP recovery guarded~~: `refresh_lan_ip.ps1` usa diagnostico de red
  compartido, `Get-NetRoute` con metrica y modo `-WhatIf`; la evidencia queda
  en `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`.
- ~~Barcode/report SQL reference isolated~~:
  `schema_extensions_for_barcode_reports.sql` vive en
  `database/_reference_DO_NOT_EXECUTE/` y no queda como SQL ejecutable en la
  raiz de `database/`.
- ~~CSP report channel implemented~~: `/api/system/csp-report` existe con
  controlador, rate limit y tests de feature.
- ~~Maintenance mode guarded~~: `php artisan hospital:maintenance on/off`
  escribe solo `storage/framework/down`, muestra HTML/JSON humano y queda
  cubierto por `MaintenanceModeTest`.
- ~~Permission audit guarded~~: Spatie permission events quedan activos,
  `PermissionAuditObserver` persiste cambios de roles/permisos en
  `audit_logs`, y `PermissionAuditTest` cubre roles y permisos sin secretos.
- ~~Per-user rate limit guarded~~: `ThrottleByUser` protege escrituras de
  facturas, pagos y caja por usuario autenticado para que una caja no bloquee
  a otras en la misma IP LAN; `ThrottleByUserTest` cubre el contrato.
- ~~Health dashboard admin completo para v1.1~~: el pulso operativo admin
  muestra respaldos pendientes, trabajos fallidos, heartbeat del scheduler,
  cola LAN, retardo de base cuando el motor lo reporta, latencia DB
  P50/P95/P99, conexiones DB cuando MySQL/MariaDB lo permite, uptime, espacio
  en disco y migraciones sin exponer comandos, consultas, claves ni rutas
  locales.
- ~~ESLint warnings a error~~: `frontend/package.json` ejecuta
  `eslint . --max-warnings=0`; cualquier warning futuro falla el gate local y
  el job CI que invoca `npm run lint`.
- ~~Cobertura >80% en modulos criticos~~:
  `backend/tests/Coverage/CriticalModulesCoverageTest.php` exige 80% en
  Actions criticas y GitHub Actions lo ejecuta con `HOSPITAL_REQUIRE_COVERAGE=1`
  y `coverage: pcov` en los jobs `backend-sqlite` y `backend-mariadb`.

### Pendientes para v1.1

- **NewInvoiceView refactor**: ~490 lineas, objetivo <200 con
  sub-reducers por paso (paciente / servicio / revision / pago).
  Diferido por tamaño del cambio; cubierto por E2E.

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
- Autoarranque del stack al reiniciar Windows se instala con
  `scripts\install_stack_autostart_windows.ps1` y la tarea
  `SistemaCajaHospitalaria-StackAutostart` con trigger `AtStartup`; requiere
  PowerShell como Administrador en el servidor final.
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
