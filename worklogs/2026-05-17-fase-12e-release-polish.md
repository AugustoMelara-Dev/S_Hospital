# Fase 12E - Release polish vendible

Fecha: 2026-05-17

## Alcance

- Reducir `frontend/src/App.tsx` para que sea orquestador y no contenedor monolitico de pantallas.
- Extraer login, cambio obligatorio de contrasena, dashboard y rutas privadas a modulos separados.
- Integrar Recharts en reportes para visual gerencial de servicios mas vendidos.
- Actualizar checklist final y guion premium con scanner, categorias, reportes, backups y limites fisicos.

## Archivos principales

- `frontend/src/App.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/features/auth/LoginView.tsx`
- `frontend/src/features/auth/PasswordChangeView.tsx`
- `frontend/src/features/dashboard/DashboardView.tsx`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/styles.css`
- `docs/DEMO_SCRIPT.md`
- `docs/05_DESIGN_SYSTEM_AND_LIBRARIES.md`
- `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`

## Criterios de aceptacion

- App shell sigue cargando con rutas separadas.
- Login y cambio de contrasena conservan comportamiento probado.
- Dashboard ya no vive dentro de `App.tsx`.
- Reportes muestran grafico real con datos calculados por backend.
- Documentacion de demo no vende como validado lo que requiere impresora fisica o cliente LAN real.

## Riesgos

- Prueba fisica de impresora 80mm/58mm depende del sitio.
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
- Sidebar/topbar/footer se ocultan al imprimir para que el recibo termico no arrastre navegacion.
- POS agrega confirmacion antes de emitir y antes de cobrar.
- POS muestra CTA a Caja cuando no hay caja abierta.
- Caja agrega confirmacion antes de cierre.
- Backend exige nota cuando el cierre tiene diferencia distinta de cero.
- `reports.view` ya no concede acceso historico a facturas ajenas.

## Validacion posterior a revision de subagentes

- `php artisan test --filter=CashPaymentsReceiptTest --colors=never`: 14 tests / 114 assertions OK.
- `php artisan test --filter=ReportsTest --colors=never`: 9 tests / 94 assertions OK.
- `php artisan test --filter=InvoiceHistoryReprintVoidTest --colors=never`: 13 tests / 91 assertions OK.
- `php artisan test --colors=never`: 114 tests / 638 assertions OK.
- `vendor/bin/pint --test`: OK.
- `npm.cmd run lint`: OK.
- `npm.cmd test`: 20 tests frontend OK.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run build`: OK.
- `php artisan config:cache`: OK.
- `npm.cmd run e2e`: 1 Playwright workflow OK.

## Pendiente real

- Reportes gerenciales siguen incompletos frente al plan corregido: anulaciones, reimpresiones, backups, filtros por categoria/metodo/estado y exportacion backend/autorizada.
- El flujo principal del POS todavia debe decidir formalmente si `Emitir pendiente` es permitido o si caja abierta es obligatoria antes de emitir.
- Falta smoke real con consola limpia contra Laravel/API, separado del E2E mockeado.
