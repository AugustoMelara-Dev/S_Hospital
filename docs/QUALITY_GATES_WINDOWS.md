# Quality Gates Reproducibles En Windows

Este documento define los comandos canonicos para validar un release candidate
en Windows sin depender de una maquina grande. No reemplaza validacion fisica de
impresora, LAN ni restore final.

## Principios

- No usar `migrate:fresh` contra una instalacion real.
- No tocar datos reales para correr gates.
- Backend usa `APP_ENV=testing`, SQLite en memoria y `memory_limit=512M` desde
  `phpunit.xml`.
- Frontend usa Vitest serial para evitar OOM de workers en Windows.
- El gate RC minimo es reproducible y focal en modulos criticos.
- El gate completo se documenta aparte; si falla por recursos, registrar el
  workaround aprobado por suites focales y no ocultar la falla.

## Gate RC minimo

Desde la raiz del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\quality_gate_windows.ps1 -CriticalOnly
```

Incluye:

- `git diff --check`
- backend focal de eritropoyetina/permisos;
- backend focal de caja/pagos/recibos;
- backend focal de recibos institucionales;
- backend focal de backup/restore workflow;
- `pint --test`;
- `phpstan analyse`;
- frontend test focal critico serial;
- typecheck;
- lint;
- build.

## Gate completo Windows

Desde la raiz del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\quality_gate_windows.ps1 -Full
```

Este comando agrega:

- `php artisan test --colors=never` completo;
- `npm.cmd run test:full:windows`.

Si el gate completo agota memoria o excede la ventana disponible, registrar:

- comando ejecutado;
- salida exacta;
- RAM/entorno aproximado;
- suites focales que si pasaron;
- decision de soporte para repetir el gate completo en una maquina con mas
  memoria o en CI.

## Comandos manuales equivalentes

Backend:

```powershell
cd backend
php -d memory_limit=512M artisan test --colors=never --filter=InvoiceDialysisPrescriptionTest
php -d memory_limit=512M artisan test --colors=never --filter=CashPaymentsReceiptTest
php -d memory_limit=512M artisan test --colors=never --filter=InstitutionalReceiptPaymentIntegrationTest
php -d memory_limit=512M artisan test --colors=never --filter=InstitutionalReceiptPdfTest
php -d memory_limit=512M artisan test --colors=never --filter=BackupWorkflowTest
php -d memory_limit=512M artisan test --colors=never --filter=AuthorizationStrategyTest
vendor\bin\pint --test
vendor\bin\phpstan analyse --memory-limit=1G --no-progress
```

Frontend:

```powershell
cd frontend
npm.cmd run test:critical
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Frontend completo en modo bajo consumo:

```powershell
cd frontend
npm.cmd run test:full:windows
```

## Interpretacion

- `CriticalOnly` verde permite avanzar en hardening si los cambios son pequenos
  y el full gate ya se documento como no reproducible por recursos en el host.
- `Full` verde es el estado preferido antes de tag o entrega tecnica.
- Ningun resultado automatizado permite declarar `PRODUCTION_READY` sin campo:
  impresora fisica, papel final, LAN real y restore/concurrencia final.
