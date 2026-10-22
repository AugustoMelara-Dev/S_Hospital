# T1-004 — Inventario real de rutas y superficies

Autor: hs-ux. Fecha: 2026-09-13. Raíz: `C:\Projects\S_Hospital_AI` (worktree aislado; fuente intocable `C:\Projects\S_Hospital`).
Método: lectura estática de código actual. Sin navegador, sin Playwright, sin inspección visual. Los números de línea citados provienen de la lectura directa del archivo en este worktree.

## 1. Fuentes de ruteo

| Fuente | Rol |
|---|---|
| `frontend/src/App.tsx:24-179` | Monta providers, sesión, login/cambio de clave y shell; decide qué se renderiza sin usar rutas |
| `frontend/src/AppRoutes.tsx:27-38` | Vistas lazy por `React.lazy` |
| `frontend/src/AppRoutes.tsx:110-292` | Tabla `<Routes>` completa |
| `frontend/src/navigation/appNavigation.ts:51-235` | Definiciones `appRoutes` con `requiredPermissions`, `permissionMode`, `deniedReason`, breadcrumbs y navegación |
| `frontend/src/components/PermissionGate.tsx:11-28` | Guard de permiso que renderiza `RouteState kind="denied"` |
| `frontend/src/navigation/appNavigation.ts:284-291` | `canAccessRoute` (default `all`) |
| `frontend/src/app/useHospitalSession.ts:22-52,262` | Traducción de permisos a capacidades y `defaultAuthenticatedRoute` |

## 2. Inventario de rutas declaradas

| # | Path | Elemento | Guard | Permisos requeridos (`appNavigation.ts`) | Fallback Suspense | Línea |
|---|---|---|---|---|---|---|
| 1 | `/` | `Navigate` → `/dashboard` | — | — | — | `AppRoutes.tsx:112` |
| 2 | `/login` | `Navigate` → `defaultAuthenticatedRoute` | — | — | — | `AppRoutes.tsx:113` |
| 3 | `/dashboard` | `DashboardView` | — | — (solo sesión + `hasAnyOperationalPermission`, `App.tsx:115-116`) | RouteState loading "Cargando módulo..." | `AppRoutes.tsx:114-135` |
| 4 | `/billing/new` | `NewInvoiceView` | `PermissionGate` | `invoices.create` + `catalog.view` + `cash.view` + `payments.create` + `receipts.view`, modo `all` (líneas 72-76) | loading "Cargando facturación..." | `AppRoutes.tsx:136-157` |
| 5 | `/cashbox` | `CashBoxView` | `PermissionGate` | `cash.view` (`appNavigation.ts:89-91`) | loading "Cargando caja..." | `AppRoutes.tsx:158-177` |
| 6 | `/catalog` | `CatalogView` | `PermissionGate` | `catalog.view` (`:104-106`) | loading "Cargando catálogo..." | `AppRoutes.tsx:179-188` |
| 7 | `/invoices` | `InvoiceHistoryView` | `PermissionGate` | `invoices.view` (`:119-121`) | loading "Cargando historial..." | `AppRoutes.tsx:189-198` |
| 8 | `/reports/*` | `ReportsView` | `PermissionGate` | `reports.managerial.view` \| `reports.cash_session.view` \| `audit.view`, modo `any` (`:134-137`) | loading "Cargando reportes..." | `AppRoutes.tsx:199-218` |
| 9 | `/backups` | `BackupsView` | `PermissionGate` | `backups.view` (`:150-152`) | loading "Cargando respaldos..." | `AppRoutes.tsx:219-228` |
| 10 | `/settings/fiscal` | `FiscalSettingsView` | `PermissionGate` | `settings.fiscal.view` \| `settings.operational.update`, modo `any` (`:165-168`) | loading "Cargando configuracion fiscal..." | `AppRoutes.tsx:229-243` |
| 11 | `/settings/institutional-receipts` | `Navigate` → `/settings/fiscal` (**ruta retirada hoy**) | — | definida en `appNavigation.ts:170-185` con `requiredPermissions: ['receipt_settings.view']`, `navigation: false` | — | `AppRoutes.tsx:244-247` |
| 12 | `/admin/users` | `UsersView` | `PermissionGate` | `users.view` (`:197-199`) | loading "Cargando usuarios..." | `AppRoutes.tsx:248-265` |
| 13 | `/support` | `SupportCenterView` | **sin gate de permiso** (solo sesión) | — | loading "Cargando soporte..." | `AppRoutes.tsx:266-273` |
| 14 | `/help` | `HelpView` | **sin gate de permiso** (solo sesión) | — | loading "Cargando ayuda..." | `AppRoutes.tsx:274-281` |
| 15 | `/about` | `AboutView` | **sin gate de permiso** (solo sesión) | — | loading "Cargando acerca de..." | `AppRoutes.tsx:282-289` |
| 16 | `*` | `NotFoundView` | — | — | — | `AppRoutes.tsx:290,295-304` |

Subrutas de `/reports` (secciones dentro de `ReportsView`, no rutas anidadas de React Router):
- `/reports` (raíz), `/reports/executive`, `/reports/cash`, `/reports/audit`; parseo en `ReportsView.tsx:77-85`, catálogo en `ReportsView.tsx:20-39`, redirección interna por permisos en `ReportsView.tsx:91-114`.
- La raíz y las subrutas comparten el mismo `PermissionGate` del elemento padre.

## 3. Superficies sin ruta propia (renderizado condicional)

| Superficie | Cómo se muestra | Evidencia |
|---|---|---|
| Login | `!session.user` → `LoginView` sin importar el path; `/login` solo redirige cuando ya hay sesión | `App.tsx:82-95`, `AppRoutes.tsx:113` |
| Cambio obligatorio de contraseña | `session.user.must_change_password` → `PasswordChangeView` | `App.tsx:97-105` |
| Caja rápida (diálogo) | `Dialog` en el shell con `CashBoxView` lazy | `App.tsx:155-176` |
| Tour guiado | `GuidedTour` montado en el shell; auto-apertura con `localStorage['hospital-onboarding-auto'] === 'true'` | `InstitutionalShell.tsx:144`, `GuidedTour.tsx:93-95` |
| Paleta de atajos | `KeyboardShortcutsPalette`, se abre con `?` | `InstitutionalShell.tsx:145`, `keyboard-shortcuts-palette.tsx:36-48` |
| Paleta de comandos | `CommandPalette`, se abre con `Ctrl+K` | `InstitutionalShell.tsx:79-89,143`, `CommandPalette.tsx:56-88` |
| Detalle de factura | Drawer dentro de `/invoices`, con deep link `?invoice=<id>` | `InvoiceHistoryView.tsx:147-170,866-891` |
| Recibo/comprobante | Diálogos dentro de `/billing/new` e `/invoices`; PDF se abre en pestaña con fallback a descarga | `NewInvoiceViewLayout.tsx:326-345`, `InvoiceHistoryView.tsx:918-961`, `lib/download.ts:12-23` |
| Error de render | `AppErrorBoundary` (envuelve todo el shell) | `App.tsx:30`, `AppErrorBoundary.tsx:40-61` |

## 4. Rutas omitidas, redirigidas o retiradas (con file:line)

1. **`/settings/institutional-receipts` retirada**: redirige a `/settings/fiscal` (`AppRoutes.tsx:244-247`). La vista `InstitutionalReceiptSettingsView` existe (`frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx:134`) pero **no está importada en `AppRoutes.tsx`**; solo la importan sus tests (`InstitutionalReceiptSettingsView.test.tsx:5`, `preInstallationAudit.test.ts:34-124` lee el fuente). El botón "Administrar recibos" (`FiscalSettingsView.tsx:88`) apunta a esa URL retirada: **enlace circular** que vuelve a la misma pantalla.
2. **Breadcrumb autorreferente**: `appNavigation.ts:176-178` declara migas "Configuracion → `/settings/fiscal` → Recibos e impresión → `/settings/fiscal`" (ambas al mismo path).
3. **`/verify-email` documentada pero inexistente**: `SYSTEM_REQUIREMENTS.md:118` la menciona como ruta de validación; no existe en `AppRoutes.tsx`. Dato para hs-release/F025, no un cambio UX.
4. **`/login` no es una pantalla real**: cuando no hay sesión, el path que sea muestra `LoginView`; navegar a `/login` autenticado redirige a `/dashboard` (o `/help` si el único permiso es `system.status.view`, `useHospitalSession.ts:262`).
5. **E2E que aún navegan a la ruta retirada** (código de specs, sin ejecutar): `accessibility.spec.ts:173`, `all-buttons-smoke.spec.ts:242`, `clinical-receipts.spec.ts:30`, `print-profiles.spec.ts:33,73,106`, `production-readiness.spec.ts:1147`, `rbac.spec.ts:40`, `refactor-total.spec.ts:46`, `settings-flow.spec.ts:60`, `v1-1-full-a11y.spec.ts:262`, `v1-2-full-a11y.spec.ts:262`, `v1-2-visible-ui-a11y.spec.ts:300,520`. Ver `10-hallazgos-hs-ux.md` (HS-UX-01/05) y F024.

## 5. Expectativas de ruta que los gates E2E exigen (solo lectura de specs)

- `accessibility.spec.ts:164-179` recorre: `/dashboard`, `/billing/new`, `/cashbox`, `/catalog`, `/invoices`, `/reports/executive`, `/backups`, `/settings/fiscal`, `/settings/institutional-receipts`, `/admin/users`, `/help`, `/support`, `/about`, ruta inexistente.
- `accessibility.spec.ts:181-189` define la matriz visual obligatoria: 1366x768 claro/oscuro, 1920x1080 claro/oscuro, 390x844 claro/oscuro, 1366x768 con zoom 125 %.
- `accessibility.spec.ts:333-344` añade reflow: 320, 768, 1024, 1280, 1600, 1920 px y equivalentes de zoom 125/200.
- Discrepancias ya detectadas contra el código actual (detalle en HS-UX-05):
  - `/settings/institutional-receipts` debía mostrar "Recibos institucionales" (`accessibility.spec.ts:173`) pero hoy redirige.
  - `/backups` debía titularse "Respaldos|Backups" (`accessibility.spec.ts:171`) pero el h1 actual es "Protección y recuperación" (`BackupsView.tsx:167`).
  - `/login` debía tener h1 con el nombre del hospital (`accessibility.spec.ts:368`) pero el h1 actual es "Iniciar sesión" (`LoginView.tsx:93`); el nombre del hospital es un `<strong>` en `InstitutionalIdentity.tsx:38`.
  - `settings-flow.spec.ts:49-56` espera h1 exacto "Configuración" y pestaña "Marca"; hoy el h1 es "Configuración hospitalaria" (`FiscalSettingsView.tsx:64`) y las pestañas son Resumen/Hospital/Numeración/Operativa (`FiscalSettingsView.tsx:79-82`).

## 6. Matriz permiso → superficie (según `useHospitalSession.ts:23-52`)

| Superficie | Ver | Operar |
|---|---|---|
| Dashboard | sesión + algún permiso operativo | acciones según capacidades |
| POS `/billing/new` | — | `invoices.create`, `catalog.view`, `cash.view`, `payments.create`, `receipts.view` (all) |
| Caja | `cash.view` | `cash.open`, `cash.close`, `cash.close_any` |
| Catálogo | `catalog.view` | `catalog.manage` |
| Historial | `invoices.view` | `payments.create`, `invoices.void`, `invoices.reverse`, `invoices.operate_any`, `receipts.view`, `receipts.reprint`, `receipts.reprint_any` |
| Reportes | alguna de `reports.managerial.view`, `reports.cash_session.view`, `audit.view`; export `reports.export` | — |
| Respaldos | `backups.view` | `backups.create`, `backups.download`, `system.status.view` |
| Configuración | `settings.fiscal.view` \| `settings.operational.update` | `settings.fiscal.update` |
| Recibos (retirada) | `receipt_settings.view` | `receipt_settings.update` (referenciado por specs/backend) |
| Usuarios | `users.view` | `users.create`, `users.update`, `users.disable`, `users.assign_admin_role` |
| EPO | — | `patients.mark_dialysis_prescription` |
| Soporte/Ayuda/Acerca de | solo sesión | — |

## 7. Límites de este inventario

- No se ejecutó la aplicación ni el navegador; no se levantó backend, ni `npm run build` (no hay `node_modules` en este worktree).
- Los estados de cada pantalla se documentan como contrato en los archivos 02-08; lo observado en código se marca como "existe" y lo exigido como "debe".
- La clasificación de severidad de hallazgos es propuesta de campaña, no política hospitalaria.
