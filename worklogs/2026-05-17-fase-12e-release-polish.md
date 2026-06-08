# Fase 12E - Release polish institucional

Fecha: 2026-05-17

## Alcance

- Reducir `frontend/src/App.tsx` para que sea orquestador y no contenedor monolitico de pantallas.
- Extraer login, cambio obligatorio de contrasena, dashboard y rutas privadas a modulos separados.
- Integrar Recharts en reportes para visual gerencial de servicios mas vendidos.
- Actualizar checklist final y guia de validacion con identificadores de servicio, categorias, reportes, backups y limites fisicos.

## Archivos principales

- `frontend/src/App.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/features/auth/LoginView.tsx`
- `frontend/src/features/auth/PasswordChangeView.tsx`
- `frontend/src/features/dashboard/DashboardView.tsx`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/styles.css`
- `docs/OPERATIVE_VALIDATION_FLOW.md`
- `docs/05_DESIGN_SYSTEM_AND_LIBRARIES.md`
- `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`

## Criterios de aceptacion

- App shell sigue cargando con rutas separadas.
- Login y cambio de contrasena conservan comportamiento probado.
- Dashboard ya no vive dentro de `App.tsx`.
- Reportes muestran grafico real con datos calculados por backend.
- Documentacion de validacion no declara como aprobado lo que requiere impresora fisica o cliente LAN real.

## Riesgos

- Prueba fisica de impresora institucional en media carta, carta o A5 depende del sitio.
- Validacion desde segunda PC LAN depende de red/servidor final.
- TanStack Query/Table y React Hook Form/Zod quedan como adopcion gradual para no inflar la entrega sin necesidad inmediata.

## Validacion ejecutada

- `npm.cmd test`: 20 tests frontend OK.
- `npm.cmd run typecheck`: OK.
- `npm.cmd audit --audit-level=moderate`: 0 vulnerabilidades.
- `npm.cmd run build`: OK, chunks separados `vendor` y `charts`.
- `npm.cmd run e2e`: 1 flujo Playwright OK.
- `php artisan test --colors=never`: 107 tests / 597 assertions OK.
- `php artisan config:cache`: OK.
- Smoke HTTP con `php artisan serve`: `/up`, `/login`, `/verify-email`, `/dashboard`, `/billing/new`, `/cashbox`, `/catalog`, `/invoices`, `/reports`, `/backups`, `/settings/fiscal` respondieron 200.

## Continuacion posterior

- AppShell muestra topbar con caja, rol, usuario, hora local y estado LAN derivado del status.
- Sidebar/topbar/footer se ocultan al imprimir para que el recibo institucional no arrastre navegacion.
- POS agrega confirmacion antes de emitir y antes de cobrar.
- POS muestra CTA a Caja cuando no hay caja abierta.
- Caja agrega confirmacion antes de cierre.
- Backend exige nota cuando el cierre tiene diferencia distinta de cero.
- `reports.view` ya no concede acceso historico a facturas ajenas.
- Exportacion CSV de reportes pasa por backend y exige `reports.export`.
- Reportes incluyen auditoria operativa: anulaciones, reimpresiones, backups, cajeros con ingreso y filtros por caja/cajero/categoria/metodo/estado.
- POS principal exige caja abierta antes de emitir para evitar ambiguedad entre factura pendiente y cobrada.
- Guia de validacion actualizada con flujo de caja abierta, reportes avanzados y smoke real separado.
- `App.tsx` reducido de 217 a 83 lineas; sesion, permisos y caja bootstrap viven en `useHospitalSession`.
- Reportes muestran errores inline por diario/rango/caja, no solo en el status global.
- E2E Playwright mockeado falla si hay `console.error`, `pageerror` o request fallida inesperada.
- Catalogo usa `DataTable` compartido y estados base para loading/empty/error.
- E2E valida shell/POS en desktop, tablet y mobile.

## Validacion posterior a revision de subagentes

- `php artisan test --filter=CashPaymentsReceiptTest --colors=never`: 14 tests / 114 assertions OK.
- `php artisan test --filter=ReportsTest --colors=never`: 15 tests / 170 assertions OK.
- `php artisan test --filter=InvoiceHistoryReprintVoidTest --colors=never`: 13 tests / 91 assertions OK.
- `php artisan test --colors=never`: 120 tests / 714 assertions OK.
- `vendor/bin/pint --test`: OK.
- `npm.cmd run lint`: OK.
- `npm.cmd test`: 20 tests frontend OK.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run build`: OK.
- `php artisan config:cache`: OK.
- `npm.cmd run e2e`: 1 Playwright workflow mockeado OK; `real-smoke.spec.ts` queda excluido por defecto.
- `npm.cmd run smoke:real` sin variables reales: falla explicitamente por faltar `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`; no pasa en falso.
- `frontend/e2e/real-smoke.spec.ts` separa smoke real no destructivo de flujo mutacional. El flujo que abre caja, emite factura, valida error de paciente, cobra, revisa historial y consulta reportes solo corre con `E2E_REAL_ALLOW_MUTATIONS=1`.

## Pendiente real

- Ejecutar smoke real LAN con consola limpia requiere servidor Laravel/API levantado y `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`.
- Ejecutar el smoke mutacional contra una base real requiere snapshot/backup previo y `E2E_REAL_ALLOW_MUTATIONS=1`; crea datos auditables de prueba.
- Factura pendiente queda fuera del flujo principal; si se habilita luego debe ser accion secundaria con permiso y auditoria.

## Continuacion 2026-05-18

- `npm.cmd run smoke:real` ejecutado contra Vite/Laravel local con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`: smoke real no destructivo OK.
- `real-smoke.spec.ts` ignora solo el abort benigno de `/sanctum/csrf-cookie`; `401`, `419`, CORS, `pageerror`, `console.error` y requests fallidas inesperadas siguen bloqueando.
- `php artisan test --colors=never`: 124 tests / 724 assertions OK.
- `php artisan config:cache`: OK.
- `npm.cmd run test`: 20 tests OK.
- `npm.cmd run lint`: OK.
- `npm.cmd run build`: OK.
- `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`, `qa/RELEASE_READINESS.md` y `docs/KNOWN_LIMITATIONS.md` actualizados para reflejar Fase 12 como `PRODUCTION_CANDIDATE`, sin declarar `PRODUCTION_READY`.
