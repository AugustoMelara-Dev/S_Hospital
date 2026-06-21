# Integration Release Candidate Report

Fecha: 2026-06-21
Rama RC: `codex/integration-release-candidate`
Worktree: `C:\Projects\S_Hospital-integration-rc`

## Decision

Estado: BLOQUEADO PARA MAIN

La rama RC integra hardening, pila UI y CashBox. Los gates automatizados locales
ejecutados pasan, incluyendo backend, frontend, release E2E, smoke a11y mockeado
y readiness/responsive mockeado con capturas. No se fusiona a `main` porque el
plan de release exige evidencia fisica/operativa que no puede completarse en
este entorno: segunda PC LAN, impresora real, restore final MySQL/MariaDB
descartable del servidor final, concurrencia final/bajo carga real, smoke LAN
real y validacion visual completa contra entorno real.

## SHAs integrados

- Main inicial: `2d4293946bce18a4f870bdfadda2ac384e62b7ac`
- Checkpoint remoto: `checkpoint/pre-release-integration-20260621-0618`
- Hardening: `add73a642aa3cabb0dbdbe0c9e040593bcd84e20`
- Tip UI elegido: `origin/codex/ui-cashbox`
- Tip UI SHA: `c28eeae42efccecc6e007e9c629192ea00fdbe8b`
- Commit de estabilizacion inicial RC: `d65abe3cbfcd695d451b8d8664865059ebf1471a`
- Commit reporte QA inicial: `f2b095fdff5c7884db3fc8e8b46ccc208bf4b0f2`
- Commit harness readiness/a11y: `ae2063899caf2b9455c10d4aa5446a3637c2dccc`

## Ancestria UI

Todas las ramas UI esperadas son ancestro del tip elegido. No se fusionaron una
por una. El tip `origin/codex/ui-cashbox` incluye `ui-invoice-history` y agrega
los commits de CashBox:

- `769e04bd refactor(cash): modernize cashbox operational overview`
- `c28eeae4 test(cash): cover permissions reconciliation and concurrency states`

## Conflictos

No hubo conflictos Git en:

- Merge hardening: `merge: integrate cash concurrency and release hardening`
- Merge UI: `merge: integrate accessible hospital UI refactor`

## Bugs corregidos en la RC

- API maintenance mode devolvia `Service Unavailable` en JSON para rutas `/api/*`
  durante mantenimiento. Se ajusto `backend/bootstrap/app.php` para devolver el
  mensaje operativo humano esperado.
- `frontend/e2e/release-gate.spec.ts` clasificaba una cancelacion GET
  `net::ERR_ABORTED` como fallo bloqueante, mientras otros specs del release ya
  la trataban como cancelacion benigna. Se alineo la regla sin ignorar 4xx/5xx,
  errores de consola ni page errors.
- Pint detecto un estilo en `ManageFinalValidationUserCommand.php`; se corrigio
  con Pint.
- `frontend/e2e/production-readiness.spec.ts` dejaba escapar endpoints nuevos al
  proxy de Vite (`/api/settings/operational`, `/api/system/setup-status` y
  `/api/reports/dashboard`). Se agregaron mocks de primera parte para evitar
  falsos 502 y mantener el spec enfocado en UX/readiness.

## Warnings pendientes

- `npm ci` reporta warning transitorio de dependencia:
  `whatwg-encoding@3.1.1` deprecado. `npm ls whatwg-encoding` confirma que es
  transitivo de `jsdom@25.0.1`, no dependencia directa de produccion.
- `npm audit --audit-level=moderate`: PASS, 0 vulnerabilidades.
- `npm outdated`: hay actualizaciones disponibles. Se clasifican como pendientes
  upstream/compatibles fuera de este RC porque incluyen upgrades mayores
  (`eslint@10`, `typescript@6`, `jsdom@29`, `@vitejs/plugin-react@6`) y parches
  menores que requieren una ronda dedicada de upgrade/regresion.
- `composer audit --no-interaction`: PASS, sin advisories.
- `composer outdated --direct`: hay upgrades menores/parches disponibles
  (`laravel/pint`, `laravel/sail`, `phpoffice/phpspreadsheet`) y upgrades mayores
  posibles (`laravel/framework@13`, `phpunit@12`, `spatie/laravel-permission@8`,
  `laravel/tinker@3`). No se actualizan en este RC para no mezclar un cambio de
  dependencias amplio con la convergencia funcional.
- PHPUnit omite 11 tests dependientes de driver/entorno, incluyendo cobertura sin
  pcov/xdebug y algunos caminos MySQL-only. No son fallos funcionales del RC, pero
  deben cubrirse en entorno final/CI apropiado.

## Gates ejecutados

Frontend:

- `npm ci`: PASS, 0 vulnerabilidades.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 82 archivos, 480 tests.
- `npm run build`: PASS.

Backend:

- `composer validate --no-check-publish`: PASS.
- `composer audit --no-interaction`: PASS, sin advisories.
- `php artisan test --colors=never`: PASS, 704 passed, 11 skipped, 4604 assertions.
- `vendor/bin/pint --test`: PASS, 404 files.
- `vendor/bin/phpstan analyse --memory-limit=1G --no-progress`: PASS.

E2E y UX local:

- `npm run test:e2e`: PASS, 2/2 Playwright release tests.
- `npx playwright test e2e/all-buttons-smoke.spec.ts --output C:\tmp\s_hospital_button_smoke_artifacts`: PASS, 2/2.
  - Reporte: `C:\tmp\s_hospital_button_smoke_report.json`.
  - Cobertura: 13 rutas en desktop y mobile, controles interactivos con nombre
    accesible y axe sin violaciones critical/serious; ruta de cancelacion de
    accion peligrosa en historial.
- `npx playwright test e2e/production-readiness.spec.ts --output C:\tmp\s_hospital_production_readiness_artifacts`: PASS, 3/3.
  - Reporte: `C:\tmp\s_hospital_rc_mocked_screens\rc-e2e-mocked-report.json`.
  - Capturas generadas: dashboard light/dark, caja abierta, nueva factura vacia,
    carrito de facturacion, recibo A5, recibo light/dark, reportes admin y
    respaldos pendientes.
  - Nota: es mockeado y no sustituye LAN, MySQL/MariaDB real ni impresora fisica.

Migraciones:

- El runner E2E ejecuto `php artisan migrate:fresh --seed --force` sobre SQLite
  efimero/golden de testing, no produccion.
- Falta repetir restore/concurrencia en MySQL/MariaDB descartable final.

## Busquedas de bloqueantes

- `Query data cannot be undefined`: sin coincidencias.
- `console.log/error/warn`: solo `AppErrorBoundary` conserva `console.error` para
  fallos de render.
- `test.only`/`describe.only`: sin coincidencias. Existe un `test.skip` protegido
  por variable para mutaciones reales en `frontend/e2e/real-smoke.spec.ts`.
- Object URLs: hay helpers con `revokeObjectURL` y tests que lo verifican.

## Accesibilidad, responsive y visual

Evidencia automatizada local completada:

- Smoke a11y no mutante: desktop/mobile para dashboard, nueva factura, caja,
  catalogo, historial, reportes, respaldos, configuracion fiscal, recibos
  institucionales, usuarios, ayuda, informacion y 404.
- Readiness/responsive mockeado: flujo cajero/admin, EPO con receta de dialisis a
  L. 0.00, recibo A5, tema claro/oscuro, navegacion responsive y cancelacion de
  acciones peligrosas.

Pendiente antes de `main`: validacion visual completa contra servidor real/LAN y
viewports/dispositivos del plan, idealmente con evidencia firmada o capturas del
entorno final.

## PDF e impresion

PDF/recibos institucionales cubiertos por PHPUnit y E2E de flujo. Validacion
fisica no ejecutada.

VALIDACION FISICA DE IMPRESORA: PENDIENTE POR HARDWARE

## Seguridad

Validado por PHPUnit focal/completo, RBAC E2E, Composer audit y pruebas de
sanitizacion. Pendiente: pruebas IDOR/RBAC contra servidor final si se requiere
evidencia de campo.

## Recomendacion final

Mantener la rama `codex/integration-release-candidate` como RC remoto. No hacer
merge a `main` hasta completar los gates externos de campo y la auditoria visual/
operativa completa contra entorno real.
