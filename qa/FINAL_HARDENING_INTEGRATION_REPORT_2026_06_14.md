# Final hardening e integracion - 2026-06-14

## Identificacion

- Rama validada: `codex/f6-operational-polish`.
- HEAD base antes del commit de cierre: `d5734f6d`.
- Este reporte se genera para el commit final de hardening; el HEAD final exacto se verifica despues del commit.
- Alcance: limpieza Git, Pint global, suite backend completa, frontend gates, Playwright, caja, respaldos, restore seguro y evidencia visual.

## Estado Git y limpieza

- `backend/fix.php`: eliminado. Era un script temporal rastreado que modificaba tests y hacia fallar Pint global; no pertenece a producto.
- Migracion fantasma `backend/database/migrations/2026_06_13_233749_add_missing_monetary_check_constraints_to_billing_tables.php`: no existe en el arbol final. No se recrea porque las restricciones monetarias necesarias ya estan cubiertas por migraciones previas y `cash_movements.amount` puede ser negativo para reversos auditados.
- Carpeta temporal `output/`: eliminada despues de revisar que contenia capturas generadas por subagentes, no evidencia oficial del repositorio.
- Evidencia oficial actualizada: `qa/screenshots/rc-e2e-2026-06-09-*.png`.

## Cambios tecnicos del pase final

- `AddSecurityHeaders`: deteccion production-like acepta tanto `app()->environment()` como `config('app.env')`, cubriendo runtime Laravel y pruebas que simulan configuracion de produccion.
- `phpunit.xml`: fija `memory_limit=512M` para que `php artisan test` completo corra de forma reproducible.
- `CashPaymentsReceiptTest`: factura L.0 por receta de dialisis queda pagada y auditable sin crear un pago artificial de L.0; se espera `invoice.zero_amount_registered`.
- E2E Playwright: selectors de recibo y receta de dialisis usan roles/labels accesibles tolerantes a acentos (`Tamaño/Tamano`, `diálisis/dialisis`) sin relajar flujo funcional.
- `docs/DECISIONS.md`: documenta eliminacion de temporal, migracion fantasma, factura L.0, memory limit y politica de backups.

## Validacion backend

- `docker compose exec backend vendor/bin/pint --test`: PASS, `288 files`.
- `docker compose exec backend php artisan test --colors=never`: PASS completo, `449 passed`, `11 skipped`, `2892 assertions`.
- `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G --error-format=table`: PASS, `No errors`.
- `docker compose exec backend php artisan test --colors=never tests/Feature/BackupWorkflowTest.php tests/Feature/Resilience/BackupRestoreRoundtripTest.php`: PASS, `23 passed`, `1 skipped`, `119 assertions`.

## Matriz backend cubierta

| Area | Resultado |
| --- | --- |
| Facturacion | Cubierta por suite completa; pasa. |
| Pagos | Cubierta por suite completa; pasa. |
| Caja y cierre | Cubierta por suite completa y Playwright; pasa. |
| Historial/reimpresion | Cubierta por suite completa y Playwright; pasa. |
| Anulacion/reversos | Cubierta por suite completa; pasa. |
| Reportes | Cubierta por suite completa y Playwright; pasa. |
| Exportaciones | Cubierta por suite completa y Playwright; pasa. |
| Backups | Crear/listar/descargar/worker/scheduler cubiertos; pasan. |
| Restore/restauracion | Restore web no expuesto; self-test/roundtrip seguro cubierto. MySQL simulation queda skip controlado. |
| Catalogo | Cubierta por suite completa y frontend; pasa. |
| Usuarios/permisos | Cubierta por suite completa y frontend; pasa. |
| Configuracion fiscal | Cubierta por suite completa y Playwright; pasa. |
| Security headers | Cubierta por suite completa; pasa. |
| Rutas SPA/LAN | Cubierta por smoke/subagente y Playwright; pasa en local. |

## Backups, exportacion y restore

- Crear backup manual: validado por `manual backup endpoint queues local backup`.
- Worker/procesamiento: validado por `backup runner creates success log checksum and audit entry`.
- Descargar/exportar backup: validado por `download only serves registered existing backup files and audits download`.
- Backup programado: validado por `daily scheduled backup is registered for local automation`.
- `schedule:list`: confirma respaldo diario a `02:00` y respaldo operativo cada 15 minutos dentro de ventana configurada por variables `HOSPITAL_OPERATION_START/END`.
- Restaurar/importar por UI: no existe y no debe improvisarse como boton destructivo. El endpoint restore web esta explicitamente no expuesto.
- Restore seguro: validado por pruebas de roundtrip/self-test en entorno descartable; la simulacion MySQL queda como skip controlado cuando no se habilita entorno dedicado.

## Validacion frontend

- `npm.cmd run test`: PASS, `59 files`, `256 tests`.
- `npm.cmd run lint`: PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS; Vite build completo.
- `npm.cmd run e2e`: PASS, `16 passed`.

## Flujo funcional caja validado

Playwright cubrio login, apertura de caja, nueva factura, seleccion de servicio, emision, pago, recibo, selector de tamaño de recibo, factura L.0 por receta de dialisis, reimpresion desde historial, reportes, respaldos y responsive shell. El flujo de cierre de caja pasa en `rc1-screens.spec.ts`.

## Evidencia visual

Capturas oficiales actualizadas en:

- `qa/screenshots/rc-e2e-2026-06-09-login-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-login-dark.png`
- `qa/screenshots/rc-e2e-2026-06-09-dashboard-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-dashboard-dark.png`
- `qa/screenshots/rc-e2e-2026-06-09-billing-new-empty-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-billing-new-cart-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-payment-modal-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-receipt-preview-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-receipt-preview-a5-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-receipt-preview-letter-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-receipt-preview-dark.png`
- `qa/screenshots/rc-e2e-2026-06-09-reprint-modal-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-cashbox-open-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-cashbox-close-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-invoice-history-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-settings-fiscal-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-settings-fiscal-dark.png`
- `qa/screenshots/rc-e2e-2026-06-09-backups-light.png`
- `qa/screenshots/rc-e2e-2026-06-09-backups-pending-light.png`

## Subagentes usados

- Backend Hardening QA: confirmo migracion fantasma ausente, `fix.php` temporal, Pint global y suite backend completa.
- QA funcional/integracion: confirmo matriz por modulos, PHPStan, frontend gates, restore self-test y schedule.
- Visual QA: confirmo login real, ausencia de controles sin nombre, sin overflow horizontal en smoke local y artefactos temporales limpiados del repo.

## Riesgos pendientes

- No queda riesgo bloqueante conocido para cierre tecnico local.
- Riesgo operativo no bloqueante: revisar en despliegue real LAN la retencion/tamaño de backups con la politica dual diario + operativo, segun capacidad del disco del servidor.
- Restore destructivo real no se expone por UI; debe ejecutarse solo por procedimiento controlado en base descartable o ventana de mantenimiento.
