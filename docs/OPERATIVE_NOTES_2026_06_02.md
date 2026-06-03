# S_Hospital - Notas operativas para v1.0.0

> Documento de corte: 2026-06-02. Reemplaza a
> `docs/KNOWN_LIMITATIONS.md` como la nota operativa vigente.

## Estado del sistema

- **Release actual:** v1.0.0-rc.4 (en este branch)
- **Próxima release objetivo:** v1.0.0 (PRODUCTION_READY)
- **Backend:** Laravel 12, 380 tests PHPUnit, 0 errores PHPStan nivel 5
- **Frontend:** React 19 + TS estricto, 217 tests Vitest, 0 typecheck
  errors, 0 ESLint errors
- **E2E:** Playwright production-readiness spec (mocked) verde
- **CI:** GitHub Actions workflows (ci.yml + release.yml) con
  backend-SQLite, backend-MariaDB, frontend, y e2e-mocked jobs

## Diferencias contra `docs/KNOWN_LIMITATIONS.md`

`KNOWN_LIMITATIONS.md` se mantiene como snapshot histórico del
estado rc.3. Este documento (`OPERATIVE_NOTES_2026_06_02.md`)
refleja el corte rc.4 y agrega los hallazgos de la auditoría
del 2026-06-02.

## Cerrado en v1.0.0

Adicional a la lista de `KNOWN_LIMITATIONS.md`, en este branch
se cerraron los siguientes bloqueantes CRITICAL:

- **CRIT-1** - Pre-commit guard ampliado para detectar
  `HOSPITAL_LICENSE_SALT`, `HOSPITAL_INITIAL_ADMIN_PASSWORD`,
  archivos `.env`, y `nginx/ssl/`. Dev APP_KEY rotado.
  Ver `docs/SECRETS.md` para el log de rotación.
- **CRIT-2** - Proceso reproducible para generar `offline-release/`
  con imágenes y checksums (D4). El guard de fuentes
  productivas y artefacto offline fue validado para rc.4;
  el paquete final del hospital debe generarse en un build
  box sin omitir `docker build`/`docker save` y debe terminar
  con `OFFLINE_RELEASE_CLEAN: YES`.
- **CRIT-3** - Pipeline CI/CD en GitHub Actions (`.github/workflows/ci.yml`
  y `release.yml`). Todo push/PR corre backend-SQLite, backend-MariaDB,
  frontend typecheck+lint+vitest+build, y e2e-mocked Playwright.
- **CRIT-4** - Índice `active_document_type` documentado y probado
  explícitamente. Migración `2026_05_17_000008` recibe un
  docblock explicando la invariante y los 3 tests nuevos
  verifican el comportamiento (multi-NULL + activación concurrente).
- **CRIT-5** - Flujo de reverso de factura implementado:
  `POST /api/invoices/{id}/reverse` con permiso `invoices.reverse`
  (admin/supervisor). 7 tests de feature en `InvoiceReverseTest`.
  Ver `docs/TROUBLESHOOTING.md` para la diferencia con la
  anulación directa.
- **CRIT-6** - Extensión `bcmath` agregada a `backend/Dockerfile`
  y `backend/Dockerfile.prod`. AGENTS.md cumplimiento.
- **CRIT-7** - Scheduler real: sidecar `supercronic` en
  `docker-compose.prod.yml` + `scripts/register_scheduler_cron.ps1`
  para Windows bare-metal. Heartbeat expuesto en
  `/api/system/status` (campo `scheduler_heartbeat`).
- **CRIT-8** - Evidencias físicas todavía PENDING. Plantillas
  en `qa/FINAL_*_PROOF.md` listas para llenar en el hospital.
  `production_readiness_preflight.ps1` falla el release si
  cualquiera sigue PENDING.
- **CRIT-9** - `Update-DotEnv` y `env_helpers.ps1` ahora
  siempre escriben con `-Encoding ASCII`. Test de PowerShell
  `env-helpers.tests.ps1` (9 casos) verifica que ningún BOM
  UTF-16 se escriba.

Adicional al paquete CRITICAL:

- **A8** - Real-time sync entre PCs: Soketi + laravel-echo.
  Eventos `invoice.changed`, `payment.changed`, `cash-session.changed`
  se emiten en `DB::afterCommit`. Cross-PC invalidations en
  TanStack Query via el hook `useBroadcastSync`.
- **D6** - PHP-FPM pool tuned para 5 cajeros: `pm=static`,
  `pm.max_children=8`, `pm.max_requests=500`, log a stdout.
- **B7** - `App\Policies\InvoicePolicy` y `CashSessionPolicy`.
  `Gate::policy()` registrado en `AppServiceProvider`.
  `AuthorizationStrategyTest` invertido para lockear la
  invariante (directorio + wiring).
- **F1** - `InvoiceHistoryView` migrado a TanStack Query.
  Eliminado el `useState` + `useEffect` para `invoices/meta`.
  Cross-PC sync fluye a través de `useBroadcastSync`.
- **F2** - Código muerto eliminado: `useClock` (sin uso),
  `app-kicker` (clase CSS vacía), `needsBillingCashBootstrap`
  y `cashBootstrapLoading` (siempre false).

## Pendientes para v1.1 (no bloquea v1.0.0)

- **Refactor NewInvoiceView a <300 líneas.** Diferido por tamaño
  del cambio; cubierto por E2E. AGENTS.md no marca un
  límite duro.
- **Coverage gate >80% en CI obligatorio.** Hoy el gate
  `tests/Coverage/CriticalModulesCoverageTest.php` se ejecuta
  solo en `--with-coverage`. Promover a obligatorio requiere
  instalar `pcov` en el runner y siempre invocar el perfil
  de coverage. Plan: FASE 12.2 de la auditoría.
- **Auditoría de cambios de permisos.** El observer
  `PermissionAuditObserver` ya escucha los eventos
  `RoleAttached/Detached` y `PermissionAttached/Detached` de
  Spatie. Falta: persistir los cambios en `audit_logs`
  con la misma forma que las demás acciones del sistema
  (hoy solo loguea a `Log::info`).
- **Dashboard avanzado con Recharts.** UI con
  P50/P95/P99 de latencia, conexiones DB activas, espacio
  en disco, último backup. Diferido a v1.1.
- **ESLint warnings a error.** 27 warnings documentados en
  FASE B5 para promover a error.
- **Comando `hospital:maintenance` interactivo.** Para
  poner el sistema en "en mantenimiento" durante incidentes.
- **Deprecación de `install_hospital_os.ps1`.** Marcar como
  legacy. El instalador soportado es
  `scripts/deploy_hospital_lan.ps1`. El instalador deprecado
  sigue en `offline-release/scripts/` por compatibilidad con
  builds antiguos.
- **IP detection robusta.** Reemplazar el placeholder
  `192.168.1.100` en `setup.bat` por `Get-NetRoute` con
  métrica y múltiples adaptadores. Diferido.
- **Cash deposit / withdrawal types.** `CashMovement::type`
  hoy solo tiene OPENING, PAYMENT, PAYMENT_VOID, CLOSING.
  Para soporte de "depósito a caja" o "retiro de caja"
  se necesitan TYPE_DEPOSIT y TYPE_WITHDRAWAL. No
  documentado en AGENTS.md, fuera de alcance para v1.0.0.
- **Refund workflow (devolución).** Una vez que la factura
  está cobrada, una devolución con signo negativo
  requiere un nuevo flujo. AGENTS.md no lo incluye; fuera
  de alcance. La cancelación inversa (FASE A3) cubre el
  caso "anular todo".

## Pendientes de entorno físico (FASE G)

Requieren el servidor final con hardware real. No se pueden
completar en este entorno de auditoría.

- **LAN client validation** - Probar `/up`, `/login`,
  `/verify-email` desde una segunda PC real (no del server).
  Llenar `qa/LAN_CLIENT_VALIDATION_PROOF.md`.
- **Impresora física** - Imprimir una factura de prueba en
  los 5 tamaños (media carta, carta, A5, 80mm, 58mm) y
  validar márgenes y encabezados/pies del navegador.
  Llenar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
- **Restore real final** - Backup desde UI -> restore a base
  descartable, validar SHA256 + conteos. Llenar
  `qa/FINAL_RESTORE_PROOF.md`.
- **Concurrencia final** - Doble apertura de caja, doble
  facturación, doble pago contra target descartable. Llenar
  `qa/FINAL_CONCURRENCY_PROOF.md`.
- **Worker continuo de backups** - Tareas Windows
  `SistemaCajaHospitalaria-BackupWorker` y
  `SistemaCajaHospitalaria-DailyBackup` instaladas y activas.
- **Handoff final** - `scripts/final_production_handoff.ps1`
  ejecutado sin `-AllowMissingPhysicalProof`. Llenar
  `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` con
  `PRODUCTION_READY=YES`.

`production_readiness_preflight.ps1` falla el release si
cualquiera de los cuatro PROOF files sigue PENDING.

## Alcance del producto (no se cierra)

- No hay expediente clínico. El paciente en la factura es
  solo nombre.
- No hay inventario.
- No hay dashboard complejo más allá de KPIs y gráficos
  básicos.
- No hay cloud sync ni réplica off-site.
- No hay restore UI (restore es por CLI con
  `restore_hospital_windows.ps1`).
- No hay PDF avanzado como módulo de entrega (la factura es
  HTML/print).
- No hay refacturación parcial (línea de factura con signo
  negativo). La cancelación inversa cubre la anulación
  completa.

## Operación (documentado)

- Backup manual desde UI requiere worker local de cola
  `backups`. El sidecar `queue-worker` se asegura de esto.
- Backup real MySQL/MariaDB requiere `mariadb-dump` o
  `mysqldump` en PATH del backend container (configurado
  en `docker-compose.prod.yml` `HOSPITAL_DUMP_BINARY`).
- Producción offline debe crear `.env` real fuera del
  repositorio y nunca copiar credenciales de desarrollo.
- Los usuarios de validación local solo se crean en `local` o
  `testing` (no en `production`). El seeder
  `DevelopmentValidationSeeder` respeta esto.
- `HOSPITAL_LICENSE_SALT` debe ser 32+ chars aleatorios en
  producción; el default embebido solo es dev. El
  pre-commit guard detecta este caso.
- `HOSPITAL_INITIAL_ADMIN_PASSWORD` se pide por entrada
  oculta en el installer; nunca se acepta como argumento CLI.
- `BROADCAST_CONNECTION=log` en dev, `pusher` en producción.
  El endpoint `GET /api/system/echo-config` retorna
  `data.enabled = true|false` para que el cliente JS no
  intente conectar a Soketi si está deshabilitado.

## Diferencias vs `KNOWN_LIMITATIONS.md`

Este archivo es el snapshot actual. `KNOWN_LIMITATIONS.md`
es el snapshot rc.3. Ambos están mantenidos. Las diferencias
se reflejan arriba en "Cerrado en v1.0.0" (este branch).
