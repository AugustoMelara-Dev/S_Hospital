# Billing Offline Readiness Report

## Dictamen

S_Hospital queda cerrado como producto tecnico de caja/facturacion hospitalaria offline LAN. No se cierra como producto clinico ni como HIS/EMR.

Estado final permitido de este cierre: `TECHNICAL_DELIVERY_READY`.

La evidencia tecnica disponible cubre documentacion de alcance, navegacion final, suite backend completa, gates frontend, build y E2E release local. No se declara `PRODUCTION_READY` porque aun falta evidencia fisica final en servidor real, segunda PC LAN, impresora, backup worker/tarea programada, restore final y configuracion production.

## Modulos revisados

- Login y sesion local.
- Nueva factura.
- Caja y pagos.
- Recibos institucionales.
- Historial y reimpresion.
- Reportes administrativos/financieros.
- Catalogo de servicios facturables.
- Usuarios y permisos.
- Configuracion fiscal/hospitalaria y de recibos.
- Respaldos locales.
- Ayuda/soporte operativo.

## Navegacion final verificada

El menu lateral final queda restringido a: Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios y Ayuda.

Se removio la ruta SPA visible `/area-services` y el cliente frontend de `/api/area-services/paid`. La API backend de area queda como legado protegido y fuera del menu final.

## Contradicciones corregidas

- Se retiro la ruta visible de Servicios pagados por area del menu final.
- Se retiro la ruta SPA `/area-services` del cierre visible.
- Se retiro el cliente frontend de `/api/area-services/paid` y la vista asociada del flujo frontend.
- Se documento que areas/reportes por area son legado interno o fuera del menu final, no modulos clinicos.
- Se corrigio documentacion offline que hablaba de pacientes/citas como datos migrables activos.
- Se corrigio el prompt maestro para no pedir exportacion de citas ni guia de enfermeria.
- Se normalizo el setup inicial para usar Medicamentos como concepto facturable, no hospitalizacion como modulo.
- Se corrigio el runner E2E release para pasar `E2E_SEED_PASSWORD` al comando Laravel de preparacion de datos.

## Gates ejecutados

| Gate | Resultado | Nota |
|---|---|---|
| `git diff --check` | PASS | Sin whitespace errors al cierre. |
| `composer validate` | PASS | Ejecutado en Docker backend. |
| `composer audit --no-interaction` | PASS | 0 advisories. |
| `php artisan test --colors=never` | PASS | 12 skipped, 566 passed, 3655 assertions. |
| `php artisan test tests/Feature/InstitutionalReceiptPdfTest.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php` | PASS | 15 tests, 161 assertions. |
| `php artisan test tests/Feature/Payments/VoidPaymentAgainstClosedCashSessionTest.php` | PASS | 2 tests, 10 assertions. |
| `vendor/bin/pint --test` | PASS | 370 files. |
| `vendor/bin/phpstan analyse` | FALLA POR MEMORIA | 128M insuficiente en el contenedor. |
| `vendor/bin/phpstan analyse --memory-limit=512M` | PASS | 0 errors. |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities. |
| `npm run typecheck` | PASS | TypeScript OK. |
| `npm run lint` | PASS | ESLint OK. |
| `npm run test` | PASS | 67 files, 297 tests. |
| `npm run build` | PASS CON WARNINGS | Build OK; warnings de chunk grande/circular chunk. |
| `npm run e2e` | PASS | 1 Playwright release gate passed desde host; levanta Laravel, Vite y SQLite E2E. |

## Bloqueantes

No quedan bloqueantes tecnicos para demo/UAT ni entrega tecnica offline.

## Pendientes de campo

- Segunda PC LAN real.
- Impresora fisica y papel final.
- Backup worker/tarea programada en servidor real.
- Restore final en base descartable.
- Configuracion production final y paquete offline/manifest actualizado.

## Criterio para subir estado

- `READY_FOR_REAL_LAN_INSTALLATION_TEST`: paquete offline final limpio y checklist de instalacion listo para servidor/cliente real.
- `PRODUCTION_CANDIDATE`: instalacion real ejecutada y pendiente solo aceptacion operativa final.
- `PRODUCTION_READY`: solo con evidencia fisica final de servidor, segunda PC LAN, impresora, backup worker, restore y production config.
