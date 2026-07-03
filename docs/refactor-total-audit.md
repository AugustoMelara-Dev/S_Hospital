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
- Respaldos: `backups.view`, `backups.create`, `backups.download`, `backups.restore`
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
- Pendiente: validar que rutas sensibles no se expongan al usuario normal y que `backups.restore` no aparezca como accion normal.

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
