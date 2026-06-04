# S_Hospital - Release Notes v1.0.0

> Release candidate final: 2026-06-04
> Tag: `v1.0.0` (a crear desde el commit `27913989`)
> Estado: `PRODUCTION_CANDIDATE` (los 4 bloqueantes fisicos
> finales siguen documentados en
> `docs/OPERATIVE_NOTES_2026_06_02.md` y se cierran con las
> plantillas `qa/FINAL_*_PROOF.md` en el servidor del hospital).

## Resumen ejecutivo

Esta version v1.0.0 cierra 19 fases planificadas que incluyen:

- Auditoria profunda del codigo backend y frontend.
- Multi-PC LAN, resiliencia operativa e instalacion robusta.
- Seguridad reforzada, i18n es-HN, accesibilidad WCAG AA.
- Paquete offline regenerado desde el commit final.

Los unicos pendientes que quedan son **evidencia fisica de campo**
(LAN 2da PC, impresora fisica, tareas Windows en servidor final,
restore y concurrencia contra base descartable), documentados
en `qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md`.

## Cambios desde v1.0.0-rc.4

### FASE A - Auditoria y correcciones de codigo

- **A1 - Centralizacion de `parseCurrencyToCents`**:
  `frontend/src/lib/moneyCents.ts` ahora expone
  `parseSignedCents` y `parseCentsOrZero`. Se eliminaron 5 copias
  de la misma funcion en posMath, useInvoiceLifecycle,
  PaymentModal, InvoiceCart, CashBoxView y ServiceSheet.
- **A2 - Limite de memoria en reportes**: `OperationsReportService`
  usa `->lazy(500)` en lugar de `->get()` para el desglose por
  cajero.
- **A3 - `sharedLock` en caja abierta**: `CashSessionReportService`
  ahora bloquea la fila de la sesion antes de leer pagos y
  movimientos cuando esta abierta. Cajas cerradas siguen
  usando el snapshot persistido.
- **A4 - Validacion reforzada**:
  - `StoreInvoiceRequest::patient_name` rechaza solo digitos,
    longitud minima 2, regex restrictivo, maximo 50 items y
    cantidad maxima 1000.
  - `OpenCashSessionRequest::opening_amount` cap 9,999,999.99.
  - `StoreServiceRequest` / `UpdateServiceRequest` regex de
    nombre y cap de precio.
- **A5 - Dedup de eventos propios**: los 3 eventos
  (InvoiceChanged, PaymentChanged, CashSessionChanged) llevan
  `actor_id` y `useBroadcastSync` descarta el toast cuando el
  evento lo disparo el propio cajero.

### FASE B - Multi-PC LAN y resiliencia

- **B1 - Documentacion** de la transicion
  `SESSION_DRIVER=file` -> `database` al promover dev a prod
  (`docs/SESSION_DRIVER_TRANSITION.md`).
- **B2 - Auto-recovery del queue-worker**: `while true` con
  `--max-jobs=200 --max-time=3600` y healthcheck que cuenta
  `failed_jobs` de la ultima hora.
- **B3 - Rate limit en Soketi**: `--max-connections=100`,
  `--websocket-max-message-size=10240` y `--metrics.enabled`.
- **B4 - Cache de 10s en `/api/system/health`** para que
  multiples PCs no hagan el mismo probe.
- **B5 - Cache de 30s en el dashboard** con invalidacion activa
  en `CreateInvoiceAction` y `RegisterPaymentAction`.

### FASE C - Instalacion robusta

- **C1 - HOSPITAL_LICENSE_SALT >= 32 chars obligatorio**:
  `AppServiceProvider` lanza `RuntimeException` en produccion
  si la sal es muy corta. `docker-compose.prod.yml` exige la
  variable.
- **C2 - Smoke test post-instalacion**:
  `scripts/post_install_quick_check.ps1` corre 7 chequeos HTTP
  sin auth. El instalador lo invoca al final.
- **C3 - Modo `-Wizard`** en
  `install_backup_tasks_windows.ps1` y `refresh_lan_ip.ps1`
  con preguntas guiadas y valores por defecto.
- **C4 - Aviso automatico de cambio de IP**:
  `refresh_lan_ip.ps1` genera `qa/IP_CHANGE_NOTICE.txt` con
  instrucciones para las PCs cliente.
- **C5 - Gate de `package_manifest.json`** en el job
  backend-sqlite de CI.

### FASE D - Operacion y observabilidad

- **D1 - Runbook de incidentes comunes**:
  `docs/manuales/RUNBOOK_INCIDENTES_COMUNES.md` cubre 10
  sintomas frecuentes con sintoma -> causa -> accion.
- **D2 - `production_dry_run.ps1`**: corre migraciones con
  `APP_ENV=production` contra una base SQLite descartable,
  compila frontend y ejecuta el quick check.
- **D3 - Health endpoint extendido**: nuevos campos
  `database_lag`, `queue_size`, `disk_free_gb` y `app_uptime_s`
  en `/api/system/health`.

### FASE E - Entrega

- **E1 - Paquete offline regenerado** desde el commit final.
  4 imagenes Docker, 251.56 MB total, SHA256 validados.
- **E2 - Smoke guard documentado**:
  `qa/OFFLINE_RELEASE_SMOKE_2026_06_04.md` captura la salida
  de los 3 guards automaticos.

## Quality gates al cierre

| Gate | Estado |
|---|---|
| Backend PHPUnit | 418 tests, 0 fallas (6 skipped) |
| Frontend Vitest | 256 tests, 0 fallas |
| TypeScript typecheck | 0 errores |
| ESLint | 0 errores |
| Pint | 212 archivos, 0 style issues |
| PHPStan | level 6, 0 errores (baseline existente) |
| Frontend build | dist generado, chunks dentro de 500 KB |
| Offline release guard | `OFFLINE_RELEASE_CLEAN: YES` |
| Dependency manifest | matches composer.json / package.json |
| Production docker sources | `PRODUCTION_DOCKER_SOURCES: YES` |

## Pasos para `PRODUCTION_READY`

1. Copiar `offline-release/` al USB.
2. En el servidor final:
   - `setup.bat` como Administrador.
   - `.\scripts\install_backup_tasks_windows.ps1`
   - `.\scripts\install_stack_autostart_windows.ps1`
   - Configurar `APP_ENV=production`, `APP_KEY` rotado,
     `HOSPITAL_LICENSE_SALT` de 32+ chars.
3. Desde una segunda PC cliente:
   - Llenar `qa/LAN_CLIENT_VALIDATION_PROOF.md`.
4. Con la impresora institucional:
   - Imprimir una factura de prueba en 5 tamanos.
   - Llenar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
5. Con `RESTORE_TEST_DATABASE`:
   - `bash scripts/validate_restore_mysql.sh`.
   - Llenar `qa/FINAL_RESTORE_PROOF.md`.
6. Con `HOSPITAL_CONCURRENCY_BASE_URL`:
   - `bash scripts/validate_mysql_concurrency.sh`.
   - Llenar `qa/FINAL_CONCURRENCY_PROOF.md`.
7. `scripts/production_readiness_preflight.ps1` sin bypass
   debe retornar 0.
8. `scripts/final_production_handoff.ps1` deja
   `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` con
   `PRODUCTION_READY=YES`.

## Comandos de verificacion

```powershell
cd C:\Projects\S_Hospital

# Backend
cd backend
php artisan test --colors=never
vendor/bin/pint --test
vendor/bin/phpstan analyse --no-progress --memory-limit=1G

# Frontend
cd ../frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test -- --run
npm.cmd run build

# Offline release
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_offline_release_clean.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_dependency_manifest.ps1
```

## Tag de release

```bash
git tag -a v1.0.0 -m "S_Hospital v1.0.0 - production candidate final"
git push origin v1.0.0
```
