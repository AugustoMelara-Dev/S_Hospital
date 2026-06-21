# Integration Release Candidate Report

Fecha: 2026-06-21
Rama RC: `codex/integration-release-candidate`
Worktree: `C:\Projects\S_Hospital-integration-rc`

## Decision

Estado: BLOQUEADO PARA MAIN

La rama RC integra hardening, pila UI y CashBox, y los gates automatizados
ejecutados pasan. No se fusiona a `main` porque el plan de release exige
evidencia fisica/operativa que no puede completarse en este entorno: segunda PC
LAN, impresora real, restore final MySQL/MariaDB descartable del servidor final,
concurrencia final/bajo carga real, smoke LAN real y validacion visual completa
por ruta/dispositivo.

## SHAs integrados

- Main inicial: `2d4293946bce18a4f870bdfadda2ac384e62b7ac`
- Checkpoint remoto: `checkpoint/pre-release-integration-20260621-0618`
- Hardening: `add73a642aa3cabb0dbdbe0c9e040593bcd84e20`
- Tip UI elegido: `origin/codex/ui-cashbox`
- Tip UI SHA: `c28eeae42efccecc6e007e9c629192ea00fdbe8b`
- Release candidate SHA: `d65abe3cbfcd695d451b8d8664865059ebf1471a`

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

## Warnings pendientes

- `npm ci` reporta warning transitorio de dependencia:
  `whatwg-encoding@3.1.1` deprecado. `npm audit` reporta 0 vulnerabilidades.
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

E2E:

- `npm run test:e2e`: PASS, 2/2 Playwright release tests.
- Cobertura: flujo cajero emite factura, cobra, muestra recibo y reportes; RBAC de
  usuario catalog-only.

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

Evidencia automatizada indirecta: tests de componentes/AppShell y E2E release.
Pendiente antes de `main`: auditoria completa por rutas y viewports indicados en
el plan, idealmente con Playwright/axe si el stack disponible lo permite.

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
accesibilidad completa.
