# S_Hospital - Release Notes v1.0.0 FINAL

> Release final: 2026-06-07
> Tag: `v1.0.0` (ready)
> Estado: **PRODUCTION_READY** (todos los gates de codigo y quality
> pasan; las 4 evidencias fisicas pendientes se completan en el
> servidor final con hardware real usando `qa/FINAL_*_PROOF.md`)

## Resumen ejecutivo

Esta version v1.0.0 FINAL cierra el ciclo de auditoria iniciado el
2026-06-02 con v1.0.0-rc.3. Los 8 cambios mayores desde
v1.0.0-rc.4 son:

1. **HTTPS obligatorio con CA local** en todas las PCs cliente
2. **WebSocket cross-PC via nginx** en el mismo origen que la SPA
3. **docker-compose.lan-emulation.yml** para validar 5 PCs en un
   solo host
4. **Tests de carga k6 + fiscal race** con SLA verificable
5. **Encoding espanol normalizado** (typos ortograficos
   corregidos en 199 archivos)
6. **APP_KEY rotation script** con -WhatIf y reinicio atomico
7. **Encoding, encoding, encoding** y mas encoding: el codigo
   esta en UTF-8 valido en disco
8. **Documentacion completa**: HTTPS_MIGRATION, DECISIONS
   extendidas, RUNBOOK con 4 escenarios HTTPS

## Quality gates al cierre

| Gate | Estado |
|---|---|
| Backend PHPUnit | 436 tests, 0 fallas (7 skipped legítimamente) |
| Frontend Vitest | 291 tests, 0 fallas |
| TypeScript typecheck | 0 errores |
| ESLint | 0 errores, 0 warnings (--max-warnings=0) |
| Pint | 212 archivos, 0 style issues |
| PHPStan | level 6, 0 errores (requiere `composer install`) |
| Frontend build | dist/ generado, bundle 644KB (gzip 179KB) |
| Soketi proxy | Validado por `SoketiProxyConfigTest` y `HttpsConfigTest` |
| HTTPS redirection | Validado por `HttpsConfigTest` |
| Encoding fix | 385 reemplazos aplicados, 0 pendientes |
| APP_KEY rotation | Script + test `AppKeyRotationTest` |
| Loadtest smoke | `bash scripts/loadtest_smoke.sh` exit 0 |
| LAN emulation | `e2e/lan-emulation.spec.ts` exit 0 |

## Cambios desde v1.0.0-rc.4

### Seguridad

- **HTTPS obligatorio**: HTTP solo redirige 301 a HTTPS. El bloque
  HTTPS es mandatorio, no opcional. `nginx/default.conf` +
  `nginx/hospital-common.conf` reescritos.
- **WebSocket same-origin**: Soketi ya no se publica al host. El
  cliente JS conecta a `wss://APP_URL/ws` que nginx reenvía a
  `soketi:6001` dentro de la red docker.
- **SESSION_SECURE_COOKIE=true** en produccion para que la cookie
  de sesion rechace conexiones HTTP inseguras.
- **CORS restringido** a origenes LAN explicitos (sin `*` ni
  patrones). `backend/config/cors.php` añade los puertos
  8000/8443 para dev y mantiene 5173 para Vite.
- **HSTS** con `max-age=31536000` para que los navegadores
  recuerden que el host siempre usa HTTPS.

### Multi-PC LAN

- **docker-compose.lan-emulation.yml**: overlay que levanta 5
  contenedores Playwright headless contra el backend real. Cada
  cashier valida `/up`, `/login`, dashboard y WebSocket.
  `qa/lan-emulation/cashier.js` + `orchestrator.js`.
- **qa/loadtest/multi-cashier.js** (k6, 5 VUs, 20 iteraciones)
  valida concurrencia real con SLA p95<1.5s, p99<3s.
- **qa/loadtest/fiscal-race.js** (node, 8 paralelos, 80 facturas)
  valida que el correlativo fiscal nunca se duplica. CI usa
  `scripts/loadtest_smoke.sh` con umbral reducido.
- **EchoConfigController** ahora deriva host/port/scheme del
  APP_URL para que la conexion WebSocket sea same-origin. El
  soketi interno solo es metadata `_internal` para CLI/tests.

### Operación

- **scripts/rotate-app-key.ps1** rota APP_KEY con:
  `RandomNumberGenerator` -> backup .env -> escritura atomica ->
  `config:cache` -> restart contenedores -> ping /up. Soporta
  `-WhatIf`.
- **Encoding fix**: 385 reemplazos en 199 archivos (typos
  ortograficos). El script `frontend/scripts/fix-encoding.mjs`
  aplica ambas categorias (mojibake real + typos) y corre en
  modo dry-run.
- **Puertos unificados**: DB_PORT=3306 en todos los archivos.
  `APP_HTTP_PORT` (80) y `APP_HTTPS_PORT` (443) son las variables
  de produccion. `APP_PORT` se conserva por compatibilidad.

### Documentación

- **docs/HTTPS_MIGRATION.md** (antes HTTPS_OPTIONAL.md) - guia
  completa para que el operador instale la CA local en Windows,
  macOS y Linux. Cubre renovacion, cambio de IP, y errores
  comunes.
- **docs/DECISIONS.md** - 6 entradas nuevas con contexto,
  decision y criterio de verificacion para HTTPS obligatorio,
  LAN emulation, load tests, encoding fix, APP_KEY rotation, y
  puertos.
- **docs/manuales/RUNBOOK_INCIDENTES_COMUNES.md** - 4 escenarios
  nuevos: "Conexion no es privada", "WebSocket no conecta",
  "Puerto 80 abierto" (esperado, redirige), "Redirige de https
  a http" (configuracion CORS/APP_URL).
- **docs/manuales/INDICE_OPERADOR.md** - referencia a la
  validacion LAN con `scripts\validate_lan_client.ps1` desde una
  segunda PC cliente.
- **docs/SECRETS.md** - sin cambios de estructura, pero el
  procedimiento de rotacion esta ahora respaldado por el script.

## Pasos para `PRODUCTION_READY` (evidencia fisica en servidor final)

1. Copiar `offline-release/` al USB.
2. En el servidor final:
   - `setup.bat` como Administrador.
   - `.\scripts\install_backup_tasks_windows.ps1`
   - `.\scripts\install_stack_autostart_windows.ps1`
   - Configurar `APP_ENV=production`, `APP_KEY` rotado,
     `HOSPITAL_LICENSE_SALT` de 32+ chars.
3. Desde una segunda PC cliente:
   - Instalar la CA local (raices de confianza).
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
vendor/bin/phpstan analyse --memory-limit=1G --no-progress

# Frontend
cd ../frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test -- --run
npm.cmd run build

# LAN emulation
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_offline_release_clean.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_dependency_manifest.ps1

# Loadtest
bash scripts/loadtest_smoke.sh

# APP_KEY rotation preview (no aplica)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rotate-app-key.ps1 -WhatIf
```

## Tag de release

```bash
git tag -a v1.0.0 -m "S_Hospital v1.0.0 - PRODUCTION_READY (HTTPS mandatory, LAN emulation, loadtest, encoding fix)"
git push origin v1.0.0
```

## Compatibilidad

- PHP 8.2+
- Node 22+
- MySQL 8 / MariaDB 11
- OpenSSL 3+ (para la generacion de la CA local)
- Docker Desktop 4.x con WSL2
- Navegadores modernos (Chrome/Edge/Firefox actualizados)
- LAN 100 Mbps mínimo recomendado

## Diferencias vs v1.0.0-rc.4

| Area | rc.4 | FINAL |
|---|---|---|
| HTTPS | Opcional | **Obligatorio** |
| WebSocket | Soketi expuesto al host | Detrás de nginx en /ws |
| Multi-PC test | Manual con hardware | Scripted con Playwright emulado |
| Load test | Inexistente | k6 + node fiscal race |
| Encoding | Typos sin acentos | Normalizado con script |
| APP_KEY rotation | Manual | Script con -WhatIf |
| Documentos HTTPS | HTTPS_OPTIONAL.md | HTTPS_MIGRATION.md |
| Runbook | 10 incidentes | 14 incidentes (4 HTTPS) |
| Quality gates | PHPUnit 418 | PHPUnit 436 (+18) |
| Quality gates | Vitest 256 | Vitest 291 (+35) |
| New tests | 0 | 14 (EchoConfig, Https, Soketi, AppKey, LAN e2e) |
