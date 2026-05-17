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
