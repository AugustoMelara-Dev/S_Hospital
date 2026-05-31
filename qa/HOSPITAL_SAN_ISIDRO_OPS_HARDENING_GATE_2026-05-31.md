# Hospital San Isidro - Ops hardening gate 2026-05-31

## Estado

VALIDADO LOCALMENTE CON PENDIENTES FISICOS DE CAMPO.

Este gate corresponde al frente de soporte operativo, instalador seguro, bitacora de problemas e idempotencia de factura/pago. No sustituye pruebas fisicas de impresora, segunda PC LAN, UPS ni restore en el servidor final.

## Alcance validado por codigo

- Instalador y reparacion no destructivos:
  - `scripts/validate_installer_safety.ps1`
  - `scripts/repair_hospital_system.ps1`
- Diagnostico operativo:
  - `/api/system/status`
  - resumen `ok/warning/error` sin secretos.
- Centro de soporte:
  - `/support`
  - playbooks de caja, red, recibos, respaldos y cierre diario.
- Bitacora de problemas cliente:
  - `client_error_logs`
  - `/api/system/client-errors`
  - mensajes sanitizados y contexto permitido.
- Idempotencia transaccional:
  - `operation_idempotency_keys`
  - header `Idempotency-Key` en emision de factura y registro de pago.

## Pruebas locales esperadas

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_installer_safety.ps1`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/repair_hospital_system.ps1 -WhatIf`
- `php artisan test --filter=SystemStatusTest`
- `php artisan test --filter=ClientErrorLogTest`
- `php artisan test --filter=InvoiceCreationTest`
- `php artisan test --filter=CashPaymentsReceiptTest`
- `npm.cmd run test -- App.test.tsx`
- `npm.cmd run test -- errorCatalog`
- `npm.cmd run typecheck`
- `npm.cmd run build`

## Resultado local 2026-05-31

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_installer_safety.ps1`: PASS.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/repair_hospital_system.ps1 -WhatIf`: PASS.
- `docker compose ps`: backend/frontend/MariaDB activos; MariaDB healthy.
- `docker compose exec backend php artisan hospital:backup`: PASS, `hospital-backup-20260531-001342-2d95fnsn.sql`.
- `docker compose exec backend php artisan migrate --force`: PASS, nada pendiente por migrar.
- `docker compose exec backend php artisan test --colors=never`: PASS, 177 tests, 1073 assertions.
- `docker compose exec backend composer validate`: PASS despues de sincronizar hash de `composer.lock`.
- `docker compose exec backend vendor/bin/pint --test`: PASS, 179 files.
- `docker compose exec backend vendor/bin/phpstan analyse`: NO DISPONIBLE, PHPStan no esta instalado en este backend.
- `npm.cmd run check:branding`: PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run test`: PASS, 6 files, 40 tests.
- `npm.cmd run build`: PASS con advertencia Vite de chunk mayor a 500 kB.
- `npm.cmd run e2e`: PASS, 2 tests.

## Pendientes fisicos honestos

- Validar segunda PC real en LAN final.
- Validar impresora institucional fisica en papel configurado.
- Validar reinicio Windows y apertura por acceso directo en servidor final.
- Validar restore en base descartable del servidor final despues de configurar rutas reales.
