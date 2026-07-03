# Refactor total S_Hospital - Auditoria viva

Fecha de ejecucion: 2026-07-02
Rama de trabajo: `codex/refactor-total`
Alcance actual: refactor total en fases pequenas; evidencia viva de baseline,
calidad backend/frontend y riesgos pendientes.

Este documento no sustituye al codigo, pruebas, migraciones ni contratos API. Es un registro operativo para guiar fases pequenas, verificables y commiteables del refactor total.

## 1. Estado baseline

### 1.1 Backend solicitado por Docker

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan migrate --seed` | OK: migraciones pendientes y seeders completados el 2026-07-02. |
| `docker compose exec backend php artisan test` | OK: 752 passed, 13 skipped, 4862 assertions; 497.84 s con timeout amplio. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 423 files checked, 0 errors. |
| `docker compose exec backend vendor/bin/phpstan analyse` | Falla operativa: worker paralelo termina con exit code 255. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: 211/211 files, no errors. |

### 1.2 Backend local

No aplica ejecucion en el host directo puesto que el entorno de desarrollo y
dependencias PHP se ejecutan completamente dentro de Docker Compose.

### 1.3 Frontend

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run lint` | OK |
| `docker compose exec frontend npm run typecheck` | OK |
| `docker compose exec frontend npm run test` | OK: 101 files, 557 tests. Advertencias de `act(...)` y TanStack Query quedan como higiene pendiente. |
| `docker compose exec frontend npm run build` | OK: Vite production build. |

### 1.4 E2E (Playwright)

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx playwright test` | Pendiente como suite completa. Existen gates focalizados verdes documentados en `docs/testing-report.md`. |

### 1.5 Respaldo de Seguridad ( Daño Controlado )

| Fecha | Archivo de Respaldo | Tamaño | Integridad (SHA256) |
|---|---|---|---|
| 2026-07-01 11:07 | `hospital-backup-20260701-110720-xogwnvml.sql.enc` | 1,576,476 bytes | Creado localmente en `backend/storage/app/private/backups` |



## 2. Stack confirmado

| Capa | Tecnologia encontrada |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 8, Tailwind 4, React Router 7, TanStack Query/Table, Radix UI, React Hook Form, Zod, lucide-react, Recharts, react-to-print. |
| Backend | Laravel 12, PHP 8.2+, Sanctum, Spatie Permission, DomPDF, PhpSpreadsheet, Pusher PHP Server. |
| Datos | MySQL/MariaDB via Docker Compose. |
| Tests | Vitest, Testing Library, axe-core, Playwright, PHPUnit, Pint, PHPStan/Larastan. |

No se agregaron dependencias en Fase 0.

## 3. Rutas actuales

### 3.1 Rutas web SPA

Rutas principales detectadas en `backend/routes/web.php`:

- `/dashboard`
- `/billing/new`
- `/cashbox`
- `/catalog`
- `/invoices`
- `/reports`
- `/reports/{path}`
- `/backups`
- `/settings/fiscal`
- `/settings/institutional-receipts`
- `/admin/users`
- `/help`
- `/support`
- `/about`

### 3.2 API critica

Rutas protegidas por `web`, `auth:web`, `user.active`, `password.changed` y throttling por usuario:

- Auth: `/auth/me`, `/auth/change-password`, `/auth/logout`
- Configuracion: `/settings/operational`, `/settings/fiscal`, `/settings/logo`
- Recibos: `/settings/institutional-receipts/*`, `/institutional-receipts/*`
- Catalogo: `/categories`, `/areas`, `/service-areas`, `/services`
- Facturacion: `/invoices`, `/invoices/{invoice}`, `/void`, `/reverse`, `/receipt`, `/reprint`
- Caja/pagos: `/cash-sessions/*`, `/payments/*`
- Reportes: `/reports/dashboard`, `/reports/today`, `/reports/executive`, `/reports/export`, `/reports/pdf`, `/reports/cash-sessions/{cashSession}`
- Respaldos: `/backups`, `/backups/{backupLog}/download`
- Sistema: `/system/status-summary`, `/system/status`, `/system/client-errors`
- Usuarios/roles: `/admin/users`, `/admin/roles`

Operaciones criticas como factura, pagos, caja, reversos, reimpresion, recibos y respaldos usan middleware `idempotency` en rutas relevantes.

## 4. Permisos actuales

Permisos sembrados en `RolesAndPermissionsSeeder`:

- Configuracion fiscal: `settings.fiscal.view`, `settings.fiscal.update`, `fiscal.sequences.reset`
- Catalogo: `catalog.view`, `catalog.manage`
- Facturas: `invoices.view`, `invoices.create`, `invoices.operate_any`, `invoices.void`, `invoices.reverse`
- Caja: `cash.view`, `cash.open`, `cash.close`, `cash.close_any`
- Pagos: `payments.create`, `payments.view`, `payments.void`
- Recibos: `receipts.view`, `receipts.reprint`, `receipts.reprint_any`, `receipts.void`, `receipts.print_test`
- Configuracion de recibos: `receipt_settings.view`, `receipt_settings.update`, `receipt_settings.advanced`
- Reportes: `reports.view`, `reports.managerial.view`, `reports.cash_session.view`, `reports.export`
- Usuarios: `users.view`, `users.create`, `users.update`, `users.disable`, `users.assign_admin_role`, `system.exact_user_permissions`
- Respaldos: `backups.view`, `backups.create`, `backups.download`
- Sistema/auditoria: `system.status.view`, `audit.view`
- Regla especial: `patients.mark_dialysis_prescription`

Roles existentes: `admin`, `supervisor`, `auditor`, `soporte_tecnico`, `cajero`.

## 5. Inventario frontend

### 5.1 Features vivas

- `about`
- `admin`
- `areas`
- `auth`
- `backups`
- `cash`
- `catalog`
- `dashboard`
- `help`
- `invoices`
- `onboarding`
- `receipt-settings`
- `receipts`
- `reports`
- `settings`
- `support`

### 5.2 Componentes UI base vivos

Existen componentes reutilizables para acciones, menus, alertas, dialogos, tablas, formularios, paginacion, estados, tabs, tooltips y formatos de dinero:

- `action-menu`, `alert`, `audit-log-list`, `badge`, `button`, `card`, `checkbox`, `confirm-dialog`, `data-table`, `date-range-picker`, `dialog`, `dropdown-menu`, `filter-bar`, `form-field`, `input`, `money-text`, `page-header`, `pagination`, `select`, `sheet`, `states`, `status-badge`, `table`, `tabs`, `textarea`, `toaster`, `tooltip`.

### 5.3 Modulos criticos inventariados

- Reportes: `ReportsView`, `ReportsExecutive`, `ReportsCash`, `ReportsAudit`, `ExecutiveSummary`, `TrendChart`, `PaymentMethodPanel`, `ServiceRanking`, `AuditSummaryPanel`, `CashSessionReportTab`, `CashReconciliationPanel`, `ReportFiltersPanel`, `MetricsGlossary`.
- Facturacion: `NewInvoiceView`, `PatientStep`, `ServiceSearch`, `InvoiceCart`, `PaymentModal`, `InvoiceConfirmation`, `InvoiceSuccess`, estado POS y tests.
- Historial: `InvoiceHistoryView`, `InvoiceHistoryTable`, `InvoiceHistoryHeader`, `InvoiceHistoryFilters`.
- Dashboard: `DashboardView`, `SetupWizardDialog`, `DashboardSetupStatusCard`.
- Caja: `CashBoxView`, `OpenSessionForm`, `CloseSessionDialog`, `CashClosingPanel`, `CashMovementsTable`, `CashMethodSummary`, `SessionSummary`, `SessionStatusCard`.
- Catalogo: `CatalogView`, `ServiceSheet`, `ServiceCatalogTable`, `CategorySheet`, `CatalogToolbar`, `CatalogPagination`, `ServiceStatusSummary`.
- Respaldos: `BackupsView`, `BackupHistoryTable`, `BackupStatusBadge`, `BackupExplanationCard`.
- Usuarios: `UsersView`, `UserFormDialog`, `RoleFormDialog`, `PasswordResetDialog`.
- Configuracion: `FiscalSettingsView`, `HospitalSettingsView`, `FiscalNumerationView`, `OperationalRulesView`, `BrandingView`.
- Layout: `AppShell`, `Sidebar`, `Topbar`, `AppBreadcrumbs`, `MobileNavigation`, `OperationalStatus`, `UserMenu`.
- Recibos: `InstitutionalReceiptSettingsView`, `ReceiptSettingsPreview`, `ReceiptPreview`.

## 6. Deuda encontrada por modulo

### UX/UI

- Reportes ya tiene 3 subrutas visibles (`executive`, `cash`, `audit`), pero aun usa `ReportFiltersPanel` y `MetricsGlossary`. No se puede sostener que esos componentes hayan sido eliminados.
- Se elimino `frontend/src/routes.ts`, archivo obsoleto no importado que conservaba etiquetas historicas `Fase 12A`.
- Algunos modulos siguen usando `SectionCard`/cards funcionales; hay que auditar visualmente si son operativas o decorativas.
- Hay 6 tests `it.skip`, principalmente en usuarios y cobertura reemplazada por componentes extraidos. Deben revisarse antes de declarar cobertura final.

### Seguridad

- Hay transacciones y locks en facturacion, pagos, caja, recibos y reimpresion.
- El middleware backend `idempotency` protege `POST /api/invoices`, pagos, anulaciones, reversos, caja, reimpresion, recibos institucionales y respaldos manuales con `Idempotency-Key` y respuestas 2xx cifradas en `idempotency_keys`.
- El frontend conserva claves estables por intento en factura, pago, apertura/cierre de caja y respaldo manual; las renueva solo tras exito confirmado.
- Backend rechaza campos avanzados de recibos sin `receipt_settings.advanced` con 403 y audita `receipt_settings.advanced_denied`.
- Hay permisos granulares y politicas/Form Requests en endpoints criticos.
- Pendiente: baseline backend oficial sigue bloqueado por puerto `3306`; en stack aislado pasan HealthCheck, Pint y PHPStan, pero la suite Laravel completa hizo timeout y no puede declararse verde.

### Accesibilidad

- Existen tests a11y para layout, dialogos, botones, recibos y specs Playwright con axe.
- Pendiente: `npx playwright test` completo hizo timeout; requiere ejecucion dividida o entorno estable.

### Impresion/recibos

- Flujo normal contiene selector de papel, copias, logo y sello/firma.
- Los campos tecnicos de ancho, alto, margenes, fuente y escala existen solo en panel avanzado `<details>` condicionado por permiso y soporte.
- El flujo normal ya no expone el permiso interno `receipt_settings.advanced`; hay test para evitar que reaparezca en la pantalla de papel y copias.
- Pendiente: validar visualmente que el preview impreso conserve carta/media carta/A5 como experiencia primaria y 80mm/58mm como compatibilidad secundaria.

### Reportes

- Consolidacion parcial lograda: 3 subrutas.
- Se extrajeron `ReportsExecutive.tsx`, `ReportsCash.tsx` y `ReportsAudit.tsx`; `ReportsView.tsx` queda como enrutador de subrutas y bajo de 505 a 128 lineas.
- `ServiceRanking` ya no usa tabs internos; muestra top por monto, cantidad, categoria y area como secciones visibles con prueba dedicada.
- El cliente frontend ya no expone metodos/tipos legacy para `daily`, `monthly`, `income`, `categories`, `areas`, `services` ni `operations`.
- Deuda: los endpoints backend antiguos siguen existiendo; hay que decidir si son compatibilidad API o codigo muerto antes de eliminarlos.

### Caja

- Cierre exige motivo con diferencia y hay locks/transacciones.
- Pendiente: validar visualmente si caja se siente como flujo de turno y no como acumulacion de tarjetas.

### Dashboard

- `DashboardView` ya usa `useDashboardReport` con TanStack Query para el resumen operativo; se elimino el fetching manual duplicado y el hook dejo de estar huerfano.
- La pantalla mantiene una accion primaria segun estado de caja, 4 KPIs y facturas recientes.

### Facturacion

- `PaymentModal` ya no expone `previewBeforePrint`; el cobro mantiene una accion primaria unica: registrar cobro e imprimir.
- Se elimino el estado/cableado `previewBeforePrint` del flujo POS. El recibo legacy se abre con autoimpresion tras registrar pago y el recibo institucional abre PDF directamente.
- Prueba dedicada valida que el modal no muestre controles de preview antes de imprimir.
- `InvoiceSuccess` pagada quedo con tres acciones: imprimir, crear otra factura y ver detalle; se elimino el boton duplicado `Ver recibo`.

### Usuarios

- Megacomponente fue reducido con dialogos extraidos, pero `UsersView.tsx` aun concentra bastante estado y tiene tests skipped.
- Se reactivo la prueba de `UserFormDialog` que valida que el campo de contrasena inicial solo exista al crear usuario, usando `rerender` para cubrir crear vs editar.
- Se reactivaron en `UsersView` los flujos integrados de politica de contrasena al crear usuario y edicion de usuario con mapa exacto de permisos vacio.
- Pendiente: revisar matriz de permisos por modulo y riesgo de permisos criticos en UI.

### Respaldos

- UI normal indica que restauracion no se hace desde la app.
- Backend contiene flujo de respaldo y auditoria de metadatos.
- El respaldo manual usa idempotencia estable desde `useCreateBackup` hasta `POST /api/backups`, evitando duplicar jobs si el operador reintenta tras timeout.
- Validado: restauracion no tiene ruta expuesta y `backups.restore` no aparece como permiso operativo normal.

### Configuracion fiscal

- Configuracion esta separada en vistas institucional, numeracion fiscal, reglas operativas y branding.
- Pendiente: validar que papel de recibo no vuelva a mezclarse en fiscal y que cambios fiscales pidan motivo en todos los caminos.

## 7. Riesgos tecnicos

- El baseline backend oficial esta bloqueado por Docker/puerto `3306`; con Docker aislado en puerto `33307`, HealthCheck, Pint y PHPStan pasan, pero `php artisan test` completo aun hace timeout.
- El host no tiene Composer y `backend/vendor` no contiene autoload/binarios; no se puede reconstruir backend local sin preparar entorno.
- Playwright completo excede 4 minutos; hay que ejecutar specs criticas por grupos y documentar tiempos.
- Hay historial de documentacion previa que afirma eliminaciones que el arbol actual no confirma.
- No se hizo backup en Fase 0 porque no hubo migraciones, cambios fiscales, schema, caja, settings ni numeracion. Antes de esas fases se debe verificar o crear backup.

## 8. Plan de ejecucion real

1. Resolver baseline backend: liberar/cambiar puerto 3306 o correr stack aislado con nombre/puertos no conflictivos; instalar dependencias PHP si se usa host.
2. Ejecutar backend completo: `php artisan test`, `pint --test`, `phpstan analyse`.
3. Ejecutar Playwright por grupos criticos: login/dashboard, recibos, facturacion, caja, reportes, usuarios, respaldos.
4. Corregir inconsistencias documentacion/codigo antes de afirmar fases completadas.
5. Empezar Fase 1/14 parcial solo con cambios pequenos y tests enfocados.
6. Mantener cada fase commiteable con Conventional Commits.

## 9. Criterios de aceptacion de Fase 0

- [x] Rama de trabajo creada.
- [x] Baseline frontend ejecutado y documentado.
- [x] Fallos backend/E2E documentados sin ocultarlos.
- [x] Inventario de rutas, permisos, modulos y componentes criticos.
- [x] Riesgos y siguiente plan documentados.
- [ ] Baseline backend oficial verde. Parcial en Docker aislado: HealthCheck/Pint/PHPStan OK; suite completa timeout.
- [ ] Playwright completo verde. Bloqueado por timeout.

## 10. Fase 1 - Design system incremental

Cambio aplicado:

- Se agrego `SearchInput` en `frontend/src/components/ui/search-input.tsx` como primitiva accesible para busquedas operativas.
- El componente usa label real, `type="search"`, icono decorativo y accion de limpiar solo cuando hay valor.
- Se migro `CatalogToolbar` para reemplazar busqueda hecha a mano con la primitiva nueva.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- src/components/ui/search-input.test.tsx` | RED inicial confirmado y luego verde: 2 tests pasan. |
| `npm run test -- src/components/ui/search-input.test.tsx src/features/catalog/CatalogView.test.tsx src/features/catalog/components/ServiceCatalogTable.test.tsx` | OK: 3 archivos, 21 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agrego libreria nueva. La necesidad era consolidar un patron repetido usando React, lucide-react y componentes locales existentes.

## 11. Fase 14 parcial - Seguridad de repo

Cambio aplicado:

- Se restauro `scripts/pre-commit-guard.ps1`, requerido por `.git/hooks/pre-commit.cmd` y documentado en `docs/SECRETS.md`.
- El guard inspecciona solo staged files/diffs y bloquea `.env` reales, `offline-release/`, `nginx/ssl/`, `APP_KEY`, passwords de DB, `HOSPITAL_LICENSE_SALT` y `HOSPITAL_INITIAL_ADMIN_PASSWORD` con valores no placeholder.
- `HOSPITAL_DUMP_BINARY` con ruta Windows queda como warning, no bloqueo, segun contrato existente.
- Se agrego `scripts/test_pre_commit_guard.ps1` con repos Git temporales para validar casos permitidos, bloqueados y warning-only.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test_pre_commit_guard.ps1` | RED por script faltante, luego OK: `pre-commit guard tests passed`. |

Decision:

- No se relajo el hook. Los commits anteriores usaron `--no-verify` solo porque el hook apuntaba a un archivo faltante; esta fase corrige esa deuda.

## 12. Fase 11 - Configuracion separada por dominio

Cambio aplicado:

- Se removio `Recibos` como tab dentro de `FiscalSettingsView`.
- La pantalla fiscal ahora se limita a hospital, numeracion, reglas operativas y marca.
- La administracion de recibos queda en la ruta dedicada `/settings/institutional-receipts`, enlazada desde el resumen fiscal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- src/features/settings/FiscalSettingsView.test.tsx` | RED por tab `Recibos` presente, luego OK: 3 tests pasan. |
| `npm run test -- src/features/settings/FiscalSettingsView.test.tsx src/features/settings/HospitalSettingsView.test.tsx src/features/settings/FiscalNumerationView.test.tsx src/features/settings/OperationalRulesView.test.tsx src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx src/navigation/appNavigation.test.ts src/AppRoutes.lazy.test.ts` | OK: 7 archivos, 22 tests pasan. |
| `npm run typecheck` | OK. |

Decision:

- No se tocaron migraciones, correlativos ni datos fiscales. Es un corte de UX/ruta para reducir mezcla de dominios.

## 13. Fase 5 - Idempotencia frontend para caja y respaldos

Cambio aplicado:

- `useOpenCashSession` y `useCloseCashSession` ahora generan una `Idempotency-Key` estable por intento con `createClientIdempotencyKey()`.
- `CashBoxView`, que ejecuta apertura/cierre directamente desde la pantalla operativa, tambien pasa una `Idempotency-Key` explicita por intento al cliente API.
- La clave se reutiliza si el intento falla y el operador reintenta; se limpia solo cuando el backend confirma exito.
- `useCreateBackup` aplica el mismo patron para respaldo manual.
- `frontend/src/lib/api/cash.ts`, `frontend/src/lib/api/backups.ts` y el facade `frontend/src/lib/api.ts` aceptan `options.idempotencyKey` y lo propagan al header `Idempotency-Key`.
- `docs/security-audit.md` quedo alineado con las rutas reales (`/api/invoices`, `/api/cash-sessions/open`, `/api/backups`) y con el middleware/tabla actuales (`idempotency`, `idempotency_keys`), no con la referencia antigua al modelo de idempotencia por operacion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- src/hooks/useCashSession.test.tsx` | RED inicial por llamadas sin options; luego OK: 3 tests pasan. |
| `npm run test -- src/hooks/useBackups.test.tsx` | RED inicial por llamadas sin options; luego OK: 10 tests pasan. |
| `npm run test -- src/hooks/useCashSession.test.tsx src/hooks/useBackups.test.tsx src/lib/api/cash.test.ts src/lib/api/backups.test.ts` | OK: 4 archivos, 17 tests pasan. |
| `npm run test -- src/lib/api/billing.test.ts src/hooks/useInvoices.test.tsx` | OK: 2 archivos, 4 tests pasan. |
| `npm run test -- src/hooks/useCashSession.test.tsx src/hooks/useBackups.test.tsx src/lib/api/cash.test.ts src/lib/api/backups.test.ts src/lib/api/billing.test.ts src/hooks/useInvoices.test.tsx` | OK: 6 archivos, 21 tests pasan. |
| `npm run test -- src/features/cash/CashBoxView.test.tsx` | RED inicial por llamadas directas sin options; luego OK: 8 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se tocaron migraciones, schema, correlativos ni datos fiscales. Es un corte frontend/API que completa el enlace con la proteccion backend ya existente para caja y respaldos.

### Fase 5 - Historial y recibos

Cambio aplicado:

- `frontend/src/lib/api/billing.ts` acepta `options.idempotencyKey` en anular factura, reversar factura, anular pago y reimprimir recibo legacy.
- `frontend/src/lib/api/institutionalReceipts.ts` acepta `options.idempotencyKey` en crear recibo institucional, registrar evento de impresion y descargar PDF con motivo por POST.
- `InvoiceHistoryView` genera claves estables por intento para anular, reversar, generar recibo institucional faltante y reimprimir recibos legacy/institucionales.
- Las claves se limpian tras exito confirmado; si falla la operacion, quedan disponibles para reintento del mismo intento operativo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- src/lib/api/billing.test.ts` | RED inicial por llamadas sin `idempotencyKey`; luego OK: 5 tests pasan. |
| `npm run test -- src/lib/api/institutionalReceipts.test.ts` | RED inicial por llamadas sin `idempotencyKey`; luego OK: 5 tests pasan. |
| `npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx` | RED inicial por llamadas sin options; luego OK: 16 tests pasan, 1 skipped existente. |
| `npm run test -- src/lib/api/billing.test.ts src/lib/api/institutionalReceipts.test.ts src/features/invoices/InvoiceHistoryView.test.tsx src/hooks/useCashSession.test.tsx src/hooks/useBackups.test.tsx src/hooks/useInvoices.test.tsx` | OK: 6 archivos, 41 tests pasan, 1 skipped existente. |
| `npm run typecheck` | OK. |

Decision:

- No se tocaron migraciones, schema ni correlativos. El backend ya exige `Idempotency-Key` en estas rutas `POST`; este corte evita que reintentos desde historial pierdan la clave gestionada por la UI.

## 14. Fase 7 - Cierre de caja guiado

Cambio aplicado:

- `CloseSessionDialog` ahora expone el cierre como flujo guiado de 3 pasos: resumen del turno, conteo de efectivo y confirmacion de cierre.
- La regla existente se conserva: si hay diferencia, la nota explicativa sigue siendo obligatoria antes de confirmar.
- Este corte no cambia calculos, cierre backend, caja historica, correlativos ni movimientos; solo reduce ambiguedad en la confirmacion operativa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- src/features/cash/components/CloseSessionDialog.test.tsx` | RED inicial por falta de pasos visibles; luego OK: 1 test pasa. |
| `npm run test -- src/features/cash/components/CloseSessionDialog.test.tsx src/features/cash/CashBoxView.test.tsx` | OK: 2 archivos, 9 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- Queda pendiente profundizar Fase 7 con impresion/exportacion de cierre y auditoria visual del layout completo de `/cashbox`.

## 15. Fase 10/15/20 - Reportes y E2E estabilizados

Cambio aplicado:

- `/reports` vuelve a ser una pantalla valida con `h1` propio y el reporte ejecutivo como contenido principal, sin redirigir a una subruta.
- `ReportsAudit` conserva los contadores institucionales del resumen ejecutivo y agrega una bitacora filtrable respaldada por `/api/system/audit-logs`.
- El backend expone `/api/system/audit-logs` protegido por `audit.view`, con filtros de accion, usuario y rango de fechas, paginacion y payload sin `old_values/new_values`.
- Los tests Playwright antiguos de historial ahora usan el `ActionMenu` real para `Reversar pago`.
- Los estados exitosos de respaldos usan texto con contraste AA (`text-success-foreground`).
- `playwright.config.ts` permite `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para ejecutar E2E con Chromium del sistema en entornos offline/LAN o contenedores sin navegador descargado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=AuditLogTest` | OK: 7 tests pasan. |
| `docker compose exec frontend npm run test -- ReportsAudit.test.tsx src/lib/api/system.test.ts` | OK: 2 archivos, 5 tests pasan. |
| `docker compose exec frontend npm run test` | OK: 102 archivos, 562 tests pasan tras repetir un timeout transitorio de `echo.test.ts`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/reports-flow.spec.ts` | OK: 3 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/all-buttons-smoke.spec.ts` | OK: 7 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/v1-2-full-a11y.spec.ts` | OK: 7 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/rc1-screens.spec.ts` | OK: 9 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/new-invoice-flow.spec.ts` | OK: 1 test pasa. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/invoice-history-flow.spec.ts` | OK: 1 test pasa. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/production-readiness.spec.ts` | OK: 4 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/refactor-total.spec.ts` | OK: 7 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test --workers=2` | OK: 73 tests pasan, 2 skips controlados (`release-gate`, `release-rbac`). |

Notas de entorno:

- Playwright completo en Docker ya puede arrancar navegador usando `/usr/bin/chromium-browser`.
- El primer intento de Playwright completo con navegador del sistema termino en `36 passed / 39 failed`; despues de estabilizar mocks y flujos, la corrida completa estable usa `--workers=2` y termina en `73 passed / 2 skipped`.
- `npx playwright install chromium` fallo dentro del contenedor por timeouts/DNS, por lo que la estrategia offline documentada es usar Chromium del sistema mediante variable de entorno.

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, schema, caja, correlativos ni datos fiscales.
- La suite Playwright completa queda ejecutada en Docker con concurrencia conservadora (`--workers=2`) por estabilidad en contenedor/offline.

## 16. Fase 13 - Acciones de usuarios agrupadas

Cambio aplicado:

- `UsersView` ya no muestra botones inline por fila para editar, restablecer clave y activar/desactivar usuario.
- Se agrego `UserActionMenu` como componente dedicado para construir acciones por permiso (`users.update`, `users.disable`) usando el `ActionMenu` compartido.
- Se extrajo `UsersTable` para sacar columnas, estado visual y acciones por fila fuera de `UsersView`.
- Se integro `PermissionMatrix` como vista de consulta de roles/permisos, visible solo cuando el operador puede gestionar roles y tiene `users.assign_admin_role`.
- La matriz usa encabezados por modulo, nombres humanos de rol y marcas `Si`/`No` para no depender solo de color.
- El flujo de desactivar usuario conserva confirmacion fuerte y no cambia reglas backend, auditoria, roles ni permisos.
- `e2e/users-flow.spec.ts` ahora valida el flujo real de dos pasos: abrir acciones de usuario y luego seleccionar `Desactivar`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx` | RED inicial por falta de `Acciones de usuario ...`; luego OK: 19 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin/components/UsersTable.test.tsx` | RED inicial por import faltante; luego OK: 2 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin/components/UsersTable.test.tsx src/features/admin/UsersView.test.tsx` | OK: 2 archivos, 21 tests pasan. |
| `docker compose exec frontend npx vitest run src/features/admin/components/PermissionMatrix.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial por senales corruptas/color-only y `tbody` anidado; luego OK: 3 tests pasan. |
| `docker compose exec frontend npx vitest run src/features/admin/UsersView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial por integracion incompleta de matriz; luego OK: 20 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npx eslint src/AppRoutes.tsx src/features/admin/UsersView.tsx src/features/admin/UsersView.test.tsx src/features/admin/components/PermissionMatrix.tsx src/features/admin/components/PermissionMatrix.test.tsx src/features/admin/components/UserActionMenu.tsx src/features/admin/components/UsersTable.tsx src/features/admin/components/UsersTable.test.tsx e2e/users-flow.spec.ts` | OK. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/users-flow.spec.ts --workers=1` | OK: 1 test pasa tras reiniciar el contenedor frontend para limpiar el bundle viejo servido por Vite. |
| `docker compose exec frontend npm run lint` | Bloqueado por trabajo no rastreado ajeno a esta subfase: `frontend/public/sw.js` introduce globals de service worker sin configuracion ESLint y variables `error` sin uso. No se tomo ese cambio en este commit. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, schema, caja, correlativos, settings ni datos fiscales.
- La pantalla de usuarios reduce acciones inline y avanza la division del megacomponente sin cambiar contratos API.

## 17. Fase 19/20 - PWA minima para operacion LAN

Cambio aplicado:

- Se agrego `frontend/public/sw.js` como service worker minimo para operacion LAN: precache de rutas base, `NetworkFirst` para `/api/*` con timeout y fallback JSON humano, y `CacheFirst` para assets GET del mismo origen.
- `frontend/src/main.tsx` registra el service worker solo en build de produccion y lo trata como best-effort para no bloquear el arranque de caja/facturacion.
- `frontend/e2e/pwa.spec.ts` valida manifest, presencia del service worker y enlace de manifest en `/login`.
- El service worker queda en ASCII, sin mojibake y con mensaje `Sin conexion LAN al servidor.`
- `frontend/eslint.config.js` vuelve a lintar `public/sw.js`; el archivo declara sus globals de service worker explicitamente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/pwa.spec.ts --workers=1` | RED inicial por comentario mojibake y luego OK: 3 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, schema, caja, correlativos, settings ni datos fiscales.
- Esta fase no promete operacion offline completa; solo asegura assets base y error LAN humano como avance incremental de Fase 19.

## 18. Fase 5/14/19 - CORS e idempotencia de API

Cambio aplicado:

- `backend/config/cors.php` deja de usar wildcards para metodos y headers: ahora permite metodos HTTP explicitos y los headers operativos `Content-Type`, `Authorization`, `X-Requested-With`, `X-XSRF-TOKEN` e `Idempotency-Key`.
- CORS expone `X-S-Hospital-Paper-Size-Warning` para que el frontend pueda avisar cambios de papel durante turno.
- Se agrego cobertura de preflight LAN/Vite para confirmar que `Idempotency-Key` y `X-XSRF-TOKEN` pasan CORS.
- Se agregaron pruebas de emision de factura con y sin `Idempotency-Key`: misma key y mismo payload reproduce la misma factura; sin key, dos submits crean dos facturas distintas.
- `docs/API_CONTRACTS.md` y `docs/security-audit.md` documentan las rutas idempotentes reales sin prometer idempotencia universal en mutaciones administrativas que no usan middleware.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter='duplicate_invoice_with_same_idempotency_key|invoice_without_idempotency_key'` | RED inicial por rutas incorrectas `/api/billing/invoices`; luego OK: 2 tests, 7 assertions. |
| `docker compose exec backend php artisan test --filter=HealthCheckTest` | RED inicial por comparacion de headers CORS y ubicacion de exposed headers; luego OK: 8 tests, 54 assertions. |
| `docker compose exec backend php artisan test --filter='duplicate_invoice_with_same_idempotency_key|invoice_without_idempotency_key|repeated_invoice_submit_with_same_idempotency_key|reused_invoice_idempotency_key'` | OK: 4 tests, 15 assertions. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: 213 archivos analizados. |
| `docker compose exec backend vendor/bin/pint tests/Feature/InvoiceCreationTest.php tests/Feature/HealthCheckTest.php` | OK: normalizo formato de tests. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 425 archivos. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, schema, correlativos fiscales, caja historica ni datos reales.
- La proteccion de doble submit sigue en backend mediante middleware `idempotency`; frontend debe seguir enviando claves estables solo para las operaciones criticas listadas en el contrato API.

## 19. Fase 8 - Acciones de catalogo consistentes

Cambio aplicado:

- `ServiceCatalogTable` deja de implementar su propio `DropdownMenu` para acciones de fila y usa el `ActionMenu` compartido.
- Las acciones `Editar`, `Desactivar` y `Activar` ahora muestran iconos lucide reconocibles dentro del menu, manteniendo el disparador icon-only con nombre accesible.
- La accion destructiva `Desactivar` conserva tono destructivo mediante el contrato del `ActionMenu`; no cambia callbacks, confirmacion, permisos ni reglas backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/catalog/components/ServiceCatalogTable.test.tsx` | RED inicial por items sin icono; luego OK: 4 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/catalog/components/ServiceCatalogTable.test.tsx src/features/catalog/CatalogView.test.tsx` | OK: 2 archivos, 23 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, schema, precios, facturas historicas ni reglas fiscales.
- Este corte avanza Fase 8 con una tabla de catalogo mas consistente y menos UI ad hoc.

## 20. Fase 12 - Orden operativo en historial de respaldos

Cambio aplicado:

- `BackupHistoryTable` reordena sus columnas a `Fecha`, `Estado`, `Tamano`, `Usuario`, `Acciones`, siguiendo la tabla simple definida para respaldos.
- El estado queda antes del tamano para que el operador vea primero si el respaldo sirve, esta pendiente o fallo.
- La columna de tamano conserva formato numerico y no se exponen nombre tecnico, SHA256, rutas ni mensajes crudos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx` | RED inicial por orden `Fecha, Tamano, Estado`; luego OK: 15 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, jobs, descargas, rutas de archivos, restauracion ni auditoria de respaldos.
- Este corte avanza Fase 12 con una tabla mas escaneable para operacion diaria.

## 21. Fase 9 - Encabezado claro en historial de facturas

Cambio aplicado:

- `InvoiceHistoryTable` reemplaza el encabezado abreviado `No.` por `Factura` en la primera columna.
- El cambio reduce ambiguedad en una tabla operativa donde el usuario busca por numero de factura, paciente, estado y saldo.
- No cambia datos, filtros, permisos, acciones de anulacion/reimpresion ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx` | RED inicial por ausencia del encabezado `Factura` y presencia de `No.`; luego OK: 20 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, schema, caja, correlativos fiscales ni recibos.
- Este corte avanza Fase 9 con una tabla de historial mas clara sin ampliar alcance funcional.

## 22. Fase 13 - Roles legibles en tabla de usuarios

Cambio aplicado:

- `UsersTable` deja de mostrar roles personalizados solo como strings tecnicos, por ejemplo `catalog_manager`.
- Los roles ahora muestran un nombre humano (`Catalog Manager`) y conservan el identificador tecnico en texto secundario cuando aporta auditoria operativa.
- Se extrajo `roleLabel` a `roleLabels.ts` para compartir el mismo formateo entre formulario, tarjetas de roles y tabla de usuarios.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/UsersTable.test.tsx` | RED inicial por ausencia de `Catalog Manager`; luego OK: 3 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx src/features/admin/components/UsersTable.test.tsx src/features/admin/components/UserFormDialog.test.tsx` | OK: 3 archivos, 28 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos reales, contratos API, roles protegidos ni reglas RBAC.
- Este corte avanza Fase 13 reduciendo strings tecnicos visibles en la operacion diaria sin ocultar trazabilidad del rol.

## 23. Fase 13/2 - Roles legibles en navegacion global

Cambio aplicado:

- `Topbar` y `Sidebar` dejan de construir etiquetas de rol con `user.roles.join(', ')`, lo que exponia strings tecnicos como `catalog_manager`.
- Se movio el formateador de roles a `src/lib/role-labels.ts` para compartirlo entre administracion y layout sin acoplar el shell a una feature.
- El menu de usuario y el pie del sidebar muestran `Catalog Manager` como nombre humano, reduciendo ruido tecnico en navegacion global.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/layout/AppShell.test.tsx` | RED inicial por ausencia de `Catalog Manager`; luego OK: 9 tests pasan. |
| `docker compose exec frontend npm run test -- src/layout/AppShell.test.tsx src/features/admin/UsersView.test.tsx src/features/admin/components/UsersTable.test.tsx src/features/admin/components/UserFormDialog.test.tsx` | OK: 4 archivos, 37 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos reales, contratos API, rutas ni reglas RBAC.
- Este corte avanza Fase 13 y Fase 2 haciendo que el shell global use nombres de rol humanos sin cambiar autorizacion.

## 24. Fase 13/15 - Matriz de permisos con etiquetas accesibles

Cambio aplicado:

- `PermissionMatrix` deja de usar `role.name` crudo en los `aria-label` de celdas de permisos.
- La matriz reutiliza `roleLabel` compartido para que lectores de pantalla anuncien nombres humanos como `Catalog Manager` en lugar de `catalog_manager`.
- Se elimino el formateador local duplicado de `PermissionMatrix`, manteniendo una sola fuente para etiquetas de roles.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/PermissionMatrix.test.tsx` | RED inicial por `aria-label` tecnico `catalog_manager`; luego OK: 4 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin/components/PermissionMatrix.test.tsx src/features/admin/UsersView.test.tsx src/layout/AppShell.test.tsx` | OK: 3 archivos, 33 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos reales, contratos API ni reglas RBAC.
- Este corte avanza Fase 13 y Fase 15: mejora la claridad de permisos tambien para tecnologia asistiva sin cambiar autorizacion.

## 25. Fase 13/15 - Riesgo visible en permisos criticos

Cambio aplicado:

- `RoleFormDialog` marca permisos sensibles con la etiqueta visible `Permiso critico`.
- La etiqueta se muestra junto al nombre humano del permiso, manteniendo el identificador tecnico en texto secundario para trazabilidad administrativa.
- Se cubren permisos de soporte de recibos, fiscal, anulaciones/reversiones, caja elevada, respaldos y usuarios, sin ampliar la matriz ni cambiar permisos reales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/RoleFormDialog.test.tsx` | RED inicial por ausencia de `Permiso critico`; luego OK: 5 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx src/features/admin/components/RoleFormDialog.test.tsx src/features/admin/components/PermissionMatrix.test.tsx` | OK: 3 archivos, 29 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, contratos API, roles protegidos, permisos reales ni reglas RBAC.
- Este corte sigue siendo compatible con el objetivo ajustado de una version monocomputadora estable: reduce riesgo al administrar usuarios basicos sin convertir permisos en una configuracion avanzada innecesaria.

## 26. Fase 6/9 - Recibo normal sin selector manual de papel

Cambio aplicado:

- `ReceiptPreview` deja de mostrar el selector manual de tamano de recibo en la vista normal de impresion.
- El fallback legacy de `InvoiceHistoryView` tambien deja de exponer `Tamano de vista previa`; usa el perfil/ancho ya cargado por el flujo.
- `NewInvoiceViewLayout` ya no pasa callbacks de cambio de ancho al recibo, reduciendo configuracion visible durante cobro, impresion y reimpresion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/receipts/ReceiptPreview.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx` | RED inicial por controles `Tamano del recibo` y `Tamano de vista previa`; luego OK: 29 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/receipts/ReceiptPreview.test.tsx src/features/receipts/ReceiptPreview.a11y.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx src/features/invoices/NewInvoiceView.test.tsx` | OK: 6 archivos, 44 tests pasan. La corrida mantiene warnings `act(...)` existentes en `NewInvoiceView.test.tsx`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK despues de retirar un import no usado. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, generacion PDF, auditoria de reimpresion, correlativos fiscales, pagos ni caja.
- Este corte avanza la version monocomputadora estable: el operador imprime con el perfil definido por el sistema y ya no ajusta papel desde la vista de recibo normal.

## 27. Fase 6/9 - Copy consistente con impresion simple

Cambio aplicado:

- `InvoiceHistoryView` deja de mencionar `Cambiar el tamano` en el modal de recibo legacy y en la confirmacion de reimpresion.
- El copy ahora indica que el fallback usa el perfil de papel configurado y que la reimpresion requiere motivo auditado.
- No se reintroducen controles manuales de papel ni opciones tecnicas en el flujo normal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx` | RED inicial por copy residual `Cambiar el tamano`; luego OK: 20 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx src/features/receipts/ReceiptPreview.test.tsx src/features/invoices/InstitutionalReceiptFlow.test.tsx` | OK: 3 archivos, 31 tests pasan. |
| `rg "Cambiar el tama|Tamano de vista previa|Tamano del recibo" frontend/src/features/invoices frontend/src/features/receipts -n` | Sin coincidencias; salida 1 esperada de `rg`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, generacion PDF, auditoria real, pagos, caja ni correlativos fiscales.
- Este corte evita instrucciones contradictorias para una operacion monocomputadora: el papel lo resuelve la configuracion, no el operador al imprimir.

## 28. Fase 4/17 - Nueva factura sin carga duplicada inicial

Cambio aplicado:

- `NewInvoiceView` deja de ejecutar una segunda busqueda de servicios al montar la pantalla con filtros vacios.
- La carga inicial de punto de venta queda como unica consulta de caja/catalogo al abrir `Nueva factura`; las busquedas debounced siguen ejecutandose cuando el cajero escribe o cambia filtros.
- Las pruebas del flujo esperan la carga inicial real antes de afirmar estados iniciales, eliminando warnings `act(...)` en el archivo focal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx` | RED inicial: la nueva prueba detecto 2 llamadas a `/api/services`; luego OK: 10 tests pasan sin warnings `act(...)`. |
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx src/features/receipts/ReceiptPreview.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx` | OK: 5 archivos, 43 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, pagos, recibos, auditoria, caja ni correlativos fiscales.
- Este corte reduce una llamada LAN innecesaria en el flujo critico de facturacion y deja una prueba explicita para evitar regresion.

## 29. Fase 4/20 - Cobertura real para error 422 al emitir

Cambio aplicado:

- La prueba `preserves the cart after a 422 error from the backend` ahora confirma la factura desde el dialogo, fuerza un POST real a `/api/invoices` y simula la respuesta 422 del backend.
- El test verifica que el carrito conserva `Eritropoyetina` y que se muestra el mensaje humano de validacion en la pantalla.
- Se elimina la falsa confianza anterior donde la prueba podia pasar antes de llegar al endpoint de emision.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx` | RED inicial por expectativa de copy incorrecta tras llegar al backend simulado; luego OK: 10 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron componentes de produccion, backend, pagos, recibos, caja ni correlativos fiscales.
- Este corte fortalece QA del flujo critico de facturacion: un 422 recuperable no debe vaciar el carrito del cajero.

## 30. Fase 7/16 - Cierre de caja explica saldo pendiente

Cambio aplicado:

- `CloseSessionDialog` ahora muestra una advertencia accionable cuando el cierre esta bloqueado por saldo pendiente aunque el conteo de facturas pendientes venga en cero.
- El boton `Cerrar caja` permanece deshabilitado mientras exista saldo pendiente, y el dialogo indica revisar Historial antes de cerrar.
- Se corrigio un fixture de `CashBoxView.test.tsx` para que el reporte de movimientos coincida con la sesion de caja renderizada y la suite no deje warnings de TanStack Query.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/cash/components/CloseSessionDialog.test.tsx` | RED inicial por ausencia de copy `Revise Historial antes de cerrar`; luego OK: 5 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/cash/CashBoxView.test.tsx src/features/cash/components/CloseSessionDialog.test.tsx src/features/cash/components/SessionSummary.test.tsx src/features/cash/components/CashMovementsTable.test.tsx src/features/cash/components/OpenSessionForm.a11y.test.tsx` | OK: 5 archivos, 21 tests pasan sin warnings. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, pagos, facturacion, recibos, auditoria ni correlativos fiscales.
- Este corte mejora el cierre guiado de caja para operacion monocomputadora: un bloqueo por saldo pendiente deja de ser silencioso.

## 31. Fase 8 - Tabla de catalogo sin codigos tecnicos

Cambio aplicado:

- `ServiceCatalogTable` mantiene columnas operativas fijas: Servicio, Categoria, Area, Precio, Estado y Acciones.
- La tabla principal ya no agrega columna `Codigo` ni expone scan code, barcode o QR aunque el escaner este habilitado.
- Los codigos siguen administrandose desde el formulario del servicio, donde pertenecen como configuracion puntual.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/catalog/components/ServiceCatalogTable.test.tsx` | RED inicial por columna `Codigo`; luego OK: 5 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx src/features/catalog/components/ServiceCatalogTable.test.tsx src/features/catalog/components/ServiceSheet.test.tsx src/features/catalog/components/CategorySheet.test.tsx` | OK: 4 archivos, 43 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, precios, auditoria, servicios facturados ni reglas de eritropoyetina.
- Este corte reduce ruido tecnico en Catálogo sin eliminar la administracion de codigos cuando soporte/administracion edita un servicio.

## 32. Fase 9 - Historial con identidad de factura bloqueada

Cambio aplicado:

- `InvoiceHistoryTable` mantiene visibles las columnas `Factura`, `Paciente` y `Acciones` aunque el usuario ajuste columnas.
- Las columnas secundarias de montos y estado siguen siendo ocultables para adaptar la tabla sin perder identidad ni operacion de fila.
- Se agrego cobertura para el menu `Columnas`, verificando que solo columnas opcionales aparezcan como ocultables.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx -t "keeps invoice identity"` | RED inicial porque `Factura` era ocultable; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx src/features/invoices/InstitutionalReceiptFlow.test.tsx` | OK: 2 archivos, 23 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, anulaciones, reimpresiones, permisos, pagos, caja ni recibos institucionales.
- Este corte evita que el historial quede sin identificadores esenciales durante busqueda, reimpresion o anulacion.

## 33. Fase 12 - Respaldos sin lenguaje de restauracion operativa

Cambio aplicado:

- `BackupsView` deja de mostrar el blocker `PENDING_RESTORE_VALIDATION` como una tarea de restauracion que el hospital deba ejecutar en la app.
- La vista normal ahora lo presenta como `Confirmar recuperacion con soporte`, coherente con la regla de que restaurar no esta disponible desde la UI normal.
- Se agrego cobertura acotada al alert `Pendientes antes de operar` para asegurar que no vuelva a aparecer lenguaje de `restaurar/restauracion` en esa lista operativa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx -t "restore validation blockers"` | RED inicial por `Validar restauracion segura`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx src/features/backups/components/BackupStatusBadge.a11y.test.tsx` | OK: 2 archivos, 19 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, jobs de respaldo, descarga, permisos, auditoria ni rutas de restore.
- Este corte mantiene la seriedad de recuperacion de datos sin convertir la restauracion en una accion visible de operacion diaria.

## 34. Fase 10 - Auditoria con busqueda por acciones humanas

Cambio aplicado:

- `ReportsAudit` reemplaza el placeholder tecnico `login, fiscal.update...` por ejemplos operativos: anulacion, reimpresion y cierre de caja.
- El filtro de accion acepta alias humanos comunes y los traduce al codigo de auditoria real antes de llamar al backend.
- Ejemplo probado: `anulacion` se envia como `invoice.voided`, manteniendo el contrato existente de `/api/system/audit-logs?action=...`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/reports/ReportsAudit.test.tsx -t "maps common human"` | RED inicial por placeholder tecnico; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/reports/ReportsAudit.test.tsx src/features/reports/ReportsView.subroutes.test.tsx src/features/reports/components/VoidsReversalsPanel.test.tsx src/features/reports/components/CashReconciliationPanel.test.tsx src/features/reports/components/PaymentMethodPanel.test.tsx src/features/reports/components/ServiceRanking.test.tsx` | OK: 6 archivos, 16 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos, auditoria almacenada, reportes de caja, exportaciones ni reglas fiscales.
- Este corte hace el reporte de auditoria mas util para operacion diaria sin eliminar la posibilidad de que soporte busque por codigo tecnico si lo necesita.

## 35. Fase 4 - Busqueda de servicios sin codigos internos en modo normal

Cambio aplicado:

- `ServiceSearch` deja de mencionar `codigo`, `scanner` o `lector` en el flujo normal cuando la opcion de scanner esta desactivada.
- La busqueda principal queda orientada a nombre, area o categoria, manteniendo el soporte de lector solo cuando `scanner_enabled` esta activo.
- Las etiquetas accesibles del control de lector pasan a lenguaje operativo (`Lector USB o entrada manual`) sin exponer valores internos en resultados.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/components/ServiceSearch.test.tsx` | RED inicial por menciones a `codigo/lector`; luego OK: 9 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx src/features/invoices/components/ServiceSearch.test.tsx` | OK: 2 archivos, 19 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, contratos API, caja, pagos, precios, catalogo ni reglas de eritropoyetina.
- Este corte reduce ruido tecnico en nueva factura sin quitar compatibilidad con lector cuando el hospital habilita scanner.

## 36. Fase 4 - Carrito vacio con guia operativa simple

Cambio aplicado:

- `InvoiceCart` deja de indicar que el cajero busque por codigo cuando la factura aun no tiene servicios.
- El empty state ahora orienta a buscar por nombre, area o categoria, consistente con el buscador normal de servicios.
- Se agrego cobertura para evitar que el texto de carrito vacio vuelva a exponer lenguaje de codigos internos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/components/InvoiceCart.test.tsx -t "accessible empty cart"` | RED inicial por `codigo`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/components/InvoiceCart.test.tsx src/features/invoices/components/ServiceSearch.test.tsx src/features/invoices/NewInvoiceView.test.tsx` | OK: 3 archivos, 27 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, emision, pagos, caja, catalogo ni calculos fiscales.
- Este corte mantiene el carrito centrado en la tarea de caja: agregar servicios facturables sin ruido tecnico.

## 37. Fase 8 - Busqueda principal de catalogo sin codigos internos

Cambio aplicado:

- `CatalogToolbar` deja de usar `Buscar por nombre o codigo...` como placeholder principal.
- La busqueda visible del catalogo queda orientada a nombre, categoria o area.
- Los codigos de scanner, barra y QR siguen disponibles en `ServiceSheet`, que es el lugar administrativo para configurar esos metadatos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx -t "search input"` | RED inicial por placeholder con `codigo`; luego OK: 2 tests filtrados pasan. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx src/features/catalog/components/ServiceCatalogTable.test.tsx src/features/catalog/components/ServiceSheet.test.tsx src/features/catalog/components/CategorySheet.test.tsx` | OK: 4 archivos, 43 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, precios, desactivacion, permisos, scanner operativo ni formularios de administracion.
- Este corte reduce ruido tecnico en la vista principal de catalogo sin eliminar trazabilidad de codigos cuando administracion edita un servicio.

## 38. Fase 4 - Cobro sin lenguaje tecnico de implementacion

Cambio aplicado:

- `PaymentModal` deja de mostrar la frase `El backend registra el pago final` en la ayuda del monto recibido.
- La ayuda visible ahora explica la accion en lenguaje de caja: se registrara el monto aplicado a la factura.
- Se agrego cobertura para evitar que reaparezca lenguaje de implementacion en el modal de cobro.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/components/PaymentModal.test.tsx -t "amount guidance"` | RED inicial por `backend`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/components/PaymentModal.test.tsx src/features/invoices/NewInvoiceView.test.tsx` | OK: 2 archivos, 29 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, pagos, caja, recibos, contratos API ni calculos de monto aplicado/cambio.
- Este corte mejora la claridad del cobro sin relajar la regla de que el servidor decide y registra el pago final.

## 39. Fase 6 - Perfiles tecnicos fuera del flujo normal de recibos

Cambio aplicado:

- `InstitutionalReceiptSettingsView` deja de mostrar `Recibo pequeno personalizado` a usuarios sin `receipt_settings.advanced`.
- El flujo normal de papel y copias ya no muestra avisos de ajustes avanzados ni mensajes de soporte tecnico.
- El modo soporte sigue existiendo solo para usuarios con permiso avanzado y perfil compatible.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx -t "technical support profiles"` | RED inicial por perfil tecnico visible; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx src/features/receipt-settings/ReceiptSettingsPreview.test.tsx src/features/receipts/ReceiptPreview.test.tsx src/features/receipts/ReceiptPreview.a11y.test.tsx` | OK: 4 archivos, 20 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, PDF, auditoria, correlativos fiscales, pagos ni caja.
- Este corte refuerza la regla absoluta de impresion: la operacion normal solo elige papel, copias, logo, sello/firma, prueba, guardado y vista previa real.

## 40. Fase 6 - Copy de papel sin jerga de implementacion

Cambio aplicado:

- `InstitutionalReceiptSettingsView` deja de mencionar `CSS`, `fuente` y `layout` en textos visibles del flujo normal de papel y copias.
- El copy queda orientado a la tarea: elegir papel y dejar que el sistema prepare la impresion.
- Se conserva el mensaje permitido de que los margenes se calculan automaticamente segun el tipo de papel.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx -t "operational paper copy"` | RED inicial por `CSS de impresion`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx src/features/receipt-settings/ReceiptSettingsPreview.test.tsx src/features/receipts/ReceiptPreview.test.tsx src/features/receipts/ReceiptPreview.a11y.test.tsx` | OK: 4 archivos, 21 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, PDF, auditoria, correlativos fiscales, pagos ni caja.
- Este corte mantiene el flujo normal de recibos en lenguaje operativo y deja los detalles tecnicos internos al sistema o al modo soporte.

## 41. Fase 10 - Filtros ejecutivos sin lenguaje de implementacion

Cambio aplicado:

- `ReportFiltersPanel` deja de mencionar `backend` en la descripcion visible del control ejecutivo.
- El copy ahora habla de datos del cierre operativo, manteniendo el foco en la tarea del usuario.
- Se agrego cobertura de componente para evitar que reaparezca lenguaje de implementacion en el panel de filtros.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/reports/components/ReportFiltersPanel.test.tsx` | RED inicial por `backend`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- src/features/reports/ReportsView.subroutes.test.tsx src/features/reports/ReportsAudit.test.tsx src/features/reports/components/ReportFiltersPanel.test.tsx src/features/reports/components/PaymentMethodPanel.test.tsx src/features/reports/components/ServiceRanking.test.tsx src/features/reports/components/CashReconciliationPanel.test.tsx src/features/reports/components/PendingAgingPanel.test.tsx src/features/reports/components/VoidsReversalsPanel.test.tsx src/features/reports/components/MetricsGlossary.test.tsx` | OK: 9 archivos, 20 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, contratos de reportes, exportaciones, permisos, caja ni facturacion.
- Este corte mejora la pantalla de reportes ejecutivos sin cambiar calculos ni filtros.

## 42. Fase 10 - Filtro de caja sin ejemplo tecnico

Cambio aplicado:

- `CashSessionReportTab` deja de mostrar el placeholder `Ej: 1` en el filtro de caja.
- El campo conserva el label `Numero de Caja` y ahora usa una guia operativa: `Numero mostrado en caja`.
- Se agrego cobertura para evitar que reaparezca un ejemplo numerico crudo en el filtro.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/reports/components/CashSessionReportTab.test.tsx -t "cash turn"` | RED inicial por `Ej: 1`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/reports/ReportsView.subroutes.test.tsx src/features/reports/ReportsAudit.test.tsx src/features/reports/components/ReportFiltersPanel.test.tsx src/features/reports/components/PaymentMethodPanel.test.tsx src/features/reports/components/ServiceRanking.test.tsx src/features/reports/components/CashReconciliationPanel.test.tsx src/features/reports/components/CashSessionReportTab.test.tsx src/features/reports/components/PendingAgingPanel.test.tsx src/features/reports/components/VoidsReversalsPanel.test.tsx src/features/reports/components/MetricsGlossary.test.tsx` | OK: 10 archivos, 25 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, contratos de reportes, exportaciones, permisos, caja ni facturacion.
- Este corte reduce ruido de identificadores internos en reportes de caja sin cambiar la consulta existente.

## 43. Fase 12 - Historial de respaldos sin restauracion operativa

Cambio aplicado:

- `BackupStatusBadge` deja de indicar `Valide restauracion` en respaldos exitosos del historial normal.
- La fila exitosa ahora confirma que el archivo fue creado y pide mantener una copia protegida.
- Se reforzo la prueba del historial para asegurar que la tabla normal no vuelva a sugerir restauracion como tarea de la app.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx -t "table with caption"` | RED inicial por `Valide restauracion`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx src/features/backups/components/BackupStatusBadge.a11y.test.tsx` | OK: 2 archivos, 19 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, jobs de respaldo, descargas, auditoria, rutas, permisos ni restauracion real.
- Este corte mantiene restauracion fuera de la UI normal y preserva el foco en crear, verificar estado y descargar respaldos locales.

## 44. Fase 13 - Permisos directos con riesgo visible

Cambio aplicado:

- `UserFormDialog` ahora marca permisos directos criticos con la misma etiqueta visible que el formulario de roles.
- La lista de permisos criticos se centralizo en `critical-permissions.ts` para evitar divergencias entre roles y usuarios.
- Se agrego cobertura para impedir que un permiso directo sensible vuelva a aparecer sin senal de riesgo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/UserFormDialog.test.tsx -t "critical direct permissions"` | RED inicial por ausencia de `Permiso critico`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx src/features/admin/components/UserFormDialog.test.tsx src/features/admin/components/RoleFormDialog.test.tsx src/features/admin/components/PermissionMatrix.test.tsx src/features/admin/components/UsersTable.test.tsx` | OK: 5 archivos, 38 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, politicas, endpoints, sesiones, auditoria ni asignacion real de permisos.
- Este corte reduce el riesgo operativo al asignar permisos directos sin ampliar alcance ni relajar RBAC.

## 45. Fase 13 - Confirmacion al guardar roles con permisos criticos

Cambio aplicado:

- `RoleFormDialog` ahora muestra una advertencia cuando el rol tiene permisos criticos seleccionados.
- El boton de guardar queda deshabilitado hasta que el administrador confirme explicitamente que el rol necesita esos accesos.
- `handleSubmit` tambien bloquea el envio por teclado si falta la confirmacion, no solo el click sobre el boton.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/RoleFormDialog.test.tsx -t "explicit confirmation"` | RED inicial porque el boton seguia habilitado; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx src/features/admin/components/UserFormDialog.test.tsx src/features/admin/components/RoleFormDialog.test.tsx src/features/admin/components/PermissionMatrix.test.tsx src/features/admin/components/UsersTable.test.tsx` | OK: 5 archivos, 39 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, politicas, endpoints, auditoria, usuarios existentes ni catalogo de permisos.
- Este corte mejora el flujo de administracion de roles sin cambiar la autorizacion final del servidor.

## 46. Fase 13 - Confirmacion al guardar usuarios con permisos directos criticos

Cambio aplicado:

- `UserFormDialog` ahora muestra advertencia cuando una cuenta tiene permisos directos criticos seleccionados.
- El boton de guardar/crear queda deshabilitado hasta que el administrador confirme explicitamente que la cuenta necesita esos accesos.
- El submit del formulario tambien bloquea el envio por teclado si falta la confirmacion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/admin/components/UserFormDialog.test.tsx -t "saving a user with critical"` | RED inicial porque el boton seguia habilitado; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/admin/UsersView.test.tsx src/features/admin/components/UserFormDialog.test.tsx src/features/admin/components/RoleFormDialog.test.tsx src/features/admin/components/PermissionMatrix.test.tsx src/features/admin/components/UsersTable.test.tsx` | OK: 5 archivos, 40 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, politicas, endpoints, auditoria ni asignacion final de permisos.
- Este corte hace que la administracion de permisos directos sea mas deliberada sin cambiar RBAC del servidor.

## 47. Fase 13 - Rol con modo soporte de recibos tratado como elevado

Cambio aplicado:

- `RoleCatalog` ahora considera `receipt_settings.advanced` como permiso elevado al evaluar roles operativos personalizados.
- Un gestor con `users.create` pero sin `users.assign_admin_role` ya no puede asignar a otra cuenta un rol personalizado que habilite modo soporte tecnico de recibos.
- Se agrego prueba feature para cubrir la escalada mediante rol personalizado existente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=UserManagementTest::test_user_manager_without_admin_assignment_permission_cannot_assign_custom_role_with_advanced_receipt_permission` | RED inicial: el backend respondia 201; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test tests/Feature/UserManagementTest.php tests/Feature/RoleManagementTest.php` | OK: 40 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 425 archivos revisados. |
| `docker compose exec backend vendor/bin/phpstan analyse` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, datos fiscales, recibos, caja, facturas ni politicas de impresion.
- Este corte cierra una ruta de escalada por rol personalizado sin cambiar el contrato de API.

## 48. Fase 4 - Factura emitida sin permisos de cobro

Cambio aplicado:

- `InvoiceConfirmation` ahora recibe `canOpenPayment` y solo anuncia `Emitir y abrir cobro` cuando la cuenta puede cobrar e imprimir recibos.
- `NewInvoiceViewLayout` pasa la capacidad real `canCreatePayments && canViewReceipts` al dialogo de confirmacion.
- `NewInvoiceView` muestra un mensaje operativo cuando la factura queda emitida pero pendiente de cobro por falta de permisos: solicitar a caja cobrar e imprimir el recibo.
- Se agrego cobertura para asegurar que este flujo no vuelva a prometer cobro automatico ni muestre un mensaje tecnico de permisos completos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx -t "pending-payment warning"` | RED inicial por dialogo/promesa de cobro incorrecta; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx src/features/invoices/components/InvoiceConfirmation.test.tsx src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/InvoiceCart.test.tsx src/features/invoices/components/PaymentModal.test.tsx` | OK: 5 archivos, 43 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, caja, pagos, recibos ni permisos reales.
- Este corte reduce confusion de caja: emitir factura y cobrar quedan diferenciados cuando la cuenta no tiene autorizacion para completar el cobro.

## 49. Fase 4 - Exito sin accion imposible de cobro

Cambio aplicado:

- `InvoiceSuccess` ahora distingue entre factura pendiente de pago y cuenta autorizada para cobrar.
- Cuando una cuenta sin permisos de cobro/recibo emite una factura, el dialogo de exito ya no ofrece `Cobrar ahora`.
- En ese caso la accion principal pasa a `Crear otra factura` y el texto indica que el cobro queda pendiente para caja.
- `NewInvoiceViewLayout` pasa `canCreatePayments && canViewReceipts` tambien al dialogo de exito, no solo a la confirmacion previa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx -t "pending-payment warning"` | RED inicial porque aparecia `Cobrar ahora`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx src/features/invoices/components/InvoiceConfirmation.test.tsx src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/InvoiceCart.test.tsx src/features/invoices/components/PaymentModal.test.tsx` | OK: 5 archivos, 43 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, caja, pagos, recibos ni permisos reales.
- Este corte evita una accion inutil para usuarios que solo emiten facturas y reduce friccion en operacion monocomputadora.

## 50. Fase 4 - Factura gratuita respeta permiso de recibos

Cambio aplicado:

- `NewInvoiceView` ya no solicita el recibo legacy automaticamente cuando una factura pagada en cero se emite desde una cuenta sin permiso de recibos.
- `InvoiceSuccess` ahora recibe `canPrintReceipt` y oculta `Imprimir recibo institucional` cuando la cuenta no puede ver/imprimir recibos.
- El dialogo de exito mantiene una salida segura: crear otra factura y solicitar apoyo a caja para imprimir el recibo.
- Se agrego cobertura para impedir que la ruta `/api/invoices/{id}/receipt` se llame desde este flujo sin permiso.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx -t "zero-total invoice"` | RED inicial porque se llamaba `/api/invoices/56/receipt`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/NewInvoiceView.test.tsx src/features/invoices/components/InvoiceConfirmation.test.tsx src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/InvoiceCart.test.tsx src/features/invoices/components/PaymentModal.test.tsx` | OK: 5 archivos, 44 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, caja, pagos ni generacion real de recibos.
- Este corte reduce riesgo de exposicion/impresion de recibos por UI cuando la cuenta solo puede emitir facturas.

## 51. Fase 9 - Historial oculta generacion de recibos sin permiso de cobro

Cambio aplicado:

- `InvoiceHistoryView` ahora calcula `canIssueInstitutionalReceipt` con `receipts.view` y `payments.create`, alineado con la autorizacion del backend para emitir recibos institucionales faltantes.
- `InvoiceHistoryTable` usa ese permiso compuesto solo para mostrar `Generar PDF`.
- Los usuarios con solo `receipts.view` conservan `Ver recibo` y `Descargar` cuando el recibo ya existe, pero no ven una accion que el backend rechazaria con 403.
- La fixture de usuario administrador del test de historial incluye `payments.create` para representar una cuenta que realmente puede generar recibos faltantes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx -t "does not offer institutional receipt generation"` | RED inicial porque `Generar PDF` seguia visible; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx` | OK: 22 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, caja, pagos, endpoints ni generacion real de recibos.
- Este corte reduce acciones imposibles en historial y mantiene la defensa principal en RBAC backend.

## 52. Fase 9 - Historial respeta acceso operativo para abrir recibos

Cambio aplicado:

- `InvoiceHistoryTable` ahora calcula por fila si el usuario puede abrir/descargar el recibo antes de mostrar `Ver recibo` o `Descargar`.
- El fallback legacy solo se ofrece a usuarios con `receipts.reprint_any` o a quien emitio la factura durante el dia operativo actual, igual que `ShowReceiptRequest`.
- El PDF institucional existente se ofrece cuando el usuario tiene acceso operativo amplio (`receipts.reprint_any`, `invoices.void`, `invoices.operate_any`) o es factura propia del dia; si ya tuvo eventos de impresion tambien exige `receipts.reprint`.
- Se agrego cobertura para impedir que un lector de recibos vea acciones sobre facturas ajenas o antiguas que el backend rechazaria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx -t "does not expose receipt actions"` | RED inicial porque el menu de acciones seguia visible; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx` | OK: 23 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, caja, pagos, endpoints ni generacion real de recibos.
- Este corte reduce 403 previsibles desde la UI y mantiene el backend como fuente de verdad de RBAC.

## 53. Fase 12 - Respaldo exitoso visible aunque la lista este filtrada

Cambio aplicado:

- `BackupsView` ahora toma el KPI `Ultimo exitoso` desde `systemStatus.backups.last_success_at` cuando el snapshot operativo esta disponible.
- Si la tabla visible esta filtrada o solo contiene respaldos fallidos, la pantalla ya no comunica falsamente `Sin respaldo` cuando existe un respaldo protegido reciente.
- El texto auxiliar del KPI queda global: `Respaldo protegido mas reciente`, no ligado a la pagina actual.
- Se elimino el contador local `successCount` porque el tono del KPI depende del respaldo protegido real.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx -t "last successful backup KPI"` | RED inicial porque el KPI mostraba `Sin respaldo`; luego OK: 1 test focal pasa. |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx src/features/backups/components/BackupStatusBadge.a11y.test.tsx` | OK: 2 archivos, 20 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx` | OK: 17 tests pasan despues de limpiar lint. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, jobs, descarga ni creacion real de respaldos.
- Este corte mejora la confiabilidad operativa de la pantalla normal de respaldos sin exponer nombres tecnicos, rutas ni checksum.

## 54. Fase 8 - Catalogo bloquea precios cero antes del API

Cambio aplicado:

- `ServiceSheet` ahora valida que el precio capturado sea mayor que cero, alineado con las reglas `gt:0` del backend Laravel.
- El formulario conserva la validacion de formato monetario con hasta dos decimales, pero evita enviar `0`, `0.0` o `0.00`.
- La pantalla muestra el mensaje humano `Precio debe ser mayor que cero` y no llama a `apiClient.saveService` cuando el precio no es cobrable.
- Se agrego cobertura TDD para crear servicio con precio cero sin depender del rechazo tardio del API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx --runInBand` | ERROR de comando: Vitest no soporta `--runInBand` en este repo. Se corrigio el comando y no cuenta como verificacion funcional. |
| `npm run test -- ServiceSheet.test.tsx` | RED inicial porque no aparecia `Precio debe ser mayor que cero`; luego OK: 12 tests pasan. |
| `npm run test -- ServiceSheet.test.tsx ServiceCatalogTable.test.tsx` | OK: 2 archivos, 17 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, facturas, caja ni historicos.
- Este corte reduce errores operativos en caja/catalogo y mantiene el backend como fuente de verdad fiscal.

## 55. Fase 8 - Desactivar servicios sin invocar borrado

Cambio aplicado:

- `CatalogView` ya no usa `apiClient.deleteService` para la accion operativa `Desactivar`.
- La confirmacion ahora llama `apiClient.saveService(..., id)` con `active: false`, igual que la activacion usa `active: true`.
- El backend conserva su defensa: `DELETE /api/services/{id}` sigue rechazando servicios facturados con 409 y no borra historicos.
- Se extrajo un helper local para construir el payload de cambio de estado sin duplicar campos del servicio.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CatalogView.test.tsx -t "without deleting"` | RED inicial porque `saveService` no era llamado; luego OK: 1 test focal pasa. |
| `npm run test -- CatalogView.test.tsx ServiceCatalogTable.test.tsx ServiceSheet.test.tsx` | OK: 3 archivos, 36 tests pasan. |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest` | OK: 34 tests pasan; confirma que DELETE de servicio facturado sigue protegido con 409. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, facturas ni snapshots.
- Este corte permite desactivar servicios ya facturados desde la UI normal sin intentar borrar ni romper historial fiscal.

## 56. Fase 9 - Historial oculta anular/reversar fuera de alcance operativo

Cambio aplicado:

- `InvoiceHistoryTable` ahora exige alcance operativo por fila antes de mostrar `Anular factura` o `Reversar pago`.
- Las acciones peligrosas se exponen solo si el usuario tiene `invoices.operate_any` o si la factura es propia del dia operativo actual, ademas del permiso nominal `invoices.void` o `invoices.reverse`.
- La fixture `adminUser` del historial incluye `invoices.operate_any` para representar el alcance operativo que tiene una cuenta administrativa real.
- Se agrego cobertura para un cajero con permisos nominales de anular/reversar pero sin alcance operativo sobre facturas ajenas o antiguas.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "without operational invoice scope"` | RED inicial porque el menu de acciones seguia visible; luego OK: 1 test focal pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx` | OK: 24 tests pasan. |
| `docker compose exec backend php artisan test --filter=InvoiceHistoryReprintVoidTest` | OK: 18 tests pasan, 118 assertions; confirma que el backend conserva la defensa de policy. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, caja, pagos, endpoints ni datos fiscales.
- Este corte reduce 403 previsibles desde historial sin convertir el frontend en fuente de verdad de RBAC.

## 57. Fase 13 - Usuarios oculta acciones propias bloqueadas por backend

Cambio aplicado:

- `AppRoutes` pasa el `currentUserId` autenticado a `UsersView`.
- `UsersTable` detecta la fila del usuario actual y no expone `Restablecer clave` ni `Desactivar` para esa cuenta.
- `UserActionMenu` separa el permiso visual de editar del permiso visual de restablecer clave, manteniendo `Editar` disponible cuando corresponde.
- Se agrego cobertura para confirmar que la fila propia conserva `Editar`, pero no ofrece auto-reset ni auto-desactivacion; una cuenta objetivo distinta conserva las acciones autorizadas.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "self password reset"` | RED inicial porque `Restablecer clave` seguia visible en la fila propia; luego OK: 1 test focal pasa. |
| `npm run test -- UsersView.test.tsx UsersTable.test.tsx UserFormDialog.test.tsx RoleFormDialog.test.tsx PermissionMatrix.test.tsx` | OK: 5 archivos, 41 tests pasan. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 31 tests pasan, 129 assertions; confirma que el backend bloquea auto-reset y auto-desactivacion. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, roles seeders ni permisos.
- Este corte evita acciones previsiblemente rechazadas por RBAC backend y reduce errores operativos en administracion de usuarios.

## 58. Fase 13 - Usuarios respeta cuentas protegidas sin permiso administrativo

Cambio aplicado:

- `UsersTable` ahora recibe `canAssignAdminRole` y evalua por fila si el objetivo tiene rol protegido (`admin` o `root`).
- Un gestor con `users.update` o `users.disable`, pero sin `users.assign_admin_role`, ya no ve acciones por fila sobre cuentas protegidas.
- Las cuentas operativas no protegidas conservan `Editar`, `Restablecer clave` y `Desactivar` segun permisos exactos.
- Se agrego cobertura para confirmar que la fila admin queda en modo consulta para gestores no autorizados, mientras una cuenta cajero sigue operable.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "protected user actions"` | RED inicial porque el menu de la cuenta admin seguia visible; luego OK: 1 test focal pasa. |
| `npm run test -- UsersView.test.tsx UsersTable.test.tsx UserFormDialog.test.tsx RoleFormDialog.test.tsx PermissionMatrix.test.tsx` | OK: 5 archivos, 42 tests pasan. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 31 tests pasan, 129 assertions; confirma que el backend bloquea modificar cuentas protegidas sin `users.assign_admin_role`. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, seeders ni nombres de permisos.
- Este corte alinea la UI de usuarios con la policy backend sin relajar RBAC ni ampliar privilegios.

## 59. Fase 10 - Reporte de caja no expone busqueda sin permiso

Cambio aplicado:

- `ReportsCash` ahora muestra un estado sin permisos antes de exponer el formulario de consulta de caja.
- La ruta directa `/reports/cash` ya no muestra el campo `Numero de Caja` ni el boton `Ver caja` cuando el usuario no tiene `canViewCashSessionReport` ni permiso gerencial.
- Se agrego cobertura de subruta para confirmar que el lookup operativo queda oculto y que no se invoca `getCashSessionReport` sin permiso visual.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsView.subroutes.test.tsx` | RED inicial porque el formulario de caja seguia visible sin permiso; luego OK: 4 tests pasan. |
| `npm run test -- ReportsView.subroutes.test.tsx CashSessionReportTab.test.tsx PaymentMethodPanel.test.tsx ServiceRanking.test.tsx` | OK: 4 archivos, 13 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, caja, pagos ni endpoints.
- Este corte no sustituye RBAC backend; reduce exposicion de controles operativos de reportes y evita consultas previsiblemente no autorizadas desde la UI.

## 60. Fase 10 - Reportes aterriza en caja para usuarios solo caja

Cambio aplicado:

- La raiz `/reports` ahora selecciona `Caja` cuando el usuario no puede ver reportes gerenciales pero si puede consultar reportes de caja.
- `ReportsNavigation` usa estado activo controlado por la subruta resuelta, evitando depender de `NavLink` cuando la URL raiz representa una seccion permitida distinta.
- Se agrego cobertura para confirmar que `Caja` queda marcada como pagina actual, se renderiza la operacion de caja y no aparece el estado de falta de permiso ejecutivo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsView.subroutes.test.tsx -t "only permitted report"` | RED inicial porque `Caja` no quedaba activa ni reemplazaba Ejecutivo; luego OK: 1 test focal pasa. |
| `npm run test -- ReportsView.subroutes.test.tsx` | OK: 5 tests pasan. |
| `npm run test -- ReportsView.subroutes.test.tsx CashSessionReportTab.test.tsx PaymentMethodPanel.test.tsx ServiceRanking.test.tsx` | OK: 4 archivos, 14 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints ni permisos.
- Este corte mejora la navegacion consolidada de reportes sin ampliar acceso: la subruta ejecutiva directa sigue mostrando estado sin permiso cuando corresponde.

## 61. Fase 10 - Reporte de caja muestra carga durante consulta LAN

Cambio aplicado:

- `ReportsCash` ahora mantiene `cashLoading` mientras consulta una caja por numero.
- El boton `Ver caja` pasa a `Consultando...` y queda deshabilitado durante la peticion, evitando clics repetidos y dando feedback inmediato.
- Se agrego una prueba de componente para confirmar que `getCashSessionReport` recibe el numero solicitado y que el control queda bloqueado mientras la promesa esta pendiente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsCash.test.tsx` | RED inicial porque el boton seguia como `Ver caja`; luego OK: 1 test pasa. |
| `npm run test -- ReportsCash.test.tsx ReportsView.subroutes.test.tsx CashSessionReportTab.test.tsx` | OK: 3 archivos, 11 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints ni permisos.
- Este corte mejora feedback operativo del reporte de caja sin cambiar contratos API ni reglas de acceso.

## 62. Fase 4 - Carrito muestra importe estimado por linea

Cambio aplicado:

- `InvoiceCart` reemplaza el dato ambiguo `Importe base` por `Importe estimado` calculado con precio unitario y cantidad.
- La previsualizacion de linea muestra `L 0.00` cuando la eritropoyetina tiene receta de dialisis marcada, manteniendo el aviso textual de gratuidad.
- Se agrego cobertura para cantidad mayor a uno y para eritropoyetina con receta, sin convertir el frontend en fuente de verdad fiscal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceCart.test.tsx -t "estimated line totals"` | RED inicial porque la fila mostraba `Importe base` y el precio unitario; luego OK: 1 test focal pasa. |
| `npm run test -- InvoiceCart.test.tsx` | OK: 9 tests pasan. |
| `npm run test -- InvoiceCart.test.tsx NewInvoiceView.test.tsx PaymentModal.test.tsx InvoiceConfirmation.test.tsx InvoiceSuccess.test.tsx` | OK: 5 archivos, 44 tests pasan. |
| `docker compose exec backend php artisan test --filter=InvoiceDialysisPrescriptionTest` | OK: 5 tests pasan, 34 assertions; confirma defensa backend de permiso y auditoria. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, pagos, caja ni correlativos.
- El backend sigue decidiendo totales fiscales; este corte solo mejora la claridad operativa del carrito antes de emitir.

## 63. Fase 7 - Cierre con diferencia exige nota util

Cambio aplicado:

- `CloseCashSessionAction` ahora rechaza cierres con diferencia cuando la nota tiene menos de 5 caracteres.
- `CloseSessionDialog` aplica el mismo umbral visual: la nota corta queda `aria-invalid`, el boton `Cerrar caja` se mantiene deshabilitado y el error explica el minimo.
- Se agrego cobertura backend y frontend para evitar cierres con explicaciones vacias o triviales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=CloseCashSessionDifferenceTest::test_closing_cash_session_with_short_notes_when_diff_is_nonzero_returns_422` | RED inicial porque `notes=x` cerraba la caja; luego cubierto por suite del archivo. |
| `npm run test -- CloseSessionDialog.test.tsx -t "useful note"` | RED inicial porque la nota corta se trataba como valida; luego cubierto por suite del archivo. |
| `docker compose exec backend php artisan test --filter=CloseCashSessionDifferenceTest` | OK: 3 tests pasan, 11 assertions. |
| `npm run test -- CloseSessionDialog.test.tsx` | OK: 6 tests pasan. |
| `npm run test -- CashBoxView.test.tsx CloseSessionDialog.test.tsx CashMovementsTable.test.tsx SessionSummary.test.tsx` | OK: 4 archivos, 19 tests pasan. |
| `docker compose exec backend php artisan test --filter=CloseCashSessionTest` | OK: 3 tests pasan, 11 assertions. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron schema, migraciones, pagos, facturas, correlativos ni datos existentes.
- Este corte fortalece cierre de caja y auditoria sin cambiar el calculo de diferencia ni el movimiento contable.

## 64. Fase 9 - Anulacion exige motivo util en accion de dominio

Cambio aplicado:

- `VoidInvoiceAction` ahora rechaza motivos de anulacion menores a 5 caracteres antes de abrir la transaccion y antes de mutar la factura.
- Se agrego cobertura directa contra la accion de dominio para evitar que un flujo interno pueda saltarse la validacion `min:5` del Form Request.
- La prueba confirma que una factura con motivo corto sigue `issued`, sin `void_reason`, `voided_by` ni `voided_at`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=InvoiceHistoryReprintVoidTest::test_void_action_rejects_short_reason_before_mutating_invoice` | RED inicial porque `abc` anulaba la factura; luego OK: 1 test pasa, 2 assertions. |
| `docker compose exec backend php artisan test --filter=InvoiceHistoryReprintVoidTest` | OK: 19 tests pasan, 120 assertions. |
| `docker compose exec backend php artisan test --filter=InvoiceReverseTest` | OK: 8 tests pasan, 45 assertions. |
| `docker compose exec backend vendor/bin/pint --test app/Actions/Billing/VoidInvoiceAction.php tests/Feature/InvoiceHistoryReprintVoidTest.php` | OK: 2 archivos pasan. |
| `docker compose exec backend vendor/bin/phpstan analyse app/Actions/Billing/VoidInvoiceAction.php tests/Feature/InvoiceHistoryReprintVoidTest.php` | Incompleto: PHPStan alcanzo el memory limit configurado de 128M. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M app/Actions/Billing/VoidInvoiceAction.php tests/Feature/InvoiceHistoryReprintVoidTest.php` | OK: sin errores. |
| `git diff --check -- backend/app/Actions/Billing/VoidInvoiceAction.php backend/tests/Feature/InvoiceHistoryReprintVoidTest.php docs/refactor-total-audit.md` | OK: sin whitespace errors. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron schema, migraciones, frontend, caja, pagos ni correlativos.
- El endpoint ya validaba `reason` con `min:5`; este corte refuerza la regla en la accion critica para que el backend siga protegido aunque cambie el controlador o aparezca otro flujo interno.

## 65. Fase 8 - Cambios de precio e impuesto exigen motivo util

Cambio aplicado:

- `UpdateServiceRequest` ahora exige al menos 5 caracteres en `price_change_reason` y `tax_change_reason` cuando se envian.
- Se agrego cobertura para rechazar cambios de precio e impuesto con motivo trivial como `x`.
- Las pruebas confirman que el precio, el estado tributario y el historial de precios no se mutan cuando el motivo es insuficiente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=UpdateServicePriceReasonTest::test_price_change_with_short_reason_returns_422` | RED inicial porque `price_change_reason=x` actualizaba el precio; luego OK: 1 test pasa, 5 assertions. |
| `docker compose exec backend php artisan test --filter=UpdateServicePriceReasonTest::test_tax_change_with_short_reason_returns_422` | RED inicial porque `tax_change_reason=x` actualizaba el impuesto; luego OK: 1 test pasa, 4 assertions. |
| `docker compose exec backend php artisan test --filter=UpdateServicePriceReasonTest` | OK: 7 tests pasan, 26 assertions. |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest` | OK: 34 tests pasan, 206 assertions. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Requests/Catalog/UpdateServiceRequest.php tests/Feature/UpdateServicePriceReasonTest.php` | OK: 2 archivos pasan. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M app/Http/Requests/Catalog/UpdateServiceRequest.php tests/Feature/UpdateServicePriceReasonTest.php` | OK: sin errores. |
| `git diff --check -- backend/app/Http/Requests/Catalog/UpdateServiceRequest.php backend/tests/Feature/UpdateServicePriceReasonTest.php` | OK: sin whitespace errors. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron schema, migraciones, frontend, facturacion, caja, pagos ni correlativos.
- Este corte fortalece la trazabilidad del catalogo sin cambiar precios existentes ni reglas de busqueda/facturacion.

## 66. Fase 12 - KPI de respaldos pendientes usa estado del servidor

Cambio aplicado:

- `BackupsView` ahora usa `systemStatus.backups.pending_count` para el KPI principal de pendientes cuando el estado operativo esta disponible.
- La lista visible sigue siendo solo respaldo local para el KPI mientras carga el estado del servidor.
- Se agrego cobertura para asegurar que el KPI no se vuelve falso cuando el historial visible esta filtrado o paginado y no incluye respaldos pendientes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "keeps the pending KPI"` | RED inicial porque el KPI mostraba `0` y `Sin pendientes visibles` aunque el servidor reportaba `3`; luego OK: 1 test focal pasa. |
| `npm run test -- BackupsView.test.tsx` | OK: 18 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, permisos, creacion de respaldos ni descargas.
- Este corte mejora la confiabilidad operativa de la pantalla de respaldos sin exponer rutas, SHA256 ni nombres tecnicos en la vista normal.

## 67. Fase 12 - KPI de respaldos fallidos usa contador del servidor

Cambio aplicado:

- `/api/system/status` ahora incluye `data.backups.failed_count` con el total de respaldos fallidos registrados.
- `BackupsView` usa `systemStatus.backups.failed_count` para el KPI principal de fallidos cuando esta disponible, con fallback a la lista visible para compatibilidad.
- Se agrego cobertura frontend para asegurar que el KPI no queda en cero cuando el historial visible esta filtrado o paginado y no incluye fallos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=SystemStatusTest::test_admin_can_view_operational_status_without_secret_values` | RED inicial porque `data.backups.failed_count` era `null`; luego OK: 1 test, 39 assertions. |
| `npm run test -- BackupsView.test.tsx -t "keeps the failed KPI"` | RED inicial porque el KPI mostraba `0` y `Sin errores visibles` aunque el servidor reportaba `2`; luego OK: 1 test focal pasa. |
| `docker compose exec backend php artisan test --filter=SystemStatusTest` | OK: 19 tests pasan, 124 assertions. |
| `npm run test -- BackupsView.test.tsx` | OK: 19 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Controllers/SystemStatusController.php tests/Feature/SystemStatusTest.php` | OK: 2 archivos pasan. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M app/Http/Controllers/SystemStatusController.php tests/Feature/SystemStatusTest.php` | OK: sin errores. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron schema, migraciones, creacion de respaldos, descargas ni permisos.
- El campo frontend queda opcional para tolerar respuestas antiguas o parciales durante QA, pero el estado operativo completo del backend ya entrega el contador autoritativo.

## 68. Fase transversal - Menus de acciones cierran al seleccionar

Cambio aplicado:

- `ActionMenu` deja que Radix cierre el menu despues de seleccionar una accion habilitada.
- Las acciones deshabilitadas conservan `preventDefault()` para evitar selecciones accidentales.
- Se reemplazo la prueba smoke por una prueba real de interaccion: abrir menu, seleccionar accion y verificar que el menu ya no bloquea la pantalla.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- action-menu.test.tsx -t "closes the menu"` | RED inicial porque la accion se ejecutaba pero el menu quedaba abierto; luego OK: 1 test focal pasa. |
| `npm run test -- action-menu.test.tsx` | OK: 4 tests pasan. |
| `npm run test -- InvoiceHistoryView.test.tsx` | OK: 24 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, permisos, caja, facturacion fiscal ni correlativos.
- Este corte mejora las acciones por fila en historial, reportes, catalogo y demas tablas que usan el menu compartido, evitando que un menu abierto oculte/bloquee la siguiente accion del operador.

## 69. Fase 9 - Historial conserva el recibo seleccionado ante respuestas tardias

Cambio aplicado:

- `InvoiceHistoryView` ahora usa un identificador de solicitud vigente para `Ver recibo`.
- Si una solicitud anterior de detalle o recibo termina despues de que el operador ya eligio otra factura, la respuesta obsoleta no cambia el dialogo ni muestra errores atrasados.
- Se agrego cobertura para dos aperturas consecutivas de recibo donde la primera respuesta llega tarde y la pantalla debe conservar la segunda factura.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "keeps the latest receipt selection"` | RED inicial porque la respuesta tardia de la primera factura reemplazaba el dialogo vigente; luego OK: 1 test focal pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx` | OK: 25 tests pasan. |
| `npm run test -- action-menu.test.tsx` | OK: 4 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, permisos, anulaciones, pagos ni correlativos.
- Este corte reduce errores operativos por doble seleccion rapida en historial sin cambiar las reglas de auditoria, reimpresion o recibo institucional.

## 70. Fase 4/7 - Cobro no se duplica si falla recibo legacy

Cambio aplicado:

- `NewInvoiceView` separa el exito del pago del fallo posterior al cargar el recibo legacy.
- Si `/api/invoices/{id}/payments` registra el pago y luego falla `/api/invoices/{id}/receipt`, el modal de cobro se cierra, se muestra el dialogo de exito con advertencia y se indica reimprimir desde Historial.
- Se agrego cobertura para el caso de pago exitoso con recibo legacy fallido, evitando mostrar "No se pudo registrar el pago" despues de que caja ya quedo cobrada.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView.test.tsx -t "keeps payment registered"` | RED inicial porque el fallo del recibo caia en el `catch` general, dejaba el modal de cobro abierto y trataba el pago registrado como fallo de pago; luego OK. |
| `npm run test -- NewInvoiceView.test.tsx` | OK: 13 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, permisos, caja, correlativos ni reglas fiscales.
- Este corte reduce riesgo de doble cobro cuando la emision del recibo secundario falla despues de registrar un pago valido.

## 71. Fase 6/11 - Recibos conservan direccion institucional al editar

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora precarga `address` y `slogan` desde los ajustes recibidos del servidor.
- Se agrego cobertura para verificar que la direccion institucional guardada aparece antes de editar datos del recibo.
- Evita que un guardado posterior de la pantalla de recibos pierda datos institucionales ya configurados.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "preloads saved institutional address"` | RED inicial porque el campo Direccion cargaba vacio aunque el backend entregaba `address`; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx` | OK: 8 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, perfiles de papel, correlativos ni permisos.
- Este corte protege configuracion institucional existente sin reabrir el flujo tecnico de impresion.

## 72. Fase 6 - Flujo normal de impresion oculta activacion de perfiles

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ya no muestra "Perfil activo" ni "Predeterminado global" en el flujo normal de Papel y copias.
- Esos controles quedan disponibles solo para usuarios con permiso de soporte avanzado de recibos.
- La pantalla normal conserva papel, copias, logo, sello/firma, impresion de prueba y guardar perfil como controles operativos principales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "does not expose profile activation"` | RED inicial porque el flujo normal mostraba "Perfil activo"; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx` | OK: 9 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, perfiles guardados, correlativos ni permisos.
- Este corte reduce opciones tecnicas visibles para el operador normal sin cambiar valores existentes de los perfiles.

## 73. Fase 12 - Respaldos vacios muestran una sola accion primaria

Cambio aplicado:

- `BackupsView` conserva el boton principal "Crear respaldo" en el encabezado.
- El estado vacio deja de renderizar un segundo boton "Crear respaldo", evitando dos acciones primarias identicas en la misma pantalla.
- El mensaje del estado vacio sigue guiando al operador sin duplicar controles.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "single create backup action"` | RED inicial porque la pantalla vacia mostraba dos botones "Crear respaldo"; luego OK. |
| `npm run test -- BackupsView.test.tsx` | OK: 20 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, permisos, creacion de respaldos ni descargas.
- Este corte reduce ruido operacional en la pantalla inicial de respaldos sin cambiar seguridad ni auditoria.

## 74. Fase 8 - Cambio de rol actualiza permisos directos del usuario

Cambio aplicado:

- `UserFormDialog` avisa al contenedor cuando cambia el rol operativo seleccionado.
- `UsersView` recarga la plantilla de permisos directos del rol elegido cuando el operador administra permisos exactos.
- Al crear un usuario con rol operativo personalizado, los permisos visibles y el payload guardado quedan alineados con la plantilla del rol.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "updates the direct permission template"` | RED inicial porque cambiar a `Catalog manager` no marcaba `Catalog view`; luego OK. |
| `npm run test -- UsersView.test.tsx` | OK: 23 tests pasan. |
| `npm run test -- UserFormDialog.test.tsx UsersView.test.tsx` | OK: 30 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, endpoints, roles protegidos ni validaciones Laravel.
- Este corte reduce riesgo de crear cuentas operativas con un rol visible pero sin los permisos exactos esperados.

## 75. Fase 10 - Periodos rapidos aplican fechas reales en reportes

Cambio aplicado:

- `ReportFiltersPanel` ahora aplica `date_from` y `date_to` al seleccionar un periodo rapido como Hoy, 7 dias, Este mes o Mes anterior.
- La opcion Personalizado conserva el rango manual vigente.
- El reporte ejecutivo deja de mostrar un periodo rapido que no correspondia al rango consultado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportFiltersPanel.test.tsx -t "updates the date range"` | RED inicial porque `onChange` no se llamaba al seleccionar `last7`; luego OK. |
| `npm run test -- ReportFiltersPanel.test.tsx` | OK: 2 tests pasan. |
| `npm run test -- ReportFiltersPanel.test.tsx ReportsView.subroutes.test.tsx` | OK: 7 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, endpoints, exportaciones PDF/Excel, permisos ni calculos financieros del reporte.
- Este corte hace que los filtros ejecutivos sean operables para caja/supervision diaria sin obligar a ajustar fechas manualmente.

## 76. Fase 4 - Historial distingue vista de recibo y reimpresion auditada

Cambio aplicado:

- `InvoiceHistoryTable` ahora muestra `Reimprimir PDF` cuando un recibo institucional ya tiene eventos de impresion.
- Los recibos institucionales sin impresiones previas conservan `Ver recibo`.
- La accion que exige motivo de reimpresion deja de presentarse como una vista simple del recibo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "requires a reprint reason"` | RED inicial porque el menu seguia mostrando `Ver recibo`; luego OK. |
| `npm run test -- InvoiceHistoryView.test.tsx` | OK: 25 tests pasan. |
| `npm run test -- InvoiceHistoryView.test.tsx -t "allows receipt viewers"` | OK: conserva la vista de recibo sin reimpresion para lectura autorizada. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, endpoints, auditoria, correlativos, PDF institucional ni permisos.
- Este corte reduce confusion operacional en historial: abrir una copia ya impresa se anuncia como reimpresion auditada antes de pedir motivo.

## 77. Fase 2 - Caja usa apertura como respaldo del efectivo esperado

Cambio aplicado:

- `SessionSummary` usa `opening_amount` como fallback cuando el servidor legado no entrega `expected_cash_amount` ni `expected_amount`.
- `CloseSessionDialog` aplica el mismo fallback antes de confirmar el cierre.
- La pantalla evita mostrar `Efectivo esperado` como `L 0.00` en sesiones abiertas con monto inicial conocido.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- SessionSummary.test.tsx CloseSessionDialog.test.tsx -t "opening amount as expected cash fallback"` | RED inicial porque ambos componentes mostraban esperado `L 0.00`; luego OK. |
| `npm run test -- SessionSummary.test.tsx CloseSessionDialog.test.tsx CashBoxView.test.tsx` | OK: 18 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, endpoints, pagos, cierre real de caja ni permisos.
- Este corte mantiene consistente la conciliacion visual de caja con el fallback ya usado por la vista principal.

## 78. Fase 6 - Soporte avanzado de recibos no ensucia perfiles normales

Cambio aplicado:

- `InstitutionalReceiptSettingsView` deja de mostrar el aviso pasivo "Modo soporte no aplica aqui" mientras el usuario de soporte tiene seleccionado un perfil estandar.
- El panel de soporte tecnico sigue disponible solo cuando se selecciona el perfil personalizado de recibo pequeno y existe `receipt_settings.advanced`.
- El flujo normal de papel mantiene foco en papel, copias, logo, sello/firma, imprimir prueba y guardar.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "keeps support-only warnings hidden"` | RED inicial porque el aviso de soporte aparecia en Media carta; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx` | OK: 10 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, endpoints, permisos, auditoria ni generacion PDF.
- Este corte reduce ruido para soporte sin relajar la barrera real: los campos manuales siguen gobernados por `receipt_settings.advanced`.

## 79. Fase 10 - Exportacion ejecutiva muestra progreso real

Cambio aplicado:

- `ReportsExecutive` ahora usa estado renderizable para marcar una exportacion en curso.
- Al preparar PDF o Excel ejecutivo, los botones de exportacion muestran `Exportando...` y los controles de refresco/exportacion quedan deshabilitados hasta finalizar la descarga.
- La proteccion contra doble ejecucion se mantiene sin cambiar filtros, calculos financieros ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsExecutive.test.tsx -t "shows export progress"` | RED inicial porque los botones seguian mostrando `PDF ejecutivo`/`Excel ejecutivo`; luego OK. |
| `npm run test -- ReportsExecutive.test.tsx ReportFiltersPanel.test.tsx ReportsView.subroutes.test.tsx` | OK: 8 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, endpoints, exportadores PDF/Excel, permisos ni agregados financieros.
- Este corte mejora la operacion LAN cuando una exportacion tarda: el operador ve progreso y evita acciones repetidas.

## 80. Fase 10 - Reporte de caja exporta Excel real

Cambio aplicado:

- `ReportsCash` deja de pasar un handler vacio al boton `Exportar Excel`.
- La exportacion usa `apiClient.downloadReportExport` con `cash_session_id` y las fechas de apertura/cierre de la caja cargada.
- El archivo se descarga como `reporte-caja-{id}.xlsx` y el boton muestra estado de exportacion mientras la descarga esta en curso.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsCash.test.tsx -t "exports the loaded cash"` | RED inicial porque `downloadReportExport` nunca se llamaba; luego OK. |
| `npm run test -- ReportsCash.test.tsx CashSessionReportTab.test.tsx ReportsView.subroutes.test.tsx` | OK: 12 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, permisos, calculos de caja ni formato del Excel del servidor.
- Este corte convierte una accion visible de caja en una operacion real, alineada con reportes utiles para cierre y auditoria local.

## 81. Fase 7 - Cambio de estado conserva alias de servicio

Cambio aplicado:

- `CatalogView` conserva `aliases` al construir el payload de activar/desactivar un servicio desde la tabla.
- La confirmacion de desactivacion sigue sin borrar servicios ni cambiar precios, ISV, codigos o reglas especiales.
- La busqueda operativa por alias queda protegida ante cambios rapidos de estado en catalogo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CatalogView.test.tsx -t "requires confirmation before deactivating"` | RED inicial porque el payload no incluia `aliases`; luego OK. |
| `npm run test -- CatalogView.test.tsx ServiceSheet.test.tsx ServiceCatalogTable.test.tsx CategorySheet.test.tsx` | OK: 44 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, endpoints, permisos ni reglas fiscales.
- Este corte preserva metadata de busqueda del catalogo durante cambios de disponibilidad para caja.

## 82. Fase 13 - Descargar respaldos exige confirmacion critica

Cambio aplicado:

- `backups.download` se marca como permiso critico en el catalogo central usado por roles y permisos directos de usuario.
- `RoleFormDialog` exige confirmacion explicita antes de guardar un rol que puede descargar respaldos.
- `UserFormDialog` exige la misma confirmacion antes de guardar un permiso directo de descarga de respaldos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- RoleFormDialog.test.tsx UserFormDialog.test.tsx -t "download backups"` | RED inicial porque `backups.download` no mostraba `Permiso critico`; luego OK. |
| `npm run test -- UsersView.test.tsx UsersTable.test.tsx UserFormDialog.test.tsx RoleFormDialog.test.tsx PermissionMatrix.test.tsx PasswordResetDialog.test.tsx` | OK: 45 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, politicas ni descarga real de archivos.
- Este corte reduce escalacion accidental: descargar una copia de la base hospitalaria requiere la misma pausa explicita que otros permisos de alto riesgo.

## 83. Fase 13 - Descarga valida integridad del respaldo

Cambio aplicado:

- `BackupController` valida tamano y SHA-256 del archivo local contra el registro `backup_logs` antes de servir una descarga.
- Si el archivo fue alterado o la metadata de integridad no esta disponible, la descarga responde 404 y queda auditada como `backup.download_denied` con motivo `integrity_mismatch`.
- La auditoria `backup.downloaded` solo se escribe despues de superar estado, disco, path seguro, raiz local e integridad del archivo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `php artisan test --filter=test_download_refuses_backup_when_file_integrity_no_longer_matches_log` | RED inicial porque un archivo manipulado se descargaba con 200; luego OK. |
| `php artisan test --filter=BackupWorkflowTest` | OK: 26 tests pasan, 135 assertions. |
| `vendor/bin/pint --test app/Http/Controllers/BackupController.php tests/Feature/BackupWorkflowTest.php` | Falla inicial por estilo en el test nuevo; se corrigio con Pint. |
| `vendor/bin/phpstan analyse` | Falla inicial por limite de memoria 128M; `vendor/bin/phpstan analyse --memory-limit=512M` OK sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron frontend, rutas, migraciones, permisos, jobs de creacion de backups ni formato de archivos.
- Este corte evita entregar respaldos locales cuyo contenido ya no coincide con el checksum registrado, manteniendo la falla como 404 para no exponer detalles operativos.

## 84. Fase 6 - Recibo legacy no expone ids internos

Cambio aplicado:

- `GenerateReceiptDataAction` deja de serializar `invoice.id` y `payment.id` en el payload del recibo legacy.
- `ReceiptData` en frontend refleja el contrato visible del recibo: numero de factura, paciente, servicios, totales y pagos sin ids internos.
- `ReceiptPreview` usa una clave compuesta de datos visibles del pago para renderizar la lista sin depender de ids internos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `php artisan test --filter=test_receipt_uses_invoice_item_snapshots_and_supports_institutional_paper_sizes` | RED inicial porque `data.invoice.id` seguia presente; luego OK. |
| `php artisan test --filter=CashPaymentsReceiptTest` | OK: 32 tests pasan, 352 assertions. |
| `npm run typecheck` | Falla inicial por fixtures tipados con ids internos; luego OK. |
| `npm run test -- ReceiptPreview.test.tsx ReceiptPreview.a11y.test.tsx InstitutionalReceiptFlow.test.tsx InvoiceHistoryView.test.tsx` | OK: 4 archivos, 38 tests pasan. |
| `vendor/bin/pint --test app/Actions/Receipts/GenerateReceiptDataAction.php tests/Feature/CashPaymentsReceiptTest.php` | OK. |
| `vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, calculos de dinero, auditoria, pagos, caja ni PDF institucional.
- Este corte reduce exposicion accidental de codigos internos en el recibo principal legacy y mantiene los identificadores internos solo para rutas/API operativas autenticadas.

## 85. Fase 13 - Restauracion no es permiso operativo

Cambio aplicado:

- `backups.restore` se retira de `RolesAndPermissionsSeeder` y del catalogo de permisos elevados.
- `VisiblePermissions` oculta `backups.restore` si existe como permiso legado en una instalacion previa.
- `BackupLogPolicy::restore` devuelve `false`, de modo que ninguna asignacion heredada pueda autorizar restauracion desde la app.
- El marcador frontend de permisos criticos deja de listar una accion inexistente; `backups.download` sigue siendo critico.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `php artisan test --filter="session_payload_does_not_expose_internal_or_inoperable_permissions|user_editor_rejects_inoperable_permissions_hidden_from_catalog|backup_restore_is_not_seeded_or_authorizable_from_the_app"` | RED inicial por permiso visible/sembrado/autorizable; luego OK. |
| `php artisan test --filter="AuthTest|UserManagementTest|PermissionAuditTest|BackupWorkflowTest"` | OK: 84 tests pasan, 385 assertions. |
| `npm run test -- RoleFormDialog.test.tsx UserFormDialog.test.tsx` | OK: 15 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron rutas, migraciones, jobs de respaldo, descarga ni creacion de backups.
- Este corte elimina la ambiguedad operacional: restaurar backups queda fuera de la app hasta que exista un flujo seguro completo, mientras los permisos legados quedan ocultos y no autorizan acciones.

## 86. Fase 10 - Reportes normaliza subrutas desconocidas

Cambio aplicado:

- `ReportsView` valida la subruta solicitada contra las tres secciones operativas (`executive`, `cash`, `audit`).
- Una URL desconocida bajo `/reports/*` cae en Ejecutivo y mantiene la navegacion con `aria-current="page"` en la seccion activa.
- Se agrego cobertura para evitar que una ruta invalida deje al operador con contenido visible pero sin ubicacion activa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsView.subroutes.test.tsx -t "unknown"` | RED inicial porque `/reports/desconocido` no marcaba ninguna seccion activa; luego OK. |
| `npm run test -- ReportsView.subroutes.test.tsx` | OK: 6 tests pasan. |
| `npm run test -- ReportsView.subroutes.test.tsx ReportsExecutive.test.tsx ReportsCash.test.tsx ReportsAudit.test.tsx` | OK: 4 archivos, 14 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron endpoints, permisos, exportaciones ni calculos de reportes.
- Este corte reduce ambiguedad en reportes consolidados y mantiene la navegacion limitada a Ejecutivo, Caja y Auditoria.

## 87. Fase 4/7 - Cobro refresca estado de caja

Cambio aplicado:

- `NewInvoiceView` invalida `cashSessions.current()` y `cashSessions.movements(sessionId)` despues de registrar un pago.
- El flujo mantiene las invalidaciones existentes de facturas y dashboard.
- Se reforzo el test del cobro con recibo legacy fallido para asegurar que el pago queda registrado y que caja se refresca igualmente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView.test.tsx -t "legacy receipt loading fails"` | RED inicial porque el cobro no invalidaba queries de caja; luego OK. |
| `npm run test -- NewInvoiceView.test.tsx CashBoxView.test.tsx CloseSessionDialog.test.tsx` | OK: 3 archivos, 28 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, schema, migraciones, pagos reales, recibos, caja historica ni correlativos.
- Este corte evita que la caja quede con totales/movimientos obsoletos despues de cobrar desde Nueva factura en la operacion monocomputadora.

## 88. Fase 3/8 - Eritropoyetina mantiene tarifa fija

Cambio aplicado:

- `StoreServiceRequest` y `UpdateServiceRequest` rechazan servicios con regla especial de eritropoyetina si el precio final no equivale a L.25.00.
- La validacion usa centavos con `Money::parseCents`, aceptando formatos equivalentes como `25`, `25.0` o `25.00`.
- Las pruebas de auditoria de cambio de precio dejan de usar Eritropoyetina como servicio generico y usan `Glucosa`, para no contradecir la regla de negocio fija.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `php artisan test --filter=test_erythropoietin_rule_requires_the_fixed_twenty_five_lempira_price` | RED inicial porque el API aceptaba cambiar Eritropoyetina a L.30.00; luego OK. |
| `php artisan test tests/Feature/ServiceCatalogTest.php` | OK: 35 tests pasan, 213 assertions. |
| `php artisan test tests/Unit/Actions/EritropoyetinaRuleTest.php tests/Unit/Actions/CalculateInvoiceTotalsTest.php tests/Feature/InvoiceCreationTest.php --filter=erythropoietin` | OK: 5 tests pasan, 24 assertions. |
| `vendor/bin/pint --test` | OK: 425 files. |
| `vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `php artisan test` | Timeout local a los 5 minutos sin salida util; se sustituyo por suites enfocadas de catalogo y eritropoyetina. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, calculo de totales, snapshots de facturas, pagos, caja ni recibos PDF.
- Este corte alinea catalogo con la regla no negociable: Eritropoyetina cuesta L.25.00 y solo se vuelve gratis por receta de dialisis durante la facturacion autorizada.

## 89. Fase 9 - Historial no ofrece reimpresion sin recibo

Cambio aplicado:

- `InvoiceHistoryTable` deja de ofrecer `Reimprimir` para facturas emitidas (`issued`) que aun no tienen pago ni recibo institucional.
- La reimpresion se mantiene disponible para facturas con recibo institucional o estado de cobro (`paid`/`partial`) segun permisos y alcance operativo.
- Se agrego cobertura para evitar que caja intente reimprimir un comprobante inexistente desde historial.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "does not offer reprint for an issued invoice that has no receipt yet"` | RED inicial porque `Reimprimir` aparecia para una factura emitida sin recibo; luego OK. |
| `npm run test -- InvoiceHistoryView.test.tsx` | OK: 26 tests pasan. |
| `npm run test -- InvoiceHistoryView.test.tsx ReceiptPreview.test.tsx InstitutionalReceiptFlow.test.tsx` | OK: 3 archivos, 37 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, pagos, recibos PDF, anulaciones ni permisos.
- Este corte reduce acciones confusas en historial: una factura sin recibo se puede anular/cobrar desde el flujo correspondiente, pero no se presenta como reimprimible.

## 90. Fase 13 - Roles elevados ocultos sin autorizacion

Cambio aplicado:

- `UserFormDialog` filtra roles elevados (`admin`, `root`, `supervisor`, `auditor` o roles protegidos) cuando el operador no tiene permiso para asignar roles administrativos.
- `UsersView` pasa la autorizacion `canAssignAdminRole` al formulario de creacion/edicion de usuarios.
- La edicion conserva visible el rol elevado actual del usuario para evitar que el formulario pierda su valor al abrir una cuenta ya existente.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "hides elevated roles from user creators without admin assignment permission"` | RED inicial porque el selector ofrecia `Admin`, `Supervisor` y `Auditor`; luego OK. |
| `npm run test -- UsersView.test.tsx UserFormDialog.test.tsx UsersTable.test.tsx RoleFormDialog.test.tsx PermissionMatrix.test.tsx` | OK: 5 archivos, 46 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, policies, permisos ni seeders.
- Este corte alinea la interfaz con la proteccion existente del servidor: un creador basico puede usar roles operativos no elevados, pero no ve opciones que el API rechazaria.

## 91. Fase 11 - Reglas operativas separadas del payload fiscal

Cambio aplicado:

- Se agrego `PUT /api/settings/operational` para guardar solo `scanner_enabled` y `partial_payments_enabled`.
- `OperationalRulesView` ahora lee y guarda reglas operativas con el endpoint operativo, sin enviar nombre del hospital, RTN, marca ni papel de recibo.
- El backend audita el cambio como `operational_settings.updated` con valores anteriores/nuevos limitados a reglas operativas.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_admin_can_update_operational_settings_without_full_fiscal_payload` | RED inicial: 405 porque no existia `PUT /api/settings/operational`; luego OK. |
| `npm run test -- OperationalRulesView.test.tsx -t "loads operational rules"` | RED inicial: la pantalla seguia llamando `getFiscalSettings`; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 15 tests, 100 assertions. |
| `npm run test -- OperationalRulesView.test.tsx` | OK: 4 tests pasan. |
| `npm run test -- OperationalRulesView.test.tsx FiscalSettingsView.test.tsx HospitalSettingsView.test.tsx FiscalNumerationView.test.tsx` | OK: 4 archivos, 13 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files tras normalizar formato con Pint. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, CAI, secuencias fiscales, recibos ni caja.
- Este corte reduce mezcla entre fiscal e instrucciones operativas del POS: guardar scanner/abonos ya no arrastra campos institucionales ni de impresion.

## 92. Fase 11 - Papel de recibo fuera de reglas operativas

Cambio aplicado:

- `GET /api/settings/operational` deja de exponer `receipt_paper_size`; conserva solo tasa por defecto, scanner y abonos parciales.
- `OperationalSettings` ya no incluye el perfil de papel, por lo que el POS deja de derivar ancho de recibo desde reglas operativas.
- Los mocks criticos de POS y reglas operativas ahora reflejan el contrato minimo del endpoint operativo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_cashier_can_view_minimal_operational_settings_without_full_fiscal_or_receipt_profile_data` | RED inicial: el endpoint operativo aun devolvia `receipt_paper_size`; luego OK. |
| `npm run test -- OperationalRulesView.test.tsx NewInvoiceView.test.tsx App.test.tsx` | OK: 3 archivos, 35 tests pasan. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 15 tests, 100 assertions. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, perfiles de recibo institucional, generacion PDF, caja ni pagos.
- El campo legado `receipt_paper_size` sigue cubierto en `/api/settings/fiscal` por compatibilidad/deprecacion, pero ya no se filtra a reglas operativas ni al arranque del POS.

## 93. Fase 11/14 - Cambio de ISV exige motivo fiscal

Cambio aplicado:

- `UpdateFiscalSettingsRequest` ahora detecta cambios de `default_tax_rate` en una configuracion existente y exige `reason` de al menos 5 caracteres.
- `FiscalSettingsController` excluye `reason` del `fill()` de `FiscalSetting` y lo conserva en `audit_logs.reason` para `fiscal_settings.updated`.
- La validacion evita mutar la tasa ISV y evita auditar cambios incompletos cuando falta el motivo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=default_tax_rate_change` | RED inicial: el backend aceptaba el cambio sin motivo y auditaba `reason=null`; luego OK: 2 tests, 8 assertions. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 17 tests, 108 assertions. |
| `docker compose exec backend php artisan test` | OK: 767 tests pasan, 13 skipped, 4945 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, secuencias fiscales, caja, recibos, frontend ni permisos.
- Este corte avanza la regla de seguridad: los cambios fiscales sensibles empiezan a requerir motivo auditado sin bloquear creacion inicial ni cambios institucionales no tributarios.

## 94. Fase 11/14 - Cambio de RTN exige motivo fiscal

Cambio aplicado:

- `UpdateFiscalSettingsRequest` ahora trata cambios de `rtn` como dato fiscal sensible y exige `reason` de al menos 5 caracteres en configuraciones existentes.
- `HospitalSettingsView` muestra `Motivo del cambio fiscal` solo cuando el RTN difiere del valor cargado y envia el motivo al backend.
- El motivo queda auditado en `fiscal_settings.updated` sin persistirse como atributo de `FiscalSetting`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=rtn_change` | RED inicial: el backend aceptaba RTN nuevo sin motivo; luego OK: 2 tests, 7 assertions. |
| `npm run test -- HospitalSettingsView.test.tsx -t "RTN changes"` | RED inicial: la UI no mostraba campo de motivo; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 19 tests, 115 assertions. |
| `npm run test -- HospitalSettingsView.test.tsx FiscalSettingsView.test.tsx BrandingView.test.tsx OperationalRulesView.test.tsx` | OK: 3 archivos, 11 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files tras formatear `FiscalSettingsTest.php`. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, secuencias fiscales, caja, recibos ni permisos.
- Este corte completa otro tramo de cambios fiscales con motivo auditado sin pedir motivo para ediciones institucionales no fiscales.

## 95. Fase 11 - Marca no arrastra reglas operativas

Cambio aplicado:

- `BrandingView` deja de enviar `scanner_enabled` y `partial_payments_enabled` cuando guarda el color institucional.
- La actualizacion de marca queda limitada a datos fiscales/institucionales (`hospital_name`, `rtn`, `primary_color`, direccion, lema y modo institucional de recibo).
- Se agrega cobertura especifica para evitar que una edicion visual sobrescriba reglas operativas del POS.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BrandingView.test.tsx` | RED inicial: el payload de marca aun incluia `scanner_enabled=true`; luego OK: 1 test pasa. |
| `npm run test -- FiscalSettingsView.test.tsx BrandingView.test.tsx OperationalRulesView.test.tsx HospitalSettingsView.test.tsx` | OK: 4 archivos, 12 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, backend, caja, pagos, recibos ni permisos.
- Este corte reduce otra fuga entre configuracion visual/fiscal y reglas operativas, manteniendo scanner y abonos parciales como responsabilidad del endpoint operativo.

## 96. Fase 11 - Marca usa payload parcial sin RTN/ISV

Cambio aplicado:

- `PUT /api/settings/fiscal` acepta actualizaciones parciales cuando ya existe configuracion fiscal, manteniendo payload completo obligatorio para la creacion inicial.
- `BrandingView` guarda el color institucional enviando solo `primary_color`, sin reenviar RTN, tasa ISV, datos hospitalarios ni reglas operativas.
- Los tipos frontend de `updateFiscalSettings` aceptan `Partial<FiscalSettings>` para reflejar el contrato real de actualizacion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_admin_can_update_brand_color_without_full_fiscal_payload` | RED inicial: 422 por `hospital_name`, `rtn` y `default_tax_rate` requeridos; luego OK: 1 test, 9 assertions. |
| `npm run test -- BrandingView.test.tsx` | RED inicial: el payload aun enviaba `rtn`; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 20 tests, 124 assertions. |
| `npm run test -- FiscalSettingsView.test.tsx BrandingView.test.tsx OperationalRulesView.test.tsx HospitalSettingsView.test.tsx` | OK: 4 archivos, 12 tests pasan. |
| `docker compose exec backend php artisan test` | OK: 770 tests pasan, 13 skipped, 4961 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files tras formatear los 2 archivos PHP tocados. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, secuencias fiscales, caja, pagos, recibos ni permisos.
- Este corte evita que una edicion visual dependa de datos fiscales sensibles y conserva la proteccion de creacion inicial completa.

## 97. Fase 11 - Datos del hospital no arrastran marca ni reglas de recibo

Cambio aplicado:

- `HospitalSettingsView` deja de enviar `default_tax_rate`, `primary_color` y `receipt_template_mode` al guardar datos institucionales.
- El payload de hospital queda limitado a nombre, RTN, direccion, lema, lineas institucionales, lugar/pie de recibo y motivo cuando cambia el RTN.
- La prueba de hospital ahora cubre que el formulario no sobrescribe ISV, marca, recibos ni reglas operativas al guardar campos institucionales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- HospitalSettingsView.test.tsx` | RED inicial: el payload aun enviaba `default_tax_rate=15.00`; luego OK: 4 tests pasan. |
| `npm run test -- FiscalSettingsView.test.tsx BrandingView.test.tsx OperationalRulesView.test.tsx HospitalSettingsView.test.tsx` | OK: 4 archivos, 12 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, backend, caja, pagos, recibos ni permisos.
- Este corte aprovecha el contrato parcial ya probado del endpoint fiscal para reducir mezcla entre datos hospitalarios, marca, reglas fiscales y recibos.

## 98. Fase 11/14 - Auditoria fiscal respeta payload parcial

Cambio aplicado:

- `FiscalSettingsController` ahora audita solo los campos enviados en actualizaciones existentes de configuracion fiscal.
- La creacion inicial conserva auditoria completa de los campos fiscales/institucionales configurados.
- El warning auditado de cambio de papel a mitad de turno sigue usando la comparacion real de `receipt_paper_size`, pero ya no depende de que `old_values` incluya todos los campos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_admin_can_update_brand_color_without_full_fiscal_payload` | RED inicial: la auditoria de marca aun incluia `rtn`; luego OK: 1 test, 17 assertions. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 20 tests, 132 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files tras formatear los 2 archivos PHP tocados. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK sin errores. |
| `docker compose exec backend php artisan test` | OK: 770 tests pasan, 13 skipped, 4969 assertions. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, frontend, caja, pagos, recibos ni permisos.
- Este corte refuerza auditoria y separacion de dominios: una edicion parcial no deja trazas auditadas como si hubiera reenviado RTN, ISV, reglas operativas o papel.

## 99. Fase 6 - Vista previa de recibo usa fecha operativa actual

Cambio aplicado:

- La vista previa del recibo institucional deja de mostrar una fecha fija de ejemplo.
- `ReceiptSettingsPreview` usa el helper local `formatDate` para renderizar la fecha actual en formato `dd/mm/yyyy`.
- La prueba congela el reloj y cubre que la vista previa muestre la fecha operativa esperada sin introducir campos tecnicos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReceiptSettingsPreview.test.tsx` | RED inicial: la vista previa mostraba `Fecha: 15/06/2026`; luego OK: 3 tests pasan. |
| `npm run test -- ReceiptSettingsPreview.test.tsx InstitutionalReceiptSettingsView.test.tsx` | OK: 2 archivos, 13 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, permisos, perfiles de impresion ni contratos API.
- Este corte mantiene el flujo normal de recibo institucional sin opciones tecnicas y evita que la vista previa induzca a imprimir con una fecha de ejemplo obsoleta.

## 100. Fase 6 - Papel normal limita tickets termicos a compatibilidad

Cambio aplicado:

- El selector normal de papel del recibo institucional muestra solo Carta, Media carta y A5.
- Los perfiles `thermal_80mm` y `thermal_58mm` quedan fuera del flujo normal junto con el perfil pequeno personalizado.
- El modo con permiso avanzado conserva la lista completa de perfiles de papel para soporte o compatibilidad.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx` | RED inicial: `Ticket 80 mm` aparecia como radio normal; luego OK: 11 tests pasan. |
| `npm run test -- ReceiptSettingsPreview.test.tsx InstitutionalReceiptSettingsView.test.tsx` | OK: 2 archivos, 14 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, CSS de impresion ni contratos API.
- Este corte mantiene el recibo institucional diario enfocado en papel carta/media carta/A5, dejando tickets termicos como compatibilidad secundaria fuera del flujo normal.

## 101. Fase 3 - Dashboard no anuncia accion inexistente

Cambio aplicado:

- El encabezado del dashboard solo menciona la accion primaria cuando existe una accion disponible.
- Si el usuario no puede abrir caja ni crear factura, el centro de mando ya no muestra `Una accion clara: Espere`.
- La prueba cubre el caso sin permisos de caja/facturacion para evitar una orientacion falsa en pantalla.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- DashboardView.test.tsx` | RED inicial: el encabezado anunciaba `Una accion clara: Espere`; luego OK: 13 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, permisos ni contratos API.
- Este corte reduce ruido cognitivo del inicio operativo: el dashboard no inventa una accion primaria cuando el usuario no tiene ninguna disponible.
## 102. Fase 4/5 - Reimpresion institucional idempotente desde venta

Cambio aplicado:

- La reimpresion del recibo institucional desde el exito de venta/cobro envia una llave idempotente generada por el cliente.
- La apertura inicial del PDF institucional tras registrar el pago se mantiene sin motivo de reimpresion.
- La prueba cubre el flujo completo de emitir, cobrar, abrir el PDF inicial y luego reimprimir desde el dialogo de factura emitida.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView.test.tsx` | RED inicial: la reimpresion llamaba el PDF solo con `id` y motivo, sin `idempotencyKey`; luego OK: 14 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, permisos ni contratos de recibos.
- Este corte alinea el flujo de venta/cobro con la proteccion idempotente ya usada para reimpresiones institucionales desde historial.

## 103. Fase 10 - Reportes caen a seccion permitida

Cambio aplicado:

- Si un usuario con solo permiso de reporte de caja entra directo a una subruta restringida de reportes, la pantalla abre Caja como seccion activa.
- Las rutas sin ningun permiso conservan su estado de no disponible, sin exponer controles de caja ni reporte ejecutivo.
- La navegacion de reportes sigue limitada a Ejecutivo, Caja y Auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsView.subroutes.test.tsx` | RED inicial: Caja estaba visible pero no activa al entrar por `/reports/audit`; luego OK: 7 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos, endpoints ni exportaciones.
- Este corte reduce callejones sin salida en reportes para una instalacion monocomputadora: el usuario cae en el reporte que realmente puede operar.

## 104. Fase 5 - API de respaldos oculta huella interna

Cambio aplicado:

- El payload publico de listado y creacion manual de respaldos ya no expone `checksum_sha256`.
- La huella se conserva en base de datos, auditoria de descarga y validacion de integridad del archivo.
- El tipo frontend marca `checksum_sha256` como opcional para que la UI no dependa de un dato tecnico interno.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=BackupWorkflowTest` | RED inicial: listado y creacion exponian `checksum_sha256`; luego OK: 26 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, generacion de backups, descarga, permisos ni restauracion.
- Este corte reduce metadatos tecnicos en la API operativa sin debilitar la verificacion local de integridad.

## 105. Fase 13/14 - Usuarios no pueden dejar cero admins activos

Cambio aplicado:

- El backend rechaza degradar el unico administrador activo a un rol no protegido.
- El backend rechaza desactivar el unico administrador activo, incluso si el actor tiene permisos administrativos delegados.
- `RoleCatalog` expone los nombres de roles protegidos para que la consulta use la misma fuente que la validacion de roles.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter="only_active_admin"` | RED inicial: degradar/desactivar el unico admin devolvia 200; luego OK: 2 tests pasan. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 33 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, seeders, permisos nuevos, frontend ni rutas.
- Este corte evita que una instalacion monocomputadora quede sin administrador operativo por error o mala asignacion de permisos.

## 106. Fase 14 - Rutas dinamicas no indexables por cabecera

Cambio aplicado:

- El middleware global de seguridad agrega `X-Robots-Tag: noindex, nofollow, noarchive` a respuestas API y HTML dinamico.
- La proteccion cubre rutas autenticadas aunque el navegador, proxy o crawler no procese la metadata del `index.html`.
- La prueba nueva valida `/api/auth/me` como ruta autenticada con datos de usuario.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=authenticated_api_responses_are_not_indexable` | RED inicial: la cabecera era `null`; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=SecurityHeadersTest` | OK: 8 tests pasan. |
| `docker compose exec backend php artisan test --filter=CspReportControllerTest` | OK: 12 tests pasan. |
| `docker compose exec backend php artisan test --filter=ProductionSpaRouteTest` | OK: 5 tests pasan, 1 skip esperado por metadata fuente no montada. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron rutas, permisos, migraciones ni contratos de negocio.
- Este corte refuerza la instalacion LAN/offline para que endpoints y pantallas internas no sean indexables por cabecera HTTP, ademas de la metadata del frontend.
## 107. Fase 13/14 - Usuarios reflejan ultimo admin activo

Cambio aplicado:

- La pantalla de usuarios oculta la accion `Desactivar` cuando el objetivo es el unico administrador/root activo.
- El formulario de edicion bloquea la degradacion de rol del unico administrador/root activo y muestra una advertencia operativa clara.
- Las pruebas existentes que validan desactivacion normal ahora usan dos administradores activos para no contradecir la regla critica.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "only active administrator"` | RED inicial: `Desactivar` seguia visible; luego OK: caso puntual pasa. |
| `npm run test -- UsersView.test.tsx -t "demoting the only active administrator"` | RED inicial: no habia advertencia ni bloqueo de rol; luego OK: caso puntual pasa. |
| `npm run test -- UsersView.test.tsx` | OK: 26 tests pasan. |
| `npm run test -- UsersView.test.tsx UserFormDialog.test.tsx UsersTable.test.tsx` | OK: 37 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, permisos, rutas ni migraciones; la proteccion autoritativa sigue en Laravel.
- Este corte reduce errores operativos en instalaciones monocomputadora: el frontend ya guia al usuario antes de intentar una accion que dejaria al sistema sin administrador activo.

## 108. Fase 8 - Cierre de caja envia nota auditada limpia

Cambio aplicado:

- El cierre de caja recorta la nota antes de enviarla a la API cuando existe diferencia de efectivo.
- El frontend sigue enviando `null` cuando la nota queda vacia, manteniendo el contrato actual del backend.
- Se agrego cobertura para evitar que espacios accidentales queden en el payload auditado de caja.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView.test.tsx -t "trims close difference notes"` | RED inicial: la API recibia `"  Faltante validado  "`; luego OK: recibe `"Faltante validado"`. |
| `npm run test -- CashBoxView.test.tsx CloseSessionDialog.test.tsx` | OK: 16 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, permisos ni reportes.
- Este corte mantiene alineado el payload frontend con la auditoria autoritativa del backend para diferencias de caja.

## 109. Fase 12 - Descarga de respaldo confirma contexto humano

Cambio aplicado:

- El dialogo de descarga de respaldos ahora muestra fecha, tamano y usuario del respaldo seleccionado antes de confirmar.
- El dialogo mantiene oculto el nombre tecnico del archivo, rutas locales, checksum y metadatos internos.
- La accion de descarga sigue pasando por confirmacion y auditoria backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "confirms and reports backup downloads"` | RED inicial: el dialogo solo mostraba texto generico; luego OK: muestra tamano y usuario sin filename tecnico. |
| `npm run test -- BackupsView.test.tsx` | OK: 20 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, permisos ni contratos API.
- Este corte reduce riesgo operativo en una accion sensible de respaldos sin exponer datos tecnicos al usuario normal.

## 110. Fase 6/14 - Motivo obligatorio en ajustes avanzados de recibo

Cambio aplicado:

- Los campos manuales avanzados de perfiles de impresion ahora requieren un motivo de soporte cuando el usuario tiene permiso tecnico.
- El backend recorta el motivo, lo valida y lo guarda en la auditoria de `receipt_print_profile.updated` sin persistirlo como atributo del perfil.
- La pantalla de recibos muestra el campo solo dentro del modo soporte tecnico para el recibo pequeno personalizado y envia el motivo recortado.
- El flujo normal de papel/copia/impresion no cambia y sigue ocultando medidas tecnicas a usuarios sin permiso avanzado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=advanced_manual_fields_require_support_reason` | RED inicial: la API aceptaba el cambio avanzado sin motivo con 200; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "documented support reason"` | RED inicial: no existia el campo `Motivo de soporte`; luego OK: envia `support_reason` recortado. |
| `docker compose exec backend php artisan test --filter=ReceiptPrintProfileAdvancedFieldsTest` | OK: 4 tests, 22 assertions. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx` | OK: 12 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse` | Primer intento incompleto por limite PHP de 128M. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, permisos, seeders ni contratos de impresion normal.
- Este corte refuerza auditoria y trazabilidad para ajustes fisicos de impresion que solo debe realizar soporte tecnico.

## 111. Fase 11 - Resumen fiscal usa secuencia activa real

Cambio aplicado:

- La pantalla de configuracion carga la secuencia fiscal junto con los datos del hospital.
- El resumen fiscal y el estado de configuracion usan la secuencia activa para mostrar CAI, rango autorizado y siguiente correlativo.
- Se evita que el resumen indique `CAI y prefijo fiscal` como pendiente cuando ya existe una secuencia fiscal activa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- FiscalSettingsView.test.tsx -t "active fiscal sequence"` | RED inicial: el resumen no mostraba `CAI-TEST`; luego OK. |
| `npm run test -- FiscalSettingsView.test.tsx` | OK: 4 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |
| `git diff --check` | OK: sin errores; solo advertencias de normalizacion CRLF/LF en archivos tocados. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, permisos, correlativos ni datos fiscales.
- Este corte mejora la claridad de configuracion sin mezclar nuevamente recibos, reglas operativas o branding con numeracion fiscal.

## 112. Fase 14 - Policy fiscal exige permiso de mutacion

Cambio aplicado:

- `FiscalSequencePolicy::update` ahora exige `settings.fiscal.update`, no solo permiso de lectura fiscal.
- `FiscalSequencePolicy::view` conserva `settings.fiscal.view`, manteniendo el resumen fiscal disponible para usuarios autorizados a consultar.
- Se agrego cobertura directa de policy para evitar que futuras rutas con `Gate::authorize('update', $sequence)` hereden una autorizacion demasiado amplia.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=fiscal_sequence_policy_requires_update_permission` | RED inicial: `viewer->can('update', $sequence)` devolvia `true`; luego OK. |
| `docker compose exec backend php artisan test --filter=FiscalSequenceTest` | OK: 13 tests, 41 assertions. |
| `docker compose exec backend php artisan test --filter=UpdateFiscalSequenceReasonTest` | OK: 2 tests, 8 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron frontend, migraciones, rutas, requests ni correlativos fiscales.
- Este corte refuerza RBAC backend como defensa autoritativa para numeracion fiscal aunque el controlador actual ya use Form Requests.

## 113. Fase 14 - Reportes sensibles exigen confirmacion critica en UI

Cambio aplicado:

- `reports.export` y `reports.managerial.view` ahora forman parte de la lista centralizada de permisos criticos del frontend.
- Los formularios de usuarios y roles muestran `Permiso critico` y bloquean guardar hasta confirmar explicitamente cuando se asignan permisos gerenciales de reportes.
- La medida alinea la advertencia visual del administrador con el tratamiento elevado que ya existe para reportes sensibles en backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog RoleFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia `Permiso critico` para `reports.managerial.view`/`reports.export`; luego OK: 17 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, seeders, policies ni contratos API.
- Este corte reduce asignaciones accidentales de acceso gerencial/exportacion sin cambiar la autorizacion autoritativa del servidor.
## 114. Fase 14 - Reinicio fiscal tratado como permiso elevado

Cambio aplicado:

- `fiscal.sequences.reset` ahora se considera permiso elevado en `RoleCatalog`.
- Un gestor de usuarios sin `users.assign_admin_role` ya no puede asignar un rol custom que contenga reinicio de correlativo fiscal.
- La UI de usuarios y roles marca `fiscal.sequences.reset` como `Permiso critico` y exige confirmacion explicita antes de guardar.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=custom_role_with_fiscal_sequence_reset_permission` | RED inicial: la API respondia 201; luego OK: 1 test, 4 assertions. |
| `npm run test -- UserFormDialog RoleFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia `Permiso critico` para `fiscal.sequences.reset`; luego OK: 19 tests pasan. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 34 tests, 145 assertions. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |
| `docker compose exec backend vendor/bin/pint --test` | Primer intento marco formato en la prueba nueva; luego OK: 426 files. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, rutas, requests ni la logica de numeracion fiscal.
- Este corte reduce riesgo de escalacion operativa sobre correlativos fiscales sin cambiar el flujo autorizado para administradores.

## 115. Fase 14 - Edicion de usuarios tratada como permiso elevado

Cambio aplicado:

- `users.update` ahora se considera permiso elevado en `RoleCatalog`.
- Un gestor con `users.create`/`users.view`, pero sin `users.assign_admin_role`, ya no puede asignar un rol custom que incluya edicion de usuarios.
- La proteccion backend queda alineada con la UI, donde `users.update` ya estaba marcado como permiso critico por su capacidad de editar cuentas y resetear contrasenas.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=custom_role_with_user_update_permission` | RED inicial: la API respondia 201; luego OK: 1 test, 4 assertions. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 35 tests, 149 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron frontend, migraciones, seeders, policies ni endpoints.
- Este corte cierra una ruta de escalacion donde un gestor operativo podia asignar capacidades de edicion/reset de usuarios mediante un rol custom aparentemente operativo.

## 116. Fase 14 - Desactivacion de usuarios tratada como permiso elevado

Cambio aplicado:

- `users.disable` ahora se considera permiso elevado en `RoleCatalog`.
- Un gestor con `users.create`/`users.view`, pero sin `users.assign_admin_role`, ya no puede asignar un rol custom que permita desactivar cuentas.
- La UI de usuarios y roles marca `users.disable` como `Permiso critico` y exige confirmacion explicita antes de guardar.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=custom_role_with_user_disable_permission` | RED inicial: la API respondia 201; luego OK: 1 test, 4 assertions. |
| `npm run test -- UserFormDialog RoleFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia `Permiso critico` para `users.disable`; luego OK: 21 tests pasan. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 36 tests, 153 assertions. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, rutas, seeders, policies ni endpoints.
- Este corte cierra una ruta de escalacion donde un gestor operativo podia asignar capacidad de desactivar usuarios mediante un rol custom.

## 117. Fase 14 - Creacion de respaldos tratada como permiso elevado

Cambio aplicado:

- `backups.create` ahora se considera permiso elevado en `RoleCatalog`.
- Un gestor con `users.create`/`users.view`, pero sin `users.assign_admin_role`, ya no puede asignar un rol custom que permita crear respaldos locales.
- La UI ya trataba `backups.create` como permiso critico; este corte alinea la defensa autoritativa del backend con esa advertencia visual.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=custom_role_with_backup_create_permission` | RED inicial: la API respondia 201; luego OK: 1 test, 4 assertions. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 37 tests, 157 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron frontend, migraciones, rutas, seeders, policies ni endpoints.
- Este corte cierra una ruta de escalacion donde un gestor operativo podia asignar capacidad de crear respaldos mediante un rol custom.

## 118. Fase 10/15 - Navegacion de reportes con descripcion accesible

Cambio aplicado:

- Los enlaces de reportes `Ejecutivo`, `Caja` y `Auditoria` exponen una descripcion accesible con el contenido esperado de cada seccion.
- La descripcion queda disponible para tecnologias asistivas mediante `aria-describedby` y texto `sr-only`, sin agregar ruido visual ni nuevas cards.
- El cambio refuerza la consolidacion de reportes en tres secciones claras y mejora la comprension por teclado/lector de pantalla.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsView.subroutes --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: los links no tenian descripcion accesible; luego OK: 8 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, permisos, endpoints ni modelos de reportes.
- Este corte mejora accesibilidad transversal sin cambiar la superficie visual ni la logica de reportes.

## 119. Fase 13/14 - Auditoria marcada como permiso critico en UI

Cambio aplicado:

- `audit.view` ahora forma parte de la lista centralizada de permisos criticos del frontend.
- Los formularios de usuarios y roles muestran `Permiso critico` y bloquean guardar hasta confirmar explicitamente cuando se asigna acceso de auditoria.
- La UI queda alineada con `RoleCatalog`, donde `audit.view` ya se considera permiso elevado por exponer trazabilidad administrativa sensible.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog RoleFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia `Permiso critico` para `audit.view`; luego OK: 23 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce asignaciones accidentales de acceso a auditoria sin cambiar la autorizacion autoritativa del servidor.

## 120. Fase 13/14 - Operacion global de facturas marcada como permiso critico en UI

Cambio aplicado:

- `invoices.operate_any` ahora forma parte de la lista centralizada de permisos criticos del frontend.
- Los formularios de usuarios y roles muestran `Permiso critico` y bloquean guardar hasta confirmar explicitamente cuando se asigna capacidad de operar cualquier factura.
- La UI queda alineada con `RoleCatalog`, donde `invoices.operate_any` ya se considera permiso elevado por permitir operar facturas fuera del alcance normal de caja.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog RoleFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia `Permiso critico` para `invoices.operate_any`; luego OK: 25 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce asignaciones accidentales de alcance global sobre facturas sin cambiar la autorizacion autoritativa del servidor.

## 121. Fase 13/15 - Matriz de permisos senala permisos criticos

Cambio aplicado:

- La matriz de permisos reutiliza la lista centralizada de permisos criticos del frontend.
- Cada fila critica muestra una etiqueta visible `Permiso critico` junto al nombre tecnico del permiso.
- La revision comparativa de roles ahora expone riesgo operativo sin depender solo de los formularios de edicion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PermissionMatrix --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: `audit.view` no mostraba etiqueta critica en la matriz; luego OK: 5 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora claridad administrativa y accesibilidad visual de riesgos sin cambiar permisos ni autorizacion.

## 122. Fase 13/15 - Matriz de permisos colapsada por defecto

Cambio aplicado:

- La matriz comparativa de permisos queda colapsada por defecto en la pantalla de usuarios.
- El resumen de cantidad de permisos y roles permanece visible, con un boton accesible para mostrar u ocultar la matriz cuando se necesite revisar roles.
- La tabla conserva sus grupos colapsables internos y las etiquetas de permisos criticos al abrirse.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PermissionMatrix --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no existia boton `Mostrar matriz de permisos` y la tabla se renderizaba abierta; luego OK: 6 tests pasan. |
| `npm run test -- UsersView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 26 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce la carga visual del modulo de usuarios sin eliminar la revision administrativa de roles.

## 123. Fase 4/8 - Historial muestra trazabilidad de recibo

Cambio aplicado:

- La tabla de historial de facturas incluye una columna compacta `Recibo`.
- Cuando la factura tiene recibo institucional emitido, se muestra el numero completo del PDF sin abrir el menu de acciones.
- Cuando falta el PDF, la columna muestra un estado operativo humano como `PDF pendiente`, `Pendiente de pago` o `Anulada`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no existia columna `Recibo`; luego OK: 27 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora busqueda y reimpresion operativa al hacer visible la trazabilidad del recibo institucional en la lista principal.

## 124. Fase 10 - Resumen ejecutivo con lectura rapida de cobro

Cambio aplicado:

- El resumen ejecutivo muestra una lectura operativa de porcentaje cobrado sobre lo facturado.
- El pendiente y la cantidad de facturas con saldo abierto quedan visibles antes del grid de KPIs.
- La pantalla ayuda a distinguir facturado, cobrado y pendiente sin interpretar varias tarjetas por separado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ExecutiveSummary --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: faltaba lectura `Cobrado 60.0% de lo facturado`; luego OK: 1 test pasa. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora lectura diaria de reportes sin cambiar calculos ni contratos API.

## 125. Fase 10 - Alertas operativas en reporte ejecutivo

Cambio aplicado:

- El reporte ejecutivo muestra alertas compactas para pendientes de 31 o mas dias, diferencias de caja y eventos criticos de auditoria.
- Las alertas usan lenguaje operativo y montos visibles para priorizar revision antes de navegar tablas o graficos.
- El bloque se oculta cuando no hay alertas, evitando ruido visual en periodos sin riesgo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ExecutiveAlerts --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: faltaba componente/comportamiento; luego OK: 1 test pasa. |
| `npm run test -- ReportsExecutive --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el reporte no montaba `ExecutiveAlerts`; luego OK: 2 tests pasan. |
| `npm run test -- ExecutiveAlerts ReportsExecutive --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora utilidad diaria de reportes con datos existentes, sin cambiar calculos ni contratos API.

## 126. Fase 8 - Regla de eritropoyetina visible en catalogo

Cambio aplicado:

- La tabla del catalogo muestra la regla `Receta dialisis` para servicios con `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`.
- El resumen bajo el nombre indica que eritropoyetina queda gratis con receta de dialisis y cobra L 25.00 sin receta.
- La senal queda visible sin abrir el formulario de edicion, reduciendo errores operativos en caja.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceCatalogTable --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la tabla no mostraba `gratis con receta de dialisis`; luego OK: 6 tests pasan. |
| `npm run test -- CatalogView ServiceCatalogTable ServiceSheet --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 37 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte expone una regla critica ya existente sin duplicar calculos fiscales ni cambiar el contrato API.

## 127. Fase 4 - Cobro con Ctrl+Enter en modal de pago

Cambio aplicado:

- El modal de pago permite confirmar el cobro con `Ctrl+Enter` desde el campo de monto recibido.
- Enter normal dentro del campo sigue sin ejecutar un envio manual; el submit queda limitado al formulario o al atajo explicito.
- El atajo respeta el estado `submitting`, por lo que no intenta cerrar ni reenviar mientras el cobro esta en progreso.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PaymentModal --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: `Ctrl+Enter` no confirmaba el cobro; luego OK: 20 tests pasan. |
| `npm run test -- NewInvoiceView PaymentModal --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 38 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora operacion por teclado en caja sin agregar texto instructivo ni cambiar el contrato de cobro.

## 128. Fase 7 - Cierre de caja con lectura balanceada

Cambio aplicado:

- El resumen de caja muestra `Sin diferencia` cuando el monto contado coincide con el efectivo esperado.
- Las diferencias con sobrante o faltante conservan su monto firmado, para que el cajero vea el riesgo antes del dialogo de cierre.
- No se cambiaron calculos de caja ni payloads; solo la lectura operativa del estado balanceado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- SessionSummary --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: faltaba `Sin diferencia`; luego OK: 4 tests pasan. |
| `npm run test -- CashBoxView CloseSessionDialog SessionSummary --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 20 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce ambiguedad en cierre de caja sin relajar la regla backend que exige motivo cuando existe diferencia.

## 129. Fase 14/7 - Cierre global de caja autorizado por RBAC

Cambio aplicado:

- El request backend de cierre de caja acepta `cash.close_any` ademas de `cash.close`.
- La Policy y la Action siguen validando alcance: un usuario sin `cash.close_any` no puede cerrar caja ajena.
- Se cubre el caso de un rol operativo personalizado con cierre global, sin requerirle tambien el permiso de cierre propio.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=CloseCashSessionTest` | RED inicial: usuario con solo `cash.close_any` recibia 403; luego OK: 4 tests pasan. |
| `docker exec s_hospital-backend-1 php artisan test --filter="CloseCashSessionTest\|CloseCashSessionDifferenceTest\|CashPaymentsReceiptTest"` | OK: 39 tests pasan, 378 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test app/Http/Requests/Cash/CloseCashSessionRequest.php tests/Feature/Cash/CloseCashSessionTest.php` | OK: 2 files pasan. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse` | Fallo por limite de memoria PHP 128M del worker, sin resultado completo. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: No errors. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron migraciones, seeders, rutas ni contratos de payload.
- Este corte fortalece RBAC backend para caja sin relajar auditoria, diferencia obligatoria ni bloqueo de caja ajena para cajeros.

## 130. Fase 9 - Busqueda de historial vuelve a primera pagina

Cambio aplicado:

- Los filtros del historial reinician la paginacion a `page: 1` cuando cambia paciente, numero de factura, fechas o estado.
- Esto evita falsos vacios cuando el usuario esta en una pagina posterior y busca una factura o paciente con pocos resultados.
- No se cambiaron endpoints, payloads ni calculos; se mantiene el contrato existente de `getInvoices`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: al cambiar paciente desde `page=3`, la consulta seguia en pagina 3; luego OK: 28 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte mejora busqueda operativa en historial sin relajar permisos, anulaciones ni auditoria de reimpresiones.

## 131. Fase 8 - Eritropoyetina fija precio de catalogo en formulario

Cambio aplicado:

- Al seleccionar la regla `Eritropoyetina con receta de dialisis` en el formulario de servicio, el precio se normaliza a `25.00`.
- El payload de creacion/edicion conserva `special_rule_code=ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` y envia el precio fijo esperado por backend.
- La validacion backend sigue siendo la fuente de verdad; este corte evita que el operador prepare una configuracion invalida antes de guardar.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: al elegir eritropoyetina el precio seguia en `125.00`; luego OK: 13 tests pasan. |
| `npm run test -- CatalogView ServiceCatalogTable ServiceSheet --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 38 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce errores de configuracion en catalogo sin duplicar calculos de facturacion ni relajar la regla server-side de L 25.00.

## 132. Fase 12 - Descarga de respaldo sin nombre tecnico

Cambio aplicado:

- La descarga desde la vista normal de respaldos ahora usa un nombre humano: `respaldo-local-YYYY-MM-DD-ID.sql.enc`.
- El dialogo, estados y atributo real de descarga del navegador evitan exponer `hospital-backup-*` o sufijos tecnicos del servidor.
- El backend conserva su nombre seguro de attachment y sus validaciones de integridad; no se relaja la proteccion de rutas ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView` | RED inicial: la descarga usaba `hospital-backup-20260618-120000-test.sql.enc`; luego OK: 20 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce exposicion tecnica en respaldos sin cambiar el archivo real, checksum, permisos ni auditoria de descarga.

## 133. Fase 10 - Ayuda accesible para reporte de caja

Cambio aplicado:

- El reporte de caja ahora explica junto al campo "Numero de Caja" que debe usarse el numero mostrado en Caja al abrir o cerrar turno.
- La ayuda queda asociada al input con `aria-describedby`, para que tambien sea util con lector de pantalla.
- Se mantiene el formulario simple de consulta por caja, sin ejemplos numericos crudos ni campos tecnicos adicionales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashSessionReportTab` | RED inicial: faltaba la ayuda del numero de caja; luego OK: 5 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce friccion en reportes de caja para operacion diaria monocomputadora sin ampliar permisos ni contratos API.

## 134. Fase 6 - Activacion explicita de soporte en recibos

Cambio aplicado:

- El panel avanzado de recibos ahora se presenta como "Activar modo soporte tecnico", alineado con la regla de que el modo manual no es operacion diaria.
- Los campos de ancho, alto, margenes, fuente y escala siguen sin renderizarse mientras el panel este colapsado.
- La vista normal de papel mantiene solo papel, copias, logo, sello/firma, impresion de prueba, guardar perfil y vista previa.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "labels the collapsed advanced panel"` | RED inicial: el resumen decia "Modo soporte tecnico"; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx ReceiptSettingsPreview.test.tsx ReceiptPreview.test.tsx ReceiptPreview.a11y.test.tsx` | OK: 4 archivos, 27 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte refuerza que los ajustes manuales de impresion son una activacion consciente de soporte y no una opcion normal del hospital.

## 135. Fase 12 - Acciones de respaldo sin marcador crudo

Cambio aplicado:

- La tabla de respaldos deja de mostrar `-` cuando un respaldo pendiente o fallido no tiene descarga disponible.
- La celda de acciones ahora muestra "Sin descarga", un estado humano y legible para operacion diaria.
- No se agregan acciones nuevas: solo los respaldos exitosos siguen exponiendo el boton de descarga con permiso `backups.download`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "explains unavailable backup downloads"` | RED inicial: la columna Acciones mostraba dos guiones; luego OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce ambiguedad en respaldos sin exponer nombres tecnicos, rutas, checksum ni restauracion en la vista normal.

## 136. Fase 7 - Resumen exportado de cierre sin marcador crudo

Cambio aplicado:

- El CSV de resumen de cierre de caja ya no exporta la nota vacia como `-`.
- Cuando no hay nota, el archivo muestra "Sin nota", manteniendo el reporte legible para revision administrativa.
- No se cambia la regla de cierre: si hay diferencia, la nota sigue siendo obligatoria antes de confirmar.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CloseSessionDialog.test.tsx -t "exports a human empty note label"` | RED inicial: el CSV contenia `"Nota","-"`; luego OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni calculos de caja.
- Este corte mejora la salida exportable del cierre sin relajar permisos, motivo por diferencia ni bloqueo por facturas pendientes.

## 137. Fase 9 - Recibo pendiente con copy operativo

Cambio aplicado:

- La columna "Recibo" del historial deja de mostrar `PDF pendiente` para facturas pagadas o parciales sin recibo institucional.
- El estado visible ahora es "Recibo pendiente", centrado en la tarea del operador y no en el artefacto tecnico.
- Las acciones autorizadas de ver, generar, descargar, reimprimir, anular o reversar no cambian.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "human receipt pending label"` | RED inicial: la tabla seguia mostrando `PDF pendiente`; luego OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni contratos API.
- Este corte reduce jerga tecnica en historial sin relajar RBAC, reimpresion auditada ni generacion institucional.

## 138. Fase 10/16 - Auditoria de anulaciones sin marcador crudo

Cambio aplicado:

- El panel ejecutivo de anulaciones y reversas deja de mostrar `-` cuando faltan paciente, usuario, autorizador, motivo o fecha.
- La tabla ahora usa estados humanos: "Sin paciente", "Sin usuario", "Sin autorizador", "Sin motivo" y "Sin fecha".
- No se cambian calculos, filtros, endpoints, permisos ni datos de auditoria; solo la lectura operativa del reporte.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- VoidsReversalsPanel --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la tabla renderizaba guiones crudos; luego OK: 3 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies ni endpoints.
- Este corte reduce ambiguedad en reportes de auditoria sin relajar RBAC, anulaciones, reversas ni trazabilidad.

## 139. Fase 10/16 - Reporte de caja sin marcador crudo

Cambio aplicado:

- El reporte de caja por turno deja de mostrar `-` cuando faltan factura, paciente, metodo, nota, usuario o fecha en pagos y movimientos.
- La tabla ahora usa estados humanos: "Sin factura", "Sin paciente", "Sin metodo", "Sin nota", "Sin usuario" y "Sin fecha".
- No se cambian calculos de caja, conciliacion, exportacion, filtros, endpoints ni permisos; solo la lectura operativa del reporte.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashSessionReportTab --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la tabla seguia renderizando guiones crudos; luego OK: 6 tests pasan. |
| `npm run test -- CashSessionReportTab ReportsCash ReportsView.subroutes --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 archivos, 16 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce ambiguedad en reportes de caja sin relajar cierre, diferencias, RBAC ni trazabilidad.

## 140. Fase 12/16 - Tamano de respaldo sin marcador crudo

Cambio aplicado:

- La tabla de respaldos deja de mostrar `-` cuando un respaldo pendiente o fallido aun no tiene tamano registrado.
- La celda de tamano ahora muestra "Tamano no disponible", un estado humano para operacion diaria.
- No se agregan rutas ni acciones nuevas; descarga, restauracion y detalle tecnico siguen sujetos a los permisos y vistas existentes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "unavailable backup sizes" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la tabla no mostraba `Tamano no disponible`; luego OK. |
| `npm run test -- BackupsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 22 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte mejora legibilidad de respaldos sin exponer nombre tecnico, checksum, rutas locales ni restauracion en la vista normal.

## 141. Fase 4/16 - Exito pagado orienta impresion

Cambio aplicado:

- El modal de exito de factura usa "Factura pagada" cuando la factura ya fue cobrada.
- La descripcion accesible indica que el recibo esta listo para imprimir, alineando el estado pagado con la accion primaria.
- Los flujos integrados de nueva factura ahora esperan el mismo titulo en escenarios cobrados.
- No se cambian cobros, recibos, idempotencia, rutas, permisos ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el dialogo pagado seguia nombrandose "Factura emitida exitosamente"; luego OK: 3 tests pasan. |
| `npm run test -- NewInvoiceView InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED intermedio: tres escenarios integrados esperaban el titulo anterior; luego OK: 4 archivos, 21 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce ambiguedad en el cierre de venta sin relajar caja, impresion institucional ni trazabilidad fiscal.

## 142. Fase 4/16 - Exito pagado respeta permiso de impresion

Cambio aplicado:

- El modal de exito para factura pagada ya no anuncia "Recibo listo para imprimir" cuando el usuario no tiene permiso para imprimir recibos.
- La descripcion accesible indica que la impresion esta restringida por permisos y el cuerpo orienta a solicitar la impresion en caja.
- No se cambian cobros, generacion PDF, reimpresion, idempotencia, permisos ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el dialogo sin permiso seguia anunciando `Recibo listo para imprimir`; luego OK: 4 tests pasan. |
| `npm run test -- NewInvoiceView InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 archivos, 22 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce una contradiccion de UI/RBAC sin exponer acciones de impresion a usuarios sin permiso.

## 143. Fase 4/16 - Exito pagado sin impresion usa estado correcto

Cambio aplicado:

- El modal de exito para factura pagada sin permiso de impresion ahora dice "La factura ya fue pagada" en el cuerpo operativo.
- Se evita la mezcla de "emitida" con estado pagado cuando la accion de impresion no esta disponible para el usuario.
- No se cambian cobros, generacion PDF, reimpresion, permisos, idempotencia ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el cuerpo seguia diciendo `La factura ya fue emitida`; luego OK: 4 tests pasan. |
| `npm run test -- NewInvoiceView InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 archivos, 22 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce ambiguedad en el flujo pagado sin permiso de recibos sin relajar RBAC ni impresion institucional.

## 144. Fase 4/16 - Confirmacion de factura con Ctrl+Enter

Cambio aplicado:

- La confirmacion de factura permite usar `Ctrl+Enter` desde la accion primaria enfocada para emitir y abrir cobro.
- Enter normal sigue sin disparar confirmacion manual, evitando dobles emisiones accidentales.
- El atajo no se ejecuta cuando la confirmacion esta en estado `submitting`.
- No se cambian endpoints, contratos API, calculos, caja, pagos ni recibos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceConfirmation --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: `Ctrl+Enter` no confirmaba; luego OK: 3 tests pasan. |
| `npm run test -- NewInvoiceView InvoiceConfirmation PaymentModal --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 5 archivos, 41 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK, sin advertencias tras mover el atajo al boton nativo. |
| `npm run build` | OK. Vite reporto tiempos de plugin, sin fallar el build. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte mejora operacion por teclado en facturacion sin relajar protecciones contra doble emision.

## 145. Fase 9/16 - Dialogos de historial muestran paciente humano

Cambio aplicado:

- Los dialogos criticos de anular y reversar factura en historial ya no muestran el paciente vacio cuando `patient_name` llega en blanco.
- Se agrego un fallback humano `Paciente sin nombre` solo para el contexto visible del dialogo.
- No se cambian endpoints, permisos, anulacion, reversa, auditoria, idempotencia ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "shows a human patient fallback" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no existia `Paciente sin nombre`; luego hubo un fallo intermitente del shim de Node (`Could not determine Node.js install directory`) antes de Vitest; reintento OK: 1 test pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 30 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce ambiguedad en acciones peligrosas de historial sin cambiar las reglas fiscales ni de caja.

## 146. Fase 9/16 - Tabla de historial muestra paciente humano

Cambio aplicado:

- La tabla principal de historial ya no deja la celda de paciente en blanco cuando `patient_name` llega vacio o solo con espacios.
- Se muestra `Paciente sin nombre` en la lista para mantener contexto operativo antes de abrir acciones de recibo, anulacion o reversa.
- No se cambian endpoints, permisos, anulacion, reversa, recibos, auditoria, idempotencia ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "shows a human patient fallback in the history table" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la tabla no mostraba `Paciente sin nombre`; luego OK: 1 test pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | Primer GREEN amplio detecto selector ambiguo en el test del dialogo; se acoto al `alertdialog`; luego OK: 31 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | Dos intentos previos fallaron sin logs/cayeron antes de Vite; reintento secuencial OK. Vite reporto tiempos de plugin, sin fallar el build. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte hace mas confiable la consulta diaria de historial sin alterar reglas fiscales ni caja.

## 147. Fase 4/5 - Receta de dialisis solo a nivel factura

Cambio aplicado:

- El frontend dejo de enviar `dialysis_prescription` dentro de cada item de factura.
- `NewInvoiceView`, `invoice.schema.ts` y `InvoiceItemPayload` quedan alineados con el contrato backend: la receta de dialisis se envia solo como bandera top-level de la factura.
- Los mocks e2e de nueva factura/validacion leen la receta desde `payload.dialysis_prescription`, no desde las lineas.
- No se cambian backend, migraciones, caja, pagos, auditoria ni calculos fiscales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView.test.tsx -t "sends dialysis prescription only as an invoice-level flag" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el payload aun incluia `items[0].dialysis_prescription`; luego OK: 1 test pasa. |
| `npm run test -- NewInvoiceView InvoiceCart --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 archivos, 28 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |
| `npx playwright test e2e/new-invoice-flow.spec.ts` | Primer intento fallo por esperar el titulo obsoleto `Factura emitida exitosamente`; se actualizo a `Factura pagada`; reintento OK: 1 test pasa. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, rutas, migraciones, seeders, policies, auditoria ni endpoints.
- Este corte reduce ruido de contrato en la regla no negociable de eritropoyetina sin convertir el frontend en fuente de verdad fiscal.

## 148. Fase 6 - Vista previa A5 con proporcion real

Cambio aplicado:

- `ReceiptSettingsPreview` ahora asigna una proporcion visual especifica para `a5_landscape`.
- La vista previa A5 deja de reutilizar la proporcion de media carta, manteniendo mas fiel la promesa de preview real para Carta, Media carta y A5.
- No se exponen margenes, fuentes, escala, ancho ni alto en el flujo normal; el ajuste es interno al preview.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReceiptSettingsPreview.test.tsx -t "uses the A5 paper proportion" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: A5 usaba `aspect-[8.5/5.5]`; luego OK: 1 test pasa. |
| `npm run test -- ReceiptSettingsPreview.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 tests pasan. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 13 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, perfiles guardados, permisos, auditoria ni endpoints.
- Este corte mejora fidelidad visual de impresion institucional sin dar controles tecnicos al usuario normal.

## 149. Fase 7 - Cierre de caja normaliza monto contado

Cambio aplicado:

- `CashBoxView` valida y ahora envia `closing_amount` recortado al cerrar caja.
- El frontend evita mandar espacios accidentales al contrato backend de cierre, reduciendo errores de Form Request en una operacion critica.
- La nota de cierre conserva el recorte existente; no se cambian calculos, permisos, idempotencia ni cierre backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView.test.tsx -t "trims the counted amount" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el payload enviaba `" 100.00 "`; luego OK: 1 test pasa. |
| `npm run test -- CashBoxView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 10 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, reportes, recibos ni auditoria.
- Este corte refuerza el cierre de caja local sin relajar seguridad ni reglas fiscales.

## 150. Fase 8 - Motivos cortos de catalogo se bloquean en frontend

Cambio aplicado:

- `ServiceSheet` ahora normaliza una sola vez los motivos de cambio de precio e impuesto antes de guardar.
- Si el cambio requiere motivo, el frontend bloquea valores de menos de 5 caracteres y muestra un error humano antes de llamar al API.
- El payload conserva los motivos ya recortados; no se cambian backend, migraciones, permisos, auditoria, endpoints ni reglas fiscales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx -t "blocks short price change reasons" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia el error de minimo 5 caracteres para precio. |
| `npm run test -- ServiceSheet.test.tsx -t "blocks short tax change reasons" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia el error de minimo 5 caracteres para impuesto. |
| `npm run test -- ServiceSheet.test.tsx -t "blocks short" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run test -- ServiceSheet.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 15 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | Primer intento detecto estrechamiento nulo en los motivos; se ajusto la condicion explicita. Reintento OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, caja, facturacion, recibos, reportes ni auditoria.
- Este corte alinea la UX de catalogo con la validacion backend de motivos sin convertir el frontend en fuente de verdad fiscal.
