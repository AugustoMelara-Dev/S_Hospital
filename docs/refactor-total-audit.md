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

- Reportes: `ReportsView`, `ReportsExecutive`, `ReportsCash`, `ReportsAudit`, `ExecutiveReportFilters`, `ExecutiveSummary`, `TrendChart`, `PaymentMethodPanel`, `ServiceRanking`, `AuditSummaryPanel`, `CashSessionReportPanel`, `CashReconciliationPanel`.
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

- Reportes ya tiene 3 subrutas visibles (`executive`, `cash`, `audit`) y los paneles principales quedaron nombrados por su responsabilidad actual.
- Se elimino `frontend/src/routes.ts`, archivo obsoleto no importado que conservaba etiquetas historicas `Fase 12A`.
- Algunos modulos siguen usando `SectionCard`/cards funcionales; hay que auditar visualmente si son operativas o decorativas.
- No quedan tests frontend/backend saltados con `it.skip`, `test.skip` o `describe.skip` en el inventario vivo.

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

## 151. Fase 9/15 - Historial explica minimo de motivos criticos

Cambio aplicado:

- Los dialogos de reversa y reimpresion institucional en historial ahora muestran explicitamente que el motivo requiere minimo 5 caracteres.
- La ayuda queda asociada al textarea por `aria-describedby`, evitando que el operador solo vea un boton deshabilitado sin contexto.
- No se cambian endpoints, permisos, idempotencia, auditoria, anulacion, reversa ni generacion/descarga de recibos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "keeps reverse confirmation open|keeps institutional reprint confirmation open" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: los dialogos no mostraban `minimo 5 caracteres`; luego OK: 2 tests pasan. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 31 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, caja, catalogo, reportes ni recibos institucionales backend.
- Este corte mejora accesibilidad y claridad de acciones criticas de historial sin relajar la validacion server-side.

## 152. Fase 10 - Reporte de caja valida numero local

Cambio aplicado:

- `ReportsCash` ahora normaliza el numero de caja antes de consultar y bloquea valores vacios o no positivos con errores humanos.
- `CashSessionReportTab` usa input de texto con `inputMode="numeric"` para que la validacion de la app muestre el error en vez de depender del bloqueo nativo del navegador.
- La consulta y la exportacion siguen usando el ID normalizado; no se cambian endpoints, permisos, backend, migraciones ni reportes fiscales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsCash.test.tsx -t "blocks invalid cash session numbers" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: no aparecia el error `Ingrese un numero de caja valido`; luego OK: 1 test pasa. |
| `npm run test -- ReportsCash.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan tras aislar mocks por caso. |
| `npm run test -- CashSessionReportTab.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 6 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, caja operacional, permisos, auditoria ni exportadores.
- Este corte mejora la UX del reporte de caja en operacion LAN/offline evitando consultas inutiles por IDs invalidos.

## 153. Fase 10 - Auditoria bloquea rangos invertidos

Cambio aplicado:

- `ReportsAudit` valida localmente que la fecha de inicio no sea posterior a la fecha final antes de consultar la bitacora.
- Si el rango es invalido, muestra una alerta humana y reporta el estado mediante `onStatus`, sin llamar al API con filtros imposibles.
- La busqueda valida conserva los filtros existentes; no se cambian backend, endpoints, permisos, paginacion ni contratos de auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsAudit.test.tsx -t "blocks inverted audit date ranges" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: el API recibia `from` posterior a `to`; luego OK: 1 test pasa. |
| `npm run test -- ReportsAudit.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 6 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, caja, facturacion, recibos, exportadores ni permisos.
- Este corte mejora reportes de auditoria para operacion LAN/offline evitando errores evitables y mensajes tecnicos del servidor.

## 154. Fase 4 - Facturacion recorta nombre de paciente

Cambio aplicado:

- `NewInvoiceView` ahora recorta espacios iniciales y finales del nombre del paciente justo antes de enviar la factura al backend.
- El frontend conserva al backend como fuente de verdad de totales y validacion fiscal; este cambio solo normaliza el payload de emision para evitar nombres fiscales con espacios accidentales.
- No se cambian endpoints, pagos, caja, recibos, numeracion fiscal, migraciones ni reglas de eritropoyetina.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView.test.tsx -t "trims patient name" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el payload enviaba `"  Maria Lopez  "`; luego OK: 1 test pasa. |
| `npm run test -- NewInvoiceView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 16 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, pagos, caja, recibos, reportes ni permisos.
- Este corte reduce errores humanos en caja sin duplicar calculo fiscal en el frontend ni recalcular facturas historicas.

## 155. Fase 7 - Caja acepta monto inicial pegado

Cambio aplicado:

- `OpenSessionForm` ahora recorta espacios al validar el monto inicial de apertura de caja.
- `CashBoxView` guarda el monto pendiente de apertura ya normalizado antes de mostrar confirmacion y enviarlo al backend.
- No se cambian endpoints, idempotencia, permisos, auditoria, cierre de caja, pagos, migraciones ni reportes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView.test.tsx -t "accepts a pasted opening amount" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no abria la confirmacion para ` 100.00 `; luego OK: 1 test pasa. |
| `npm run test -- CashBoxView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 11 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, facturacion, recibos, catalogo, historial, usuarios ni respaldos.
- Este corte mejora la apertura de caja para operacion real de mostrador y mantiene el backend como autoridad de auditoria y reglas de caja.

## 156. Fase 4 - Cobro acepta monto pegado

Cambio aplicado:

- `PaymentModal` ahora recorta espacios al normalizar el monto recibido antes de validar formato y aplicar reglas de efectivo/no efectivo.
- El flujo conserva la normalizacion de coma decimal y sigue enviando el monto aplicado calculado por el modal al contenedor de factura.
- No se cambian backend, endpoints, pagos server-side, caja, recibos, migraciones, permisos ni idempotencia.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PaymentModal.test.tsx -t "accepts pasted amount" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `onPaymentAmountChange` no recibia `17.25` para ` 17.25 `; luego OK: 1 test pasa. |
| `npm run test -- PaymentModal.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 21 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, migraciones, reportes, catalogo, historial, respaldos ni usuarios.
- Este corte reduce friccion en el cobro diario sin duplicar reglas fiscales ni relajar las validaciones del backend.

## 157. Fase 11 - Identidad institucional se guarda recortada

Cambio aplicado:

- `HospitalSettingsView` ahora recorta espacios iniciales y finales del nombre del hospital y del RTN al resolver el formulario.
- Se agrego una regresion para asegurar que los datos institucionales pegados con espacios lleguen normalizados al API antes de aparecer en recibos y cabeceras.
- No se cambian backend, endpoints, migraciones, numeracion fiscal, recibos PDF, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- HospitalSettingsView.test.tsx -t "trims institutional identity fields" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el payload enviaba `"  Hospital Regional del Norte  "`; luego OK: 1 test pasa. |
| `npm run test -- HospitalSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 5 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte reduce errores humanos en configuracion institucional sin relajar la exigencia de motivo para cambios fiscales.

## 158. Fase 6/11 - Institucion de recibos recorta identidad

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora recorta espacios iniciales y finales del nombre del hospital y RTN al guardar la institucion del recibo.
- Se agrego una regresion para el formulario propio de recibos institucionales, evitando que datos pegados con espacios pasen al API y luego al recibo PDF/papel.
- No se cambian backend, endpoints, migraciones, correlativos de recibos, perfiles de impresion, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "trims receipt institution identity fields" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `updateReceiptInstitution` recibia `hospital_name` y `rtn` con espacios; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 14 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte mejora la calidad de los datos visibles en recibos institucionales sin exponer opciones tecnicas ni modificar la generacion fiscal.

## 159. Fase 6 - Serie de recibos bloquea rango invertido

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora valida que el numero final de la serie sea mayor o igual al numero inicial antes de guardar.
- Se agrego una regresion que intenta guardar un rango `100-50`, muestra un error humano y confirma que no se llama al API de serie.
- No se cambian backend, endpoints, migraciones, correlativos existentes, perfiles de impresion, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "blocks saving a receipt series" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no aparecia el mensaje `El numero final debe ser mayor o igual al inicial`; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 15 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte reduce riesgo operativo al editar rangos de recibos institucionales desde la UI normal sin sustituir la validacion backend.

## 160. Fase 6 - Serie de recibos bloquea correlativo fuera de rango

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora valida que el correlativo actual no supere el numero final de la serie antes de guardar.
- Se agrego una regresion que intenta guardar `max_number=100` y `current_number=150`, muestra un error humano y confirma que no se llama al API de serie.
- No se cambian backend, endpoints, migraciones, correlativos existentes, perfiles de impresion, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "current number exceeds" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no aparecia el mensaje `El correlativo actual no puede superar el numero final`; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 16 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte evita configuraciones imposibles de correlativo desde la UI de recibos sin relajar la autoridad del backend sobre emision fiscal.

## 161. Fase 6 - Serie activa de recibos valida el proximo numero

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora valida que una serie activa deje el siguiente recibo dentro del rango autorizado antes de guardar.
- Se agrego una regresion para `max_number=100` y `current_number=100`, confirmando que el formulario muestra un error humano y no llama al API.
- La regla queda alineada con `StoreReceiptSeriesRequest` y `UpdateReceiptSeriesRequest`, que ya rechazan series activas cuando `current_number + 1` sale del rango.
- No se cambian backend, endpoints, migraciones, correlativos existentes, perfiles de impresion, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "next number leaves" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no aparecia `El siguiente recibo debe quedar dentro del rango autorizado`; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 17 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte evita que la UI normal guarde una serie activa agotada mientras mantiene al backend como autoridad final del correlativo institucional.

## 162. Fase 6 - Serie de recibos recorta identidad fiscal

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora recorta espacios iniciales y finales en `series`, `prefix` y `number_format` antes de guardar la serie del recibo.
- Se agrego una regresion para datos pegados con espacios, confirmando que el API recibe `REC-B`, `RB` y `{series}-{number:08}` normalizados.
- No se cambian backend, endpoints, migraciones, correlativos existentes, perfiles de impresion, permisos ni auditoria.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "trims receipt series identity" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `updateReceiptSeries` recibia `series`, `prefix` y `number_format` con espacios; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 18 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron caja, facturacion, catalogo, historial, reportes, respaldos ni usuarios.
- Este corte reduce errores humanos en la configuracion del correlativo visible del recibo sin modificar reglas fiscales server-side.

## 163. Fase 12 - Descarga de respaldo explica tamano no disponible

Cambio aplicado:

- `BackupsView` ahora muestra `Tamano no disponible` en la confirmacion de descarga cuando el respaldo no trae `size_bytes`.
- Se agrego una regresion que abre el dialogo de descarga para un respaldo exitoso sin tamano y confirma que no aparece un guion crudo.
- No se cambian backend, endpoints, permisos, auditoria, jobs de respaldo, cifrado ni descarga real.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "unavailable backup size in the download confirmation" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el dialogo mostraba `Tamano—`; luego OK: 1 test pasa. |
| `npm run test -- BackupsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 23 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron facturacion, caja, catalogo, historial, usuarios, recibos ni reportes.
- Este corte reduce texto tecnico/ambiguo en el flujo normal de respaldos y mantiene la restauracion fuera de la app.

## 164. Fase 7 - Movimientos de caja toleran hora no disponible

Cambio aplicado:

- `CashMovementsTable` ahora valida la fecha de cada movimiento antes de formatearla.
- Si el reporte de caja trae una hora corrupta o no parseable, la tabla muestra `Hora no disponible` en vez de romper la pantalla con `RangeError: Invalid time value`.
- Se agrego una regresion para un movimiento con `occurred_at='fecha-danada'`, confirmando que no se expone el valor tecnico ni `Invalid Date`.
- No se cambian backend, endpoints, migraciones, permisos, auditoria, idempotencia, cobros ni cierre real de caja.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashMovementsTable.test.tsx -t "shows a human fallback when a movement time is unavailable" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `RangeError: Invalid time value`; luego OK: 1 test pasa. |
| `npm run test -- CashMovementsTable.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron facturacion, catalogo, historial, usuarios, recibos, respaldos ni reportes.
- Este corte mejora la robustez visual del modulo de caja y evita mensajes/errores tecnicos ante datos historicos o reportes inconsistentes.

## 165. Fase 8 - Servicios recortan el nombre visible antes de guardar

Cambio aplicado:

- `ServiceSheet` ahora recorta espacios iniciales y finales del nombre visible del servicio desde el schema de formulario.
- Se agrego una regresion para un servicio creado como `  Consulta externa `, confirmando que el API recibe `Consulta externa`.
- El cambio evita nombres con espacios pegados en catalogo, facturacion, recibos e historial, sin modificar snapshots historicos ya emitidos.
- No se cambian backend, endpoints, migraciones, permisos, auditoria, precios ni reglas especiales como eritropoyetina.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx -t "trims the visible service name before saving" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `saveService` recibia `name: "  Consulta externa  "`; luego OK: 1 test pasa. |
| `npm run test -- ServiceSheet.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 16 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron facturacion, caja, historial, usuarios, recibos, respaldos ni reportes.
- Este corte reduce errores humanos al crear/editar servicios y conserva al backend como autoridad final para auditoria y reglas de catalogo.

## 166. Fase 9 - Historial muestra fecha no disponible

Cambio aplicado:

- `InvoiceHistoryView` ahora muestra `Fecha no disponible` cuando la fecha de emision de una factura no puede formatearse.
- Se agrego una regresion con `issued_at='fecha-danada'`, confirmando que el historial no expone el valor tecnico ni `Invalid Date`.
- El cambio se limita al historial de facturas para mejorar lectura operativa sin cambiar el contrato global de formateo de fechas.
- No se cambian backend, endpoints, migraciones, permisos, auditoria, anulacion, reversa ni reimpresion real.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "shows a human fallback when the invoice date is unavailable" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no aparecia `Fecha no disponible`; luego OK: 1 test pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 32 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron facturacion, caja, catalogo, usuarios, recibos, respaldos ni reportes.
- Este corte evita texto ambiguo en una tabla critica para buscar, reimprimir, anular y auditar facturas.

## 167. Fase 10 - Historial recorta filtros de busqueda antes de consultar

Cambio aplicado:

- `useInvoices` ahora normaliza filtros de historial antes de construir la query de TanStack Query y antes de llamar al API.
- Los filtros de texto se recortan; si quedan vacios, se omiten de la consulta.
- Se agrego una regresion para paciente y numero de factura con espacios de borde, confirmando que el API recibe `Maria Lopez` y `000-001-01-00000022`.
- La UI mantiene el control de filtros existente; el cambio solo limpia el contrato de consulta para reducir errores humanos en caja/recepcion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- useInvoices.test.tsx -t "trims text filters before querying invoice history" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `getInvoices` recibia espacios y `status: ""`; luego OK: 1 test pasa. |
| `npm run test -- useInvoices.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 32 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, endpoints, migraciones, permisos, auditoria, caja, catalogo, recibos, respaldos ni reportes.
- Este corte hace mas tolerante la busqueda de facturas sin alterar totales, pagos, anulaciones, reversas ni datos historicos.

## 168. Fase 11 - Usuarios recortan identidad antes de guardar

Cambio aplicado:

- `UserFormDialog` ahora recorta espacios iniciales y finales de nombre, correo y nombre de usuario antes de validar y enviar.
- Se agrego una regresion para crear una cuenta operativa con espacios de borde, confirmando que el submit recibe `Caja Principal`, `caja.principal@hospital.org` y `caja_principal`.
- La contrasena inicial no se recorta ni se relaja; conserva la misma politica de complejidad alineada con Laravel.
- No se cambian permisos, roles protegidos, ultimo administrador activo, endpoints ni reglas backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog.test.tsx -t "trims user identity fields before creating an operational account" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `onSubmit` no era llamado por validacion con espacios; luego OK: 1 test pasa. |
| `npm run test -- UserFormDialog.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 14 tests pasan. |
| `npm run test -- UsersView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 26 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni reportes.
- Este corte reduce errores humanos al crear cajeros/usuarios locales sin cambiar seguridad, auditoria ni RBAC.

## 169. Fase 12 - Reporte de anulaciones tolera fechas no disponibles

Cambio aplicado:

- `VoidsReversalsPanel` ahora usa el formateador seguro compartido para fechas de anulaciones y reversas.
- Si una fecha de auditoria llega corrupta o no parseable, el reporte muestra `Fecha no disponible` en vez de `Invalid Date` o el valor tecnico recibido.
- Se agrego una regresion con `created_at='fecha-danada'` para asegurar que el reporte ejecutivo no exponga texto tecnico en auditoria operativa.
- Se mantiene `Sin fecha` para datos realmente ausentes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- VoidsReversalsPanel.test.tsx -t "shows a human fallback when an audit date is unavailable" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: la tabla mostraba `Invalid Date`; luego OK: 1 test pasa. |
| `npm run test -- VoidsReversalsPanel.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte mejora reportes utiles para gerencia/auditoria sin alterar calculos, montos, permisos ni datos fiscales.

## 170. Fase 13 - Reporte de pendientes tolera fechas no disponibles

Cambio aplicado:

- `PendingAgingPanel` ahora usa el formateador seguro compartido para la fecha de emision de facturas pendientes.
- Si `issued_at` llega corrupto o no parseable, el reporte muestra `Fecha no disponible` en vez de `Invalid Date` o el valor tecnico recibido.
- Se agrego una regresion con `issued_at='fecha-danada'` para proteger el reporte de antiguedad de saldos pendientes.
- No se cambian calculos de antiguedad, saldos, totales ni agrupaciones por rango.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PendingAgingPanel.test.tsx -t "shows a human fallback when a pending invoice date is unavailable" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: la tabla mostraba `Invalid Date`; luego OK: 1 test pasa. |
| `npm run test -- PendingAgingPanel.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte mejora reportes utiles de cuentas pendientes sin alterar auditoria, permisos ni datos fiscales.

## 171. Fase 14 - Conciliacion de caja tolera fechas no disponibles

Cambio aplicado:

- `CashReconciliationPanel` ahora usa el formateador seguro compartido para apertura y cierre de sesiones de caja.
- Si `opened_at` o `closed_at` llegan corruptos o no parseables, el reporte muestra `Fecha no disponible` en vez de `Invalid Date` o valores tecnicos.
- Se agrego una regresion con apertura y cierre corruptos para proteger el reporte de conciliacion diaria.
- Se mantiene `Sin fecha` para fechas realmente ausentes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashReconciliationPanel.test.tsx -t "shows human fallbacks when cash session dates are unavailable" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: la tabla mostraba dos `Invalid Date`; luego OK: 1 test pasa. |
| `npm run test -- CashReconciliationPanel.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte mejora el reporte de caja/cierre diario sin alterar calculos de esperado, contado, diferencias ni auditoria.

## 172. Fase 15 - Conciliacion no inventa diferencias con montos corruptos

Cambio aplicado:

- `CashReconciliationPanel` ahora normaliza montos de conciliacion antes de sumar efectivo esperado, contado y contar sesiones con diferencia.
- Si `expected_cash`, `counted_cash` o `difference` llegan corruptos o no parseables, se tratan como cero para evitar `NaN`, valores crudos o una diferencia positiva falsa.
- Se agrego una regresion con `monto-danado`, `no-numero`, `NaN` y `difference='monto-danado'`, confirmando que el panel conserva `0 sesiones con diferencia`.
- No se cambian reglas backend ni calculos oficiales; solo se evita que un reporte con datos corruptos confunda el cierre diario.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashReconciliationPanel.test.tsx -t "does not count malformed cash differences as real differences" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el panel contaba `1 sesion con diferencia` y mostraba `+ L 0.00`; luego OK: 1 test pasa. |
| `npm run test -- CashReconciliationPanel.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte endurece reportes utiles de caja sin alterar pagos, cierres reales, auditoria ni datos fiscales.

## 173. Fase 15 - Tendencia diaria normaliza montos corruptos

Cambio aplicado:

- `TrendChart` ahora normaliza los montos diarios antes de construir la serie de Recharts.
- Si `billed`, `collected` o `pending` llegan corruptos o no parseables, el grafico y la tabla accesible usan `0`/`L 0.00` en vez de propagar `NaN` o valores tecnicos.
- Se agrego una regresion con `billed='no-numero'` y `collected='NaN'`, confirmando que la serie del grafico queda finita y que el DOM no expone texto tecnico.
- No se cambian calculos backend, filtros, exportaciones, permisos ni contratos de reporte.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- TrendChart.test.tsx -t "normalizes malformed daily money values" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: la serie recibia `NaN` y al serializar quedaba `null`; luego OK: 1 test pasa. |
| `npm run test -- TrendChart.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 1 test pasa. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte mejora la confiabilidad visual del reporte ejecutivo sin alterar totales oficiales ni exportaciones server-side.

## 174. Fase 15 - Metodos de pago toleran porcentajes corruptos

Cambio aplicado:

- `PaymentMethodPanel` ahora normaliza conteos y porcentajes de metodos de pago antes de renderizar barras y tabla.
- Si `percentage` o `count` llegan corruptos o no parseables, el reporte muestra `0.00%` y `0 pagos` en vez de romper la pantalla o exponer valores tecnicos.
- Se agrego una regresion con `percentage='NaN'` y `count='no-numero'`, confirmando que el panel no crashea ni muestra datos crudos.
- No se cambian calculos backend, totales oficiales, filtros, exportaciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PaymentMethodPanel.test.tsx -t "normalizes malformed payment method percentages" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `method.percentage.toFixed is not a function`; luego OK: 1 test pasa. |
| `npm run test -- PaymentMethodPanel.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte endurece el reporte ejecutivo ante datos inconsistentes sin alterar la fuente de verdad server-side.

## 175. Fase 15 - Resumen ejecutivo ignora deltas corruptos

Cambio aplicado:

- `ExecutiveSummary` ahora muestra badges de comparacion solo cuando el delta porcentual es un numero finito.
- Si `delta_percentage` llega corrupto o no parseable, el resumen conserva los KPIs principales y omite el badge en vez de romper la pantalla con `toFixed`.
- Se agrego una regresion con `delta_percentage='NaN'`, confirmando que el total facturado sigue visible y que el DOM no expone `NaN`.
- No se cambian calculos backend, comparativos oficiales, filtros, exportaciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ExecutiveSummary.test.tsx -t "ignores malformed comparison deltas" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `percentage.toFixed is not a function`; luego OK: 1 test pasa. |
| `npm run test -- ExecutiveSummary.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte protege la primera lectura gerencial del reporte ejecutivo sin alterar la autoridad del backend sobre metricas.

## 176. Fase 10 - Ranking de servicios muestra cantidades como unidades

Cambio aplicado:

- `ServiceRanking` ahora formatea las columnas `Cantidad` como unidades con `formatQuantity`, no como moneda.
- Los importes `Facturado` y `Cobrado` conservan `formatLempirasUI`, separando volumen operativo de valores financieros.
- Se agrego una regresion que valida cantidades `12.00`, `18.00` y `7.00` sin prefijo `L`, manteniendo `L 1,200.00` para el total facturado.
- No se cambian calculos backend, contratos API, filtros, exportaciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceRanking.test.tsx -t "formats quantities as units" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: no encontraba `12.00` porque la cantidad se mostraba como `L 12.00`; luego OK: 1 test pasa. |
| `npm run test -- ServiceRanking.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte hace mas legible el reporte ejecutivo de servicios al evitar mezclar cantidades atendidas con montos financieros.

## 177. Fase 15 - Alertas ejecutivas ignoran conteos tecnicos

Cambio aplicado:

- `ExecutiveAlerts` ahora normaliza los conteos de pendientes antiguos, diferencias de caja y eventos criticos antes de decidir si muestra una alerta.
- Si un conteo llega como `Infinity`, `NaN`, negativo o no parseable, se trata como cero y no se muestra una alerta confusa.
- Se agrego una regresion con conteos malformados, confirmando que no aparece el bloque de alertas ni se filtran textos tecnicos al DOM.
- No se cambian calculos backend, umbrales oficiales, filtros, exportaciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ExecutiveAlerts.test.tsx -t "does not expose malformed alert counts" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: aparecia `Alertas operativas` con conteos tecnicos; luego OK: 1 test pasa. |
| `npm run test -- ExecutiveAlerts.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run test -- ReportsExecutive.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte evita que el resumen ejecutivo muestre alertas tecnicas ante datos inconsistentes y mantiene el reporte legible para gerencia/caja.

## 178. Fase 1 - Cobro ignora submits repetidos durante registro

Cambio aplicado:

- `PaymentModal` ahora ignora cualquier submit directo del formulario mientras `submitting=true`.
- Esto mantiene bloqueado el contrato de cobro aunque el boton ya este deshabilitado y evita una segunda llamada a `onConfirm` por rutas programaticas o de teclado del navegador.
- Se agrego una regresion que simula un submit directo durante `Cobrando...` y confirma que no se registra otro cobro.
- No se cambian totales, validaciones de monto, cambio en efectivo, abonos parciales, impresion ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PaymentModal.test.tsx -t "ignores direct form submits while a payment is already being registered" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `onConfirm` se llamaba con `17.25`; luego OK: 1 test pasa. |
| `npm run test -- PaymentModal.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 22 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, catalogo, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce riesgo de cobros duplicados en caja sin alterar la autoridad del backend ni el flujo principal de impresion institucional.

## 179. Fase 4 - Historial sanea paginacion invalida desde URL

Cambio aplicado:

- `InvoiceHistoryView` ahora normaliza `page` y `per_page` al construir filtros desde `searchParams`.
- Si la URL trae valores corruptos, cero o no numericos, el historial consulta con `page=1` y `per_page=10`.
- Se agrego una regresion con `/invoices?page=abc&per_page=0`, confirmando que `getInvoices` no recibe `NaN` ni paginacion invalida.
- No se cambian filtros de paciente, numero, fechas, estados, acciones de anulacion, reimpresion ni recibos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "sanitizes invalid pagination search params" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `getInvoices` recibia `page: NaN` y `per_page: 0`; luego OK: 1 test pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 33 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, caja, catalogo, recibos, respaldos, reportes ni usuarios.
- Este corte protege el historial de facturas ante URLs manipuladas o marcadores corruptos, manteniendo estable el contrato del API local.

## 180. Fase 2 - Apertura de caja bloquea edicion durante envio

Cambio aplicado:

- `OpenSessionForm` ahora deshabilita el campo `Monto inicial` mientras `isSubmitting=true`.
- Esto evita que el cajero modifique visualmente el monto de apertura despues de confirmar una solicitud que ya esta en curso.
- Se agrego una regresion que confirma que el input queda bloqueado durante `Abriendo...`.
- No se cambian permisos, idempotencia, payload de apertura, cierre de caja ni calculos de diferencia.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- OpenSessionForm.a11y.test.tsx -t "prevents editing the opening amount" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el input seguia habilitado; luego OK: 1 test pasa. |
| `npm run test -- OpenSessionForm.a11y.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 4 tests pasan. |
| `npm run test -- CashBoxView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 11 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, catalogo, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce confusion operativa en la apertura de caja y conserva la seriedad del flujo local de caja.

## 181. Fase 3 - Catalogo bloquea precio mientras guarda servicio

Cambio aplicado:

- `ServiceSheet` ahora deshabilita el campo `Precio` mientras `isSubmitting=true`.
- Esto evita que el administrador modifique visualmente el precio vigente despues de enviar una creacion o actualizacion del servicio.
- Se agrego una regresion con `saveService` pendiente que confirma que el boton muestra `Guardando...` y el precio queda bloqueado.
- No se cambian reglas de eritropoyetina, motivos de cambio de precio/ISV, permisos, payloads ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx -t "locks the service price while the save request is pending" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el input de precio seguia habilitado durante `Guardando...`; luego OK: 1 test pasa. |
| `npm run test -- ServiceSheet.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 17 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce confusion operativa en catalogo y mantiene protegidos los precios de servicios durante solicitudes pendientes.

## 182. Fase 6 - Respaldos muestran fecha segura ante timestamp corrupto

Cambio aplicado:

- `BackupsView` ahora devuelve `Fecha no disponible` cuando la fecha relativa de un respaldo no se puede interpretar.
- Esto evita que el KPI `Ultimo exitoso` muestre `hace NaNd` si el servidor local entrega un timestamp corrupto.
- Se agrego una regresion con `last_success_at='fecha-danada'`, confirmando que no se filtra `NaN`, `fecha-danada` ni `invalid date` al DOM.
- No se cambian creacion, descarga, permisos, auditoria ni contratos API de respaldos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView.test.tsx -t "shows a safe backup age" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el KPI mostraba `hace NaNd`; luego OK: 1 test pasa. |
| `npm run test -- BackupsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 24 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, reportes ni usuarios.
- Este corte mejora la resiliencia visual del panel de respaldos locales sin alterar la operacion de backup.

## 183. Fase 7 - Usuarios bloquean identidad durante guardado

Cambio aplicado:

- `UserFormDialog` ahora deshabilita nombre, correo, usuario y contraseña inicial mientras `isSubmitting=true`.
- Esto evita que el administrador modifique visualmente datos de una cuenta operativa despues de enviar la solicitud de creacion o edicion.
- Se agrego una regresion con `onSubmit` pendiente que confirma que el boton muestra `Guardando...` y el correo queda bloqueado.
- No se cambian roles, permisos directos, confirmaciones criticas, validacion de contrasena ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog.test.tsx -t "locks user identity fields" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el correo seguia habilitado durante `Guardando...`; luego OK: 1 test pasa. |
| `npm run test -- UserFormDialog.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 15 tests pasan. |
| `npm run test -- UsersView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 26 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni reportes.
- Este corte reduce confusion operativa al administrar usuarios basicos sin ampliar la matriz RBAC.

## 184. Fase 7 - Caja bloquea conteo durante cierre pendiente

Cambio aplicado:

- `CashClosingPanel` ahora deshabilita `Monto contado` y `Nota de cierre` mientras `isSubmitting=true`.
- Esto evita que el cajero modifique visualmente el conteo o la nota despues de confirmar el cierre y antes de recibir respuesta del servidor local.
- Se agrego una regresion con `closeCashSession` pendiente que confirma que el cierre se envio una sola vez y ambos campos quedan bloqueados.
- No se cambian calculo de diferencia, motivo obligatorio, idempotencia, permisos, payloads ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView.test.tsx -t "locks close cash fields" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: `Monto contado` seguia habilitado durante el cierre pendiente; luego OK: 1 test pasa. |
| `npm run test -- CashBoxView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 12 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, catalogo, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce confusion operativa en el cierre de caja sin alterar la validacion fiscal ni la auditoria del cierre.

## 185. Fase 4 - Cobro bloquea datos mientras registra pago

Cambio aplicado:

- `PaymentModal` ahora deshabilita metodo de pago, monto recibido y referencia mientras `submitting=true`.
- Esto evita que el cajero modifique visualmente los datos del cobro despues de confirmar `Registrar cobro e imprimir`.
- Se agrego una regresion con `submitting=true` que confirma que los campos quedan bloqueados y el boton mantiene el estado `Cobrando...`.
- No se cambian calculo de cambio, abonos parciales, validacion de saldo, impresion posterior, idempotencia ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- PaymentModal.test.tsx -t "locks payment fields" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: metodo de pago seguia habilitado durante `Cobrando...`; luego OK: 1 test pasa. |
| `npm run test -- PaymentModal.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 23 tests pasan. |
| `npm run test -- NewInvoiceView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=90000` | OK: 16 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, caja, catalogo, historial, recibos, respaldos, reportes ni usuarios.
- Este corte mejora la consistencia operativa del cobro sin mover la fuente de verdad de totales fuera del backend.

## 186. Fase 9 - Historial muestra progreso al registrar reimpresion

Cambio aplicado:

- El dialogo de reimpresion auditada ahora cambia su accion principal a `Registrando reimpresión...` mientras `registeringReprint=true`.
- Esto deja claro que la solicitud de reimpresion ya esta en curso y evita dudas operativas durante la auditoria del PDF/recibo.
- Se agrego una regresion con `getInvoice` pendiente que confirma que el boton queda deshabilitado con etiqueta de progreso.
- No se cambian permisos, motivos minimos, idempotencia, apertura de PDF, fallback legacy ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView.test.tsx -t "shows progress while registering" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el boton no mostraba progreso durante el registro; luego OK: 1 test pasa. |
| `npm run test -- InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=90000` | OK: 34 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, recibos, respaldos, reportes ni usuarios.
- Este corte mejora la claridad operativa del historial sin relajar auditoria ni permisos de reimpresion.

## 187. Fase 6 - Recibos bloquean perfil mientras guarda

Cambio aplicado:

- `InstitutionalReceiptSettingsView` ahora bloquea perfiles disponibles, selector de papel, copias, logo/sello, controles normales y `Imprimir prueba` mientras `profileMutation.isPending=true`.
- Esto evita que soporte o administracion cambien visualmente el papel o las copias despues de enviar `Guardar perfil` y antes de recibir respuesta del servidor local.
- Se agrego una regresion con `updateReceiptPrintProfile` pendiente que confirma que los controles normales quedan deshabilitados durante el guardado.
- No se cambian campos avanzados, validacion de motivo de soporte, serie/correlativo, generacion del PDF de prueba, permisos ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx -t "locks normal paper profile controls" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el boton de papel `Carta` seguia habilitado durante el guardado pendiente; luego OK: 1 test pasa. |
| `npm run test -- InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=45000` | OK: 19 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, respaldos, reportes ni usuarios.
- Este corte reduce confusion en configuracion de impresion normal sin exponer margenes, fuentes, ancho, alto ni escala al flujo operativo.

## 188. Fase 13 - Reset de clave bloquea campo temporal

Cambio aplicado:

- `PasswordResetDialog` ahora deshabilita `Nueva contrasena temporal` mientras `isSubmitting=true`.
- Esto evita que administracion cambie visualmente la clave temporal despues de enviar `Restablecer clave` y antes de recibir respuesta del servidor local.
- Se agrego una regresion desde `UsersView` con `resetUserPassword` pendiente que confirma que el campo sensible queda bloqueado y el boton muestra `Restableciendo...`.
- No se cambian politica de contrasenas, permisos, menu de acciones, cierre del dialogo, contratos API ni auditoria backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView.test.tsx -t "locks the temporary password field" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el input de nueva contrasena seguia habilitado durante el reset pendiente; luego OK: 1 test pasa. |
| `npm run test -- UsersView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 27 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni reportes.
- Este corte reduce confusion operativa en usuarios basicos sin ampliar la matriz RBAC ni relajar la validacion de contrasenas.

## 189. Fase 8 - Catalogo bloquea formulario mientras guarda servicio

Cambio aplicado:

- `ServiceSheet` ahora deshabilita categoria, area, nombre, motivos, codigos, regla especial, ISV, estado, visibilidad y facturable mientras `isSubmitting=true`.
- Esto evita que administracion cambie visualmente datos del servicio despues de enviar `Crear` o `Actualizar` y antes de recibir respuesta del servidor local.
- Se amplio la regresion existente para confirmar que nombre, precio, categoria, ISV y estado quedan bloqueados durante un `saveService` pendiente.
- No se cambian reglas de eritropoyetina, precio fijo L.25, motivos obligatorios, payloads, permisos, auditoria backend ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx -t "locks the service form" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial correcto: el campo `Nombre` seguia habilitado durante el guardado pendiente; luego OK: 1 test pasa. |
| `npm run test -- ServiceSheet.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 17 tests pasan. |
| `npm run test -- CatalogView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=60000` | OK: 19 tests pasan. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce errores operativos al administrar servicios y conserva la fuente de verdad de precios/reglas en backend.

## 190. Fase 6 - Caja bloquea apertura mientras confirma monto

Cambio aplicado:

- `CashBoxView` ahora bloquea el formulario de apertura cuando el dialogo de confirmacion esta activo o la apertura esta en curso.
- Esto evita que caja cambie visualmente el monto inicial despues de pedir confirmacion y antes de aceptar o cancelar la apertura auditada.
- Se agrego una regresion con `openCashSession` controlado que confirma que el campo `Monto inicial` y el boton del formulario quedan bloqueados mientras se muestra `Confirmar apertura de caja`.
- No se cambian payloads, idempotencia, permisos, cierre de caja, reportes, auditoria backend ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx -t "locks the open cash form"` | RED inicial correcto: el campo `Monto inicial` seguia habilitado durante la confirmacion; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx` | OK: 13 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, catalogo, historial, recibos, respaldos, reportes ni usuarios.
- Este corte reduce confusion operativa al abrir caja y conserva el backend como fuente de verdad para la sesion auditada.

## 191. Fase 8 - Reportes bloquean filtros mientras exporta ejecutivo

Cambio aplicado:

- `ReportFiltersPanel` ahora deshabilita periodo rapido, inicio y fin mientras el reporte ejecutivo esta cargando o exportando.
- Esto evita que administracion cambie visualmente el rango despues de solicitar un PDF/Excel y antes de recibir el archivo del servidor local.
- Se amplio la regresion de `ReportsExecutive` con `downloadExecutivePdf` pendiente para confirmar que los filtros quedan bloqueados junto a los botones de exportacion/refresco.
- No se cambian payloads, permisos de exportacion, nombres de archivo, descarga PDF/Excel, resumen ejecutivo ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- ReportsExecutive.test.tsx -t "shows export progress"` | RED inicial correcto: el selector `Periodo rapido` seguia habilitado durante la exportacion; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ReportsExecutive.test.tsx ReportFiltersPanel.test.tsx` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte reduce errores operativos al generar reportes ejecutivos y mantiene el backend como fuente de verdad de los datos exportados.

## 192. Fase 8 - Reporte de caja bloquea consulta mientras exporta

Cambio aplicado:

- `CashSessionReportTab` ahora deshabilita `Numero de Caja` y `Ver caja` mientras consulta o exporta el reporte cargado.
- Esto evita que administracion cambie visualmente la caja seleccionada despues de solicitar `Exportar Excel` y antes de recibir el archivo local.
- Se agrego una regresion en `ReportsCash` con `downloadReportExport` pendiente que confirma que la consulta y la exportacion quedan bloqueadas durante el archivo en curso.
- No se cambian payloads, permisos de exportacion, nombre del archivo, totales de caja, movimientos, pagos ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- ReportsCash.test.tsx -t "locks the cash session lookup"` | RED inicial correcto: el campo `Numero de Caja` seguia habilitado durante la exportacion; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ReportsCash.test.tsx CashSessionReportTab.test.tsx` | OK: 10 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja operativa, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte reduce errores operativos al exportar cierres de caja y conserva los datos del servidor como fuente de verdad.

## 193. Fase 8 - Auditoria bloquea filtros mientras carga bitacora

Cambio aplicado:

- `ReportsAudit` ahora deshabilita accion, desde, hasta, buscar y limpiar mientras `getAuditLogs` esta consultando la bitacora.
- Esto evita que administracion cambie visualmente filtros de anulaciones, reimpresiones o cierres mientras una busqueda auditada esta en curso.
- Se agrego una regresion con `getAuditLogs` pendiente que confirma que todo el formulario de filtros queda bloqueado durante la carga.
- Se ajusto la prueba de alias humanos para esperar la carga inicial antes de aplicar un filtro, reflejando el nuevo bloqueo operativo.
- No se cambian alias de acciones, paginacion, permisos, resumen mensual, contratos API ni consulta backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- ReportsAudit.test.tsx -t "locks audit filters"` | RED inicial correcto: el campo `Accion` seguia habilitado durante la carga; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ReportsAudit.test.tsx` | OK: 7 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron backend, facturacion, caja, catalogo, historial, recibos, respaldos ni usuarios.
- Este corte reduce errores operativos al revisar auditoria y conserva el servidor como fuente de verdad para la bitacora.

## 194. Fase 1 - Facturacion no guarda codigos tecnicos en items

Cambio aplicado:

- `CalculateInvoiceTotalsAction` ya no copia `scan_code`, `barcode` ni `qr_code` del catalogo hacia `invoice_items`.
- Los items facturados conservan snapshots operativos/fiscales necesarios: servicio, categoria, area, cantidades, precios, impuestos, totales, notas y reglas especiales.
- Se agrego una regresion que factura un servicio con codigos tecnicos y confirma que la fila historica queda sin esos valores.
- No se eliminan columnas ni se cambia el contrato de facturacion, numeracion fiscal, caja, pagos, recibos ni catalogo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=invoice_items_do_not_snapshot_scanner_or_barcode_codes` | RED inicial correcto: `invoice_items` guardaba `SCAN-GLU-001`, `BAR-GLU-001` y `QR-GLU-001`; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=InvoiceCreationTest` | OK: 30 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 archivos pasan. |

Decision:

- No se agregaron dependencias nuevas.
- No se tocaron frontend, caja, pagos, reportes, respaldos, usuarios ni recibos PDF.
- Este corte reduce el riesgo de exponer codigos internos en historicos o salidas posteriores, manteniendo la factura como snapshot institucional y no como copia tecnica del catalogo.

## 195. Fase 1 - Contrato unitario de snapshots sin codigos tecnicos

Cambio aplicado:

- `CalculateInvoiceTotalsActionTest` ahora valida que el snapshot calculado conserva datos institucionales del servicio sin copiar `scan_code`, `barcode` ni `qr_code`.
- Se renombro el caso unitario para que la intencion quede explicita junto a los asserts de cantidad, precio, total y notas.
- No se cambiaron acciones, controladores, migraciones, frontend, recibos, caja, reportes ni catalogo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=CalculateInvoiceTotalsActionTest` | RED inicial correcto: el test esperaba `EPO001`; luego OK: 12 tests pasan. |
| `docker compose exec backend php artisan test --filter=InvoiceCreationTest` | OK: 30 tests pasan. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte deja alineada la prueba unitaria con la regla historica/fiscal: la factura guarda lo necesario para auditoria y recibos, no codigos tecnicos del catalogo.

## 196. Fase 4 - Copia operativa correcta en reimpresiones

Cambio aplicado:

- `InvoiceHistoryView` muestra acentos correctos en ayudas de reversa y reimpresion auditada: `acción` y `mínimo`.
- `ConfirmDialog` corrige la descripcion accesible, placeholder y ayuda por defecto para acciones criticas con motivo.
- `ReceiptPreview.test` deja de contener una expectativa mojibakeada sobre `tamaño del recibo`.
- No se cambiaron permisos, idempotencia, anulaciones, reversas, reimpresiones, PDF, recibos ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx -t "keeps institutional reprint confirmation open"` | RED inicial correcto: el dialogo mostraba `Esta accion` y `minimo`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- confirm-dialog.test.tsx ReceiptPreview.test.tsx` | OK: 12 tests pasan. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx` | OK: 34 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora claridad para caja/supervision en acciones auditadas sin alterar datos fiscales ni flujos criticos.

## 197. Fase 7 - Estados compartidos con copia operativa clara

Cambio aplicado:

- `PermissionState` y `OfflineState` ahora muestran copia pulida para permisos, solo lectura, acciones bloqueadas y conexion LAN.
- Los mensajes centrales de conflicto en `api/base`, `i18n/es-HN`, soporte y estado operativo usan acentos correctos para `accion`, `cambio`, `operacion` y `conexion`.
- Se agrego una regresion al design system para evitar que los estados compartidos vuelvan a texto sin acentos.
- No se cambiaron permisos, roles, rutas, validaciones, mutaciones ni contratos API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- design-system.test.tsx -t "polished Spanish copy"` | RED inicial correcto: `PermissionState` mostraba `accion`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- design-system.test.tsx base.test.ts errorCatalog.test.ts` | OK: 39 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora mensajes que ven cajeros y administradores cuando una operacion queda bloqueada, sin alterar seguridad ni auditoria.

## 198. Fase 6 - Descarga de respaldos con copia operativa clara

Cambio aplicado:

- `BackupsView` muestra copia acentuada en la confirmacion de descarga auditada para "descargara" y "esta accion".
- El tamano no disponible en confirmacion y tabla de historial ahora se presenta como texto operativo correcto, sin guiones ni jerga tecnica.
- Se ajustaron regresiones de descarga y tamano desconocido para evitar volver a la copia anterior.
- No se cambiaron permisos, endpoint de descarga, nombre seguro del archivo, idempotencia, auditoria ni flujo de creacion de respaldos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- BackupsView.test.tsx -t "confirms and reports backup downloads|explains unavailable backup size"` | RED inicial correcto: el dialogo mostraba `Descargara`, `Esta accion` y `Tamano`; luego OK: 3 tests pasan. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx -t "explains unavailable backup sizes"` | RED inicial correcto: la tabla mostraba `Tamano no disponible`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx` | OK: 24 tests pasan. |
| `docker compose exec frontend npm run test -- useBackups.test.tsx` | OK: 10 tests pasan. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora el flujo de descarga manual de respaldos locales sin tocar la seguridad ni la auditoria del archivo descargado.

## 199. Fase 8 - Respaldos comprimidos cifrados consistentes

Cambio aplicado:

- `CreateBackupAction` ahora genera backups nuevos como `.sql.gz.enc`: primero dump SQL, luego gzip local, luego cifrado por chunks.
- `hospital:decrypt-backup` mantiene compatibilidad con respaldos legacy sin compresion y descomprime automaticamente paquetes gzip para entregar un `.sql` temporal de restore.
- La descarga backend y el nombre seguro del navegador usan extension `.sql.gz.enc` sin exponer nombres tecnicos internos.
- El runbook de restore muestra el paso explicito para descifrar/descomprimir antes de alimentar el helper o `mysql`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter BackupWorkflowTest` | RED inicial correcto: backup nuevo seguia `.sql.enc` y fallback de descarga seguia `.sql.enc`; luego OK: 26 tests pasan. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx -t "confirms and reports backup downloads"` | RED inicial correcto: el navegador descargaba `respaldo-local-2026-06-18-1.sql.enc`; luego OK: 1 test pasa. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 426 files. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx` | OK: 24 tests pasan. |
| `docker compose exec frontend npm run test -- useBackups.test.tsx` | OK: 10 tests pasan. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas; se usa zlib disponible en PHP para comprimir en streaming.
- Este corte alinea codigo, pruebas y runbook para que el archivo respaldado sea realmente comprimido y cifrado antes de copiarse o restaurarse.

## 200. Fase 8 - Respaldos usan clave dedicada

Cambio aplicado:

- Se agrego `BackupFileCipher` para cifrar chunks de respaldos con AES-256-GCM usando `HOSPITAL_BACKUP_ENCRYPTION_KEY`.
- `EncryptBackupFileAction` deja de depender de `APP_KEY` para respaldos nuevos.
- `hospital:decrypt-backup` descifra paquetes nuevos con la clave dedicada y mantiene compatibilidad con chunks legacy cifrados con `APP_KEY`.
- Si la clave dedicada falta, el backup falla con mensaje operativo y no publica archivo.
- `SECRETS.md` y el runbook de restore se actualizaron para no indicar que los respaldos nuevos dependen de `APP_KEY`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter backup_runner_creates_success_log_checksum_and_audit_entry` | RED inicial correcto: el primer chunk aun se descifraba con `APP_KEY`; luego OK dentro de `BackupWorkflowTest`. |
| `docker compose exec backend php artisan test --filter BackupWorkflowTest` | RED inicial correcto: sin clave dedicada el backup terminaba `success`; luego OK: 28 tests pasan. |
| `docker compose exec backend php artisan test --filter BackupRestoreRoundtripTest` | OK: 4 tests pasan, 1 skip por falta de mysqldump en el ambiente. |
| `docker compose exec backend vendor/bin/pint --test` | RED inicial por estilo; luego OK: 427 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | RED inicial por comparacion redundante; luego OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas; se usa OpenSSL/zlib disponibles en PHP.
- Este corte separa la clave de respaldos de la clave general de Laravel y reduce el riesgo operativo ante rotacion de `APP_KEY`.

## 201. Fase 1 - Facturas protegidas contra borrado Eloquent

Cambio aplicado:

- `Invoice` ahora bloquea cualquier `delete()` de Eloquent con un error de dominio: las facturas deben anularse con motivo y auditoria.
- La regresion existente de factura con items deja de depender de la FK como unica defensa.
- Se agrego una regresion para el caso peligroso donde alguien borra items primero y luego intenta borrar la factura.
- La prueba de recibos historicos se alineo para esperar la defensa de dominio al borrar factura y conservar la restriccion FK para recibos con eventos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter "invoice.*deleted"` | RED inicial correcto: con items fallaba por FK y sin items la factura se borraba; luego OK: 2 tests pasan. |
| `docker compose exec backend php artisan test --filter InvoiceCreationTest` | OK: 31 tests pasan. |
| `docker compose exec backend php artisan test --filter InstitutionalReceiptSettingsMigrationTest` | OK: 4 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 427 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte refuerza la regla no negociable de no borrar facturas desde el codigo de aplicacion; el camino operativo sigue siendo anulacion/reverso auditado.

## 202. Fase 8 - Instalador conserva clave dedicada de respaldos

Cambio aplicado:

- `deploy_hospital_lan.ps1` ahora genera secretos con RNG criptografico y conserva `HOSPITAL_BACKUP_ENCRYPTION_KEY` si ya existe.
- El instalador escribe `HOSPITAL_BACKUP_ENCRYPTION_KEY` tanto en despliegue Docker como en instalacion local.
- `docker-compose.prod.yml` exige e inyecta la clave dedicada en backend, worker de backups y scheduler.
- `restore_hospital_windows.ps1` acepta respaldos `.sql.gz.enc` y mantiene compatibilidad con `.sql.enc`, `.sql` y `.tar.gz`.
- La documentacion de migracion y recuperacion de desastre apunta al formato nuevo `.sql.gz.enc` y reserva `APP_KEY` para respaldos legacy.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\deploy_hospital_lan.ps1 -SelfTest` | RED inicial correcto: faltaba `Get-EnvOrDefault`; luego OK: 36 checks pasan. |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -SelfTest` | RED inicial correcto: faltaba validar `.sql.gz.enc`; luego OK. |
| `docker compose -f docker-compose.prod.yml config` con variables dummy | OK: la clave aparece en los tres servicios Laravel. |
| Parser PowerShell para `deploy_hospital_lan.ps1` y `restore_hospital_windows.ps1` | OK: sin errores de sintaxis. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte alinea instalacion, runtime Docker, restore y documentacion con la clave dedicada de respaldos para evitar backups cifrados imposibles de generar o restaurar despues de una instalacion limpia.

## 203. Fase 8 - Estado de sistema verifica archivo fisico de backup

Cambio aplicado:

- `SystemStatusController` ahora expone si el ultimo backup exitoso existe fisicamente y si su SHA256 coincide con `backup_logs`.
- El check `BACKUP_WORKER_CONTINUOUS` ya no se valida solo por una fila reciente en `backup_logs`; tambien requiere archivo existente y checksum correcto.
- La prueba positiva de worker activo crea un archivo real `.sql.gz.enc` con checksum verificable.
- Se agrego regresion para backup reciente sin archivo fisico: el preflight queda en `manual_required`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter recent_successful_backup_without_physical_file` | RED inicial correcto: faltaba `last_success_file_exists`; luego OK dentro del filtro `recent_successful_backup`. |
| `docker compose exec backend php artisan test --filter "recent_successful_backup"` | OK: 2 tests pasan. |
| `docker compose exec backend php artisan test --filter SystemStatusTest` | OK: 20 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita que el panel de produccion declare sano el flujo de backups cuando solo existe el registro historico pero el archivo recuperable falta o fue alterado.

## 204. Fase 8 - UI advierte respaldo no confirmado

Cambio aplicado:

- `SystemStatus.backups` en TypeScript reconoce `last_success_file_exists` y `last_success_checksum_matches`.
- La vista de Respaldos muestra una alerta humana cuando el ultimo respaldo exitoso no se puede confirmar en el servidor local.
- El estado operativo de Respaldos pasa a error cuando el backend reporta respaldo reciente ausente o alterado.
- La alerta no expone nombres tecnicos de archivo ni jerga de checksum al operador.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- BackupsView.test.tsx -t "warns when the latest successful backup cannot be confirmed on disk"` | RED inicial correcto: no existia alerta visible; luego OK. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx` | OK: 25 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte convierte la verificacion backend de integridad de respaldos en una senal visible y accionable para la operacion monocomputadora.

## 205. Fase 8 - Soporte no marca backups no confirmados como protegidos

Cambio aplicado:

- `AboutView` marca el diagnostico de ultimo respaldo como `Revisar` cuando el backend reporta archivo ausente o no coincidente.
- `OperationalStatusSummary` muestra `Pendiente` y recomienda crear un respaldo nuevo si el ultimo respaldo no esta confirmado.
- Las superficies de soporte no exponen nombre tecnico de archivo ni jerga de checksum.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- AboutView.test.tsx -t "marks the latest backup diagnostic for review"` | RED inicial correcto: el diagnostico seguia mostrando fecha como OK; luego OK. |
| `docker compose exec frontend npm run test -- SupportCenterView.test.tsx -t "does not show an unconfirmed backup as protected"` | RED inicial correcto: el resumen seguia mostrando fecha protegida; luego OK. |
| `docker compose exec frontend npm run test -- AboutView.test.tsx SupportCenterView.test.tsx` | OK: 11 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita senales contradictorias entre Respaldos, Acerca de y Soporte cuando el backup recuperable no esta confirmado.

## 206. Fase 8 - Facturacion normaliza notas de items

Cambio aplicado:

- `CreateInvoiceAction` normaliza las notas de cada item antes de calcular y guardar snapshots de factura.
- Las notas con espacios al inicio o final se guardan recortadas.
- Las notas vacias o compuestas solo por espacios se guardan como `null`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter invoice_item_notes_are_trimmed_and_blank_notes_are_not_snapshotted` | RED inicial correcto: el servicio guardaba notas con espacios exactos; luego OK. |
| `docker compose exec backend php artisan test --filter InvoiceCreationTest` | OK: 32 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mantiene limpios los snapshots que luego alimentan recibos institucionales y reimpresiones historicas.

## 207. Fase 8 - Auditoria de anulacion pagada usa texto operativo correcto

Cambio aplicado:

- `VoidInvoiceAction` guarda en auditoria el mismo mensaje operativo en espanol que devuelve la API cuando se intenta anular una factura con pagos vigentes.
- La prueba de anulación pagada ahora valida que el mensaje almacenado en `audit_logs.new_values.message` sea legible para revision humana.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter void_paid_invoice_is_blocked_and_does_not_delete_payments_or_items` | RED inicial correcto: auditoria guardaba `reversion` sin acento; luego OK. |
| `docker compose exec backend php artisan test --filter InvoiceHistoryReprintVoidTest` | OK: 19 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora la calidad de auditoria sin cambiar reglas fiscales ni permitir anulaciones pagadas fuera del flujo de reversion.

## 208. Fase 8 - Reporte de hoy cuenta anulaciones por fecha de anulacion

Cambio aplicado:

- `TodayReportService` ahora calcula `voided_count` y `voided_amount` con la fecha `voided_at`.
- Las facturas emitidas en dias anteriores pero anuladas hoy aparecen en las anulaciones operativas del dia.
- Los conteos de facturas emitidas y montos facturados siguen usando `issued_at`, para no inflar ventas del dia con facturas viejas.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter today_report_counts_invoices_voided_today_even_when_issued_earlier` | RED inicial correcto: la anulacion de hoy no se contaba si la factura fue emitida ayer; luego OK. |
| `docker compose exec backend php artisan test --filter TodayReportTest` | OK: 9 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte hace mas util el reporte diario de caja/admin para revisar anulaciones hechas durante el turno real.

## 209. Fase 8 - Resumen ejecutivo cuenta anulaciones por fecha de anulacion

Cambio aplicado:

- `ExecutiveReportService` calcula `summary.voided_count`, `summary.voided_total` y `daily_trend.*.voided_count` usando `voided_at`.
- Una factura emitida en un dia anterior pero anulada dentro del rango ejecutivo aparece en anulaciones y no infla facturas emitidas ni facturacion del rango.
- La lista `voids_and_reversals` se mantiene alineada con el resumen operativo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter executive_summary_counts_invoices_voided_in_range_even_when_issued_earlier` | RED inicial correcto: el resumen ejecutivo no contaba la factura vieja anulada hoy; luego OK. |
| `docker compose exec backend php artisan test --filter ExecutiveReportTest` | OK: 11 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte alinea el reporte ejecutivo con la lectura operativa de anulaciones por turno/rango real de autorizacion.

## 210. Fase 8 - Reportes diario e ingreso cuentan anulaciones por fecha real

Cambio aplicado:

- `FinancialFactsService` calcula `total_voided` con `voided_at` en vez de la fecha de emision.
- `DailyReportService` mantiene facturas emitidas por `issued_at`, pero calcula el estado `void` por `voided_at`.
- `IncomeReportService` aplica la misma separacion para rangos, respetando filtros de usuario, caja, metodo, categoria, area y estado.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter daily_and_income_reports_count_voided_invoices_by_void_date` | RED inicial correcto: `total_voided` salia `0.00` para una factura emitida ayer y anulada hoy; luego OK. |
| `docker compose exec backend php artisan test --filter FinancialFactsReportTest` | OK: 5 tests pasan. |
| `docker compose exec backend php artisan test --filter "daily_report_calculates_collected_totals_methods_and_statuses_without_void_income|monthly_report_summarizes_financial_facts_by_day_without_void_income|income_report_respects_date_range_and_invalid_ranges_return_422"` | OK: 3 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte alinea reportes de cierre diario y de ingresos con el momento real de autorizacion de anulaciones, sin inflar ventas emitidas.

## 211. Fase 8 - Reporte mensual incluye anulaciones por fecha real

Cambio aplicado:

- `MonthlyReportService` calcula `invoices_by_status.void` con `voided_at`.
- Las fechas activas de `daily_totals` ahora incluyen dias con facturas anuladas aunque hayan sido emitidas fuera del mes.
- Las facturas emitidas fuera del mes pero anuladas dentro del mes no inflan `invoice_count` ni `total_billed`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter monthly_report_counts_invoices_voided_in_month_even_when_issued_earlier` | RED inicial correcto: el total mensual anulaba bien, pero `invoices_by_status.void` quedaba en 0; luego OK. |
| `docker compose exec backend php artisan test --filter "monthly_report_summarizes_financial_facts_by_day_without_void_income|monthly_report_counts_invoices_voided_in_month_even_when_issued_earlier"` | OK: 2 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte completa la alineacion de reportes mensuales con la fecha real de autorizacion de anulaciones.

## 212. Fase 8 - Reporte por area legacy usa columnas de centavos

Cambio aplicado:

- `AreaReportService` deja de recomputar centavos con `ROUND(... * 100)` y usa `payments.amount_cents` e `invoice_items.*_cents`.
- El guard `PaymentCentsSqlGuardTest` ahora incluye `AreaReportService` para evitar regresiones si vuelve a cablearse o reutilizarse.
- Se corrigio el fallback visible de area vacia a `Sin área`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter report_services_do_not_recompute_invoice_cents_via_sql` | RED inicial correcto: `AreaReportService` usaba `ROUND(invoice_items.quantity * 100)`; luego OK. |
| `docker compose exec backend php artisan test --filter PaymentCentsSqlGuardTest` | OK: 6 tests pasan. |
| `rg -n "ROUND\\(invoice_items\\.(quantity|line_total|line_subtotal|tax_amount) \\* 100|payments\\.amount\\)|payments\\.amount,|collected_total|NULLIF\\(invoices\\.total," backend\\app\\Actions\\Reports` | OK: sin patrones peligrosos de recomputo decimal en acciones de reportes. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK: 0 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M --no-progress` | OK: sin errores. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `docs/refactor-total-audit.md`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce riesgo de drift monetario en reportes de area aunque el servicio sea legacy/no cableado actualmente.

## 213. Fase 8 - Vistas Blade sin activos remotos

Cambio aplicado:

- Se removio la carga de Bunny Fonts del `welcome.blade.php` heredado de Laravel.
- Se agrego `OfflineRuntimeAssetsTest` para impedir que vistas Blade carguen CSS, scripts, imagenes o imports desde HTTP(S).
- La vista queda con fuentes de sistema/locales; no se agrega dependencia nueva ni servicio externo.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter OfflineRuntimeAssetsTest` | RED inicial correcto: detecto `https://fonts.bunny.net`; luego OK con 1 test y 16 assertions. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte refuerza la operacion offline LAN aun en vistas servidor heredadas o de fallback.

## 214. Fase 8 - Pago no imprime recibo legacy si falla recibo institucional

Cambio aplicado:

- `NewInvoiceView` deja de pedir el comprobante legacy cuando el backend registra el pago pero reporta error al emitir el recibo institucional.
- El flujo cierra el modal de cobro, conserva la factura pagada y muestra recuperacion explicita desde Historial antes de entregar comprobante.
- `InvoiceSuccess` acepta un mensaje de recuperacion y oculta el boton de imprimir recibo institucional cuando no existe recibo institucional emitido.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- NewInvoiceView -t "does not fall back"` | RED inicial correcto: llamaba `/api/invoices/61/receipt`; luego OK. |
| `docker compose exec frontend npm run test -- NewInvoiceView` | OK: 21 tests pasan. |
| `docker compose exec frontend npm run test -- InvoiceSuccess` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK: sin errores de whitespace; Git aviso normal de LF en `frontend/src/features/invoices/NewInvoiceView.test.tsx`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita que el formato secundario se use automaticamente como recibo principal cuando falla la emision institucional.

## 215. Fase 8 - Historial prioriza recuperacion de recibo institucional

Cambio aplicado:

- `InvoiceHistoryTable` oculta `Ver recibo` y `Reimprimir` legacy cuando la factura pagada no tiene recibo institucional y el usuario puede generar el PDF institucional faltante.
- El menu conserva `Generar PDF` como accion principal de recuperacion institucional desde Historial.
- Los fallbacks legacy siguen cubiertos para perfiles sin permiso de generacion institucional.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceHistoryView -t "does not offer legacy"` | RED inicial correcto: el menu aun mostraba `Ver recibo`; luego OK. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView` | OK: 35 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte alinea Historial con el flujo de pago: si falta el recibo principal, se recupera el institucional antes de entregar un comprobante.

## 216. Fase 8 - Filtro de respaldos fallidos usa lenguaje operativo

Cambio aplicado:

- `BackupHistoryTable` muestra el filtro de respaldos fallidos como `Fallidos` en vez de `Error`.
- El contrato interno del filtro se mantiene en `status: 'failed'` para no cambiar API ni backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- BackupsView -t "labels failed backup filters"` | RED inicial correcto: el boton visible decia `Error`; luego OK. |
| `docker compose exec frontend npm run test -- BackupsView` | OK: 26 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita que la pantalla de respaldos mezcle estados tecnicos con lenguaje operativo de caja/admin local.

## 217. Fase 8 - Checklist de impresion prioriza papel institucional

Cambio aplicado:

- `docs/manual-qa-checklist.md` deja de pedir Ticket 80/58 en el flujo normal de papel y copias.
- El checklist normal queda alineado con Carta, Media carta y A5 como formatos principales del recibo institucional.
- Se agrego un guard unitario para evitar que el checklist vuelva a exigir tickets termicos en la validacion normal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter ManualQaChecklistTest` | RED inicial correcto: la seccion normal contenia `Ticket 80 mm`; luego OK con 1 test y 8 assertions. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView -t "keeps thermal ticket compatibility"` | OK: confirma que la UI mantiene tickets termicos fuera del flujo institucional normal. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita que QA manual contradiga la regla del producto: carta/media carta/A5 son el recibo principal; tickets quedan como compatibilidad secundaria.

## 218. Fase 8 - Scripts de instalacion usan identidad S_Hospital

Cambio aplicado:

- Los banners, comentarios y descripciones de tareas PowerShell de instalacion/soporte dejan de mostrar el nombre interno heredado del producto.
- `pre-commit-guard.ps1` ahora bloquea scripts PowerShell que vuelvan a exponer ese nombre heredado.
- El autotest del instalador muestra `S_HOSPITAL` en su banner.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `scripts\pre-commit-guard.ps1` | RED inicial correcto: detecto 10 scripts con el nombre heredado; luego OK. |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test_installer_diagnostics.ps1` | OK: 16 checks del instalador pasan. |
| `Select-String -Path scripts\*.ps1,scripts\lib\*.ps1 -Pattern 'Hospital Billing OS' -SimpleMatch` | OK: 0 coincidencias en scripts PowerShell. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita que la instalacion local/offline entregue una identidad de producto distinta a S_Hospital.

## 219. Fase 8 - E2E de perfiles valida papel institucional normal

Cambio aplicado:

- `frontend/e2e/print-profiles.spec.ts` deja de esperar Ticket 80/58 como opciones visibles del flujo normal.
- El spec mantiene perfiles termicos en el mock y confirma que la UI normal solo expone Carta, Media carta y A5.
- El mismo E2E ahora valida copy operativo actual de margenes automaticos y ausencia de terminos tecnicos como fuente/layout o permisos internos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/print-profiles.spec.ts --workers=1 --reporter=list` | RED inicial correcto: esperaba `Ticket 80 mm`; luego OK con 1 test. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView -t "keeps thermal ticket compatibility"` | OK: 1 test focal pasa. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte alinea la prueba navegador con la regla actual: el recibo principal se configura en carta/media carta/A5; tickets son compatibilidad secundaria fuera del flujo normal.

## 220. Fase 8 - Realtime carga Echo/Pusher solo si esta habilitado

Cambio aplicado:

- `frontend/src/lib/realtime/echo.ts` deja de importar `laravel-echo` y `pusher-js` de forma estatica.
- `getEcho()` primero consulta `/api/system/echo-config`; si realtime esta deshabilitado, retorna `null` sin cargar los drivers.
- La prueba de realtime cuenta las cargas de modulo para evitar regresiones que vuelvan a cargar Echo/Pusher en sesiones LAN sin broadcasting, y cubre el camino positivo cuando el backend si lo habilita.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- echo.test.ts -t "returns null"` | RED inicial correcto: importaba `laravel-echo` aunque realtime estaba deshabilitado; luego OK. |
| `docker compose exec frontend npm run test -- echo.test.ts` | OK: 3 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce trabajo inicial en la version monocomputadora/LAN cuando broadcasting no se usa, sin remover compatibilidad con Echo/Pusher si se habilita.

## 221. Fase 8 - Polling LAN se pausa en pestanas ocultas

Cambio aplicado:

- Se agrego `getVisibleRefetchInterval()` para centralizar la regla de no refrescar en segundo plano cuando `document.visibilityState` no esta visible.
- Backups pendientes, salud del worker de backups, salud operativa, reporte de hoy y caja usan la misma regla.
- Al volver al foco se conservan los refrescos existentes (`refetchOnWindowFocus`) donde ya estaban configurados.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- useBackups.test.tsx -t "does not poll pending backups"` | RED inicial correcto: devolvia `5000` con la pestana oculta; luego OK. |
| `docker compose exec frontend npm run test -- useBackups.test.tsx` | OK: 11 tests pasan. |
| `docker compose exec frontend npm run test -- useServerStatus.test.tsx` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx` | OK: 13 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce trafico repetitivo en LAN cuando el navegador queda en segundo plano, sin perder actualizacion al volver a la ventana operativa.

## 222. Fase 8 - Caja renueva idempotencia si cambia el payload

Cambio aplicado:

- Las mutaciones de abrir y cerrar caja mantienen la misma `Idempotency-Key` cuando se reintenta exactamente el mismo payload fallido.
- Si el operador cambia el monto o notas despues de un fallo, se genera una clave nueva para evitar que el backend rechace una clave reutilizada con payload distinto.
- `CashBoxView` y los hooks de caja usan el mismo helper de idempotencia por firma de payload.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- useCashSession.test.tsx -t "renews the .*failed payload changes"` | RED inicial correcto: reutilizaba la clave anterior; luego OK. |
| `docker compose exec frontend npm run test -- useCashSession.test.tsx` | OK: 5 tests pasan. |
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx` | OK: 13 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita falsos rechazos durante reintentos reales de caja en LAN, sin debilitar la deduplicacion del backend.

## 223. Fase 8 - Pago con recibo emitido mantiene recuperacion visible

Cambio aplicado:

- Si el pago se registra y el recibo institucional se emite, pero el PDF no se abre, el modal de factura pagada muestra una advertencia visible.
- El flujo conserva el boton `Imprimir recibo institucional` para reintentar abrir el PDF, y mantiene la alternativa de reimprimir desde Historial.
- El frontend no cae al recibo legacy cuando el recibo institucional ya existe o cuando su emision falla.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- NewInvoiceView.test.tsx -t "keeps a visible retry path"` | RED inicial correcto: no habia advertencia visible; luego OK. |
| `docker compose exec frontend npm run test -- NewInvoiceView.test.tsx` | OK: 18 tests pasan. |
| `docker compose exec frontend npm run test -- InvoiceSuccess.test.tsx` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce ambiguedad operativa en caja: el pago queda registrado, el recibo institucional queda identificado y el cajero conserva un reintento visible sin entregar comprobantes secundarios.

## 224. Fase 8 - Cobro renueva idempotencia si cambia el payload

Cambio aplicado:

- El flujo de nueva factura usa idempotencia por firma de payload al emitir factura y registrar pagos.
- Si un cobro falla y el cajero reintenta el mismo payload, conserva la misma `Idempotency-Key`.
- Si el cajero corrige el monto, metodo o referencia antes de reintentar, genera una clave nueva para evitar rechazo por payload distinto.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- NewInvoiceView.test.tsx -t "renews the payment idempotency key"` | RED inicial correcto: el segundo intento reutilizaba `payment-attempt-1`; luego OK. |
| `docker compose exec frontend npm run test -- NewInvoiceView.test.tsx` | OK: 19 tests pasan. |
| `docker compose exec frontend npm run test -- useCashSession.test.tsx` | OK: 5 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce falsos bloqueos en caja durante reintentos reales de cobro, sin debilitar la deduplicacion de pagos ante doble clic o cortes de red.

## 225. Fase 8 - Reimpresion renueva idempotencia si cambia el recibo

Cambio aplicado:

- La reimpresion desde Historial conserva la misma `Idempotency-Key` al reintentar el mismo recibo institucional o legacy fallido.
- Si el operador cambia a otro recibo, factura, tamano o motivo despues de un fallo, el frontend genera una clave nueva.
- La impresion auditada desde vista de recibo usa la misma regla de firma de payload para evitar rechazos por claves reutilizadas con datos distintos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx -t "renews institutional reprint idempotency key"` | RED inicial correcto: el segundo recibo reutilizaba `history-institutional-reprint-attempt-1`; luego OK. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx` | OK: 36 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce falsos bloqueos durante reimpresiones reales desde Historial, manteniendo la deduplicacion para reintentos identicos.

## 226. Fase 8 - Anulacion y reversa renuevan idempotencia si cambia el motivo

Cambio aplicado:

- La anulacion desde Historial conserva la misma `Idempotency-Key` al reintentar el mismo motivo fallido.
- Si el operador corrige el motivo antes de reintentar la anulacion, el frontend genera una clave nueva.
- La reversa de pago aplica la misma regla por factura y motivo, evitando reutilizar claves con payload distinto.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx -t "renews (void|reverse) idempotency key"` | RED inicial correcto: el segundo intento reutilizaba la clave anterior; luego OK. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx` | OK: 38 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte evita falsos rechazos al corregir motivos de anulacion o reversa despues de un fallo, sin debilitar la deduplicacion de intentos identicos.

## 227. Fase 8 - Generacion de recibo renueva idempotencia si cambia la factura

Cambio aplicado:

- La generacion manual de recibo institucional faltante conserva la misma `Idempotency-Key` para reintentar la misma factura fallida.
- Si el operador intenta generar el recibo de otra factura despues de un fallo, el frontend genera una clave nueva.
- El `store` del recibo y la apertura del PDF siguen compartiendo la misma clave dentro del mismo intento exitoso.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx -t "renews receipt generation idempotency key"` | RED inicial correcto: la segunda factura reutilizaba `history-generate-receipt-attempt-1`; luego OK. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx` | OK: 39 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce bloqueos al recuperar recibos institucionales faltantes desde Historial, manteniendo deduplicacion para reintentos de la misma factura.

## 228. Fase 8 - Tendencia de reportes oculta fechas danadas

Cambio aplicado:

- `TrendChart` ya no muestra fechas crudas no interpretables en la tabla accesible ni en los datos del grafico.
- Cuando el backend entrega una fecha diaria danada, el reporte ejecutivo muestra `Fecha no disponible`.
- El formato normal de fechas validas del eje diario se conserva como `MM-DD`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- TrendChart.test.tsx -t "human fallback for malformed trend dates"` | RED inicial correcto: aparecia `fecha-danada`; luego OK. |
| `docker compose exec frontend npm run test -- TrendChart.test.tsx` | OK: 2 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/reports` | OK: 53 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora reportes ejecutivos utiles para operacion local, evitando que datos corruptos contaminen la vista normal o tecnologias de asistencia.

## 229. Fase 8 - Usuarios muestra rol faltante de forma explicita

Cambio aplicado:

- La tabla de usuarios autorizados ya no deja vacia la columna de rol cuando una cuenta llega sin roles asignados.
- El directorio muestra `Sin rol` con el mismo tratamiento visual de badges, evitando ambiguedad operativa al revisar accesos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- UsersTable.test.tsx -t "shows an explicit role fallback"` | RED inicial correcto: la celda de rol quedaba vacia; luego OK. |
| `docker compose exec frontend npm run test -- UsersTable.test.tsx` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin` | OK: 64 tests pasan; conserva una advertencia `act(...)` preexistente en `UserFormDialog.test.tsx`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora la revision local de usuarios y permisos, haciendo visible un estado excepcional sin cambiar la politica del servidor.

## 230. Fase 8 - Respaldos oculta tamanos corruptos

Cambio aplicado:

- El historial de respaldos locales muestra `Tamaño no disponible` cuando el tamano recibido no es finito o es negativo.
- La confirmacion de descarga usa el mismo fallback, evitando exponer `NaN` o `Infinity` al operador antes de descargar un respaldo.
- Los tamanos validos conservan el formato existente en B, KB y MB.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- BackupsView.test.tsx -t "treats malformed backup sizes"` | RED inicial correcto: no aparecia el fallback y el tamano corrupto se exponia; luego OK. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx` | OK: 27 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/backups` | OK: 30 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK; conserva aviso informativo de tiempos de plugin de Vite/Rolldown. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte endurece la pantalla de respaldos para operacion local, mostrando lenguaje seguro cuando los metadatos del archivo quedan incompletos o corruptos.

## 231. Fase 8 - Excel ejecutivo tolera numeros corruptos

Cambio aplicado:

- El exportador Excel ejecutivo ya no falla si un payload de reporte trae montos, cantidades, porcentajes o conteos no numericos.
- Los valores corruptos degradan a cero en el XLSX, manteniendo el archivo descargable para revision operativa.
- El escape de texto tipo formula se conserva independiente de la sanitizacion numerica.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_executive_excel_sanitizes_malformed_numeric_payloads` | RED inicial correcto: el exportador lanzaba `ValidationException`; luego OK con 21 aserciones. |
| `docker compose exec backend php artisan test --filter=ExecutiveExcelExportTest` | OK: 5 tests pasan, 64 aserciones. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 429 archivos. |
| `docker compose exec backend vendor/bin/phpstan analyse` | Incompleto por limite de memoria PHPStan 128M. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte protege reportes utiles para cierre y supervision local: un dato danado no debe impedir descargar el Excel ejecutivo completo.

## 232. Fase 6 - Papel normal guarda el perfil institucional

Cambio aplicado:

- Al guardar el flujo normal de recibos, el papel seleccionado se envia como perfil activo y predeterminado institucional.
- La UI sigue ocultando los controles tecnicos `Perfil activo` y `Predeterminado global` para usuarios sin modo soporte.
- Los campos manuales de margenes, tamano, fuente y escala permanecen fuera del flujo normal.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView.test.tsx --run` | RED inicial correcto: al elegir Carta se enviaba `is_global_default: false`; luego OK: 20 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings --run` | OK: 24 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte corrige la configuracion operativa de impresion: el hospital elige papel y el sistema resuelve internamente el perfil activo sin exponer controles tecnicos.

## 233. Fase 5/8 - Eritropoyetina conserva total fijo L.25

Cambio aplicado:

- El calculo backend trata cualquier servicio con regla `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` como no gravable, incluso si un dato historico o importado lo marcaba con ISV.
- La eritropoyetina sin receta se factura a L.25.00 total; con receta de dialisis sigue quedando gratis y auditada.
- El seeder del catalogo normaliza la eritropoyetina inicial como no gravable aunque el CSV heredado indique `taxable=si`.
- El formulario de catalogo apaga `Aplica ISV` al seleccionar la regla especial y envia `taxable: false`.
- Reportes, caja y recibos ajustan sus fixtures al nuevo total fijo, sin recalcular facturas historicas existentes.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=CalculateInvoiceTotalsActionTest::test_erythropoietin_fixed_price_is_not_taxed_without_dialysis_prescription` | RED inicial correcto: calculaba ISV L.3.75; luego OK. |
| `docker compose exec backend php artisan test --filter=InvoiceDialysisPrescriptionTest::test_erythropoietin_is_charged_when_dialysis_flag_absent` | RED inicial correcto: exponia tasa 15%; luego OK. |
| `docker compose exec frontend npm run test -- ServiceSheet.test.tsx -t "normalizes erythropoietin" --run` | RED inicial correcto: el checkbox de ISV seguia marcado; luego OK. |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest::test_service_catalog_seeder_loads_expected_categories_services_and_special_rule` | RED inicial correcto: el seeder dejaba EPO gravable; luego OK. |
| `docker compose exec backend php artisan test --filter=CalculateInvoiceTotalsActionTest` | OK: 12 tests pasan. |
| `docker compose exec backend php artisan test --filter=InvoiceCreationTest` | OK: 32 tests pasan. |
| `docker compose exec backend php artisan test --filter=InvoiceDialysisPrescriptionTest` | OK: 5 tests pasan. |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest` | OK: 35 tests pasan. |
| `docker compose exec backend php artisan test --filter=FinancialFactsReportTest` | OK: 5 tests pasan. |
| `docker compose exec backend php artisan test --filter=CashPaymentsReceiptTest` | OK: 32 tests pasan. |
| `docker compose exec backend php artisan test --filter=ReportsTest` | OK: 53 tests pasan. |
| `docker compose exec backend php artisan test --filter=ExecutiveReportTest` | OK: 11 tests pasan. |
| `docker compose exec backend php artisan test --filter=TodayReportTest` | OK: 9 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/catalog --run` | OK: 50 tests pasan. |
| `docker compose exec backend php artisan test` | Primer intento fallo por `ReportMoneyArchitectureTest`: `ExecutiveExcelExportService` contenia casts `(float)` heredados. Corregido; segundo intento OK: 793 tests pasan, 13 omitidos. |
| `docker compose exec backend php artisan test --filter=ReportMoneyArchitectureTest` | OK: 1 test pasa, 106 aserciones. |
| `docker compose exec backend php artisan test --filter=ExecutiveExcelExportTest` | OK: 5 tests pasan, 64 aserciones. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 429 archivos. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run test -- --run` | OK: 735 tests pasan; conserva advertencias `act(...)` preexistentes en tests frontend y un aviso de query mock indefinido. |
| `docker compose exec frontend npm run build` | OK; conserva aviso informativo de tiempos de plugin de Vite/Rolldown. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte blinda una regla fiscal/operativa critica: el medicamento cuesta L.25 total, no L.25 mas ISV, y la receta de dialisis mantiene el beneficio de L.0 con permiso y auditoria.
- Se elimino el cast `(float)` heredado del exportador Excel ejecutivo porque los reportes de cierre deben mantenerse sobre helpers cent-based y pasar el guard arquitectonico.

## 234. Fase 4/5 - Preview POS conserva eritropoyetina sin ISV

Cambio aplicado:

- La previsualizacion local de nueva factura ahora trata cualquier servicio con regla `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` como no gravable, incluso si datos viejos del catalogo llegan con `taxable: true`.
- La regla sigue siendo defensiva: el backend conserva la autoridad fiscal y de totales; el frontend solo evita mostrar un estimado inconsistente antes de emitir.
- No se tocaron migraciones, permisos, endpoints ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- posMath.test.ts -t "keeps erythropoietin fixed" --run` | RED inicial correcto: el preview calculaba ISV L.3.75; luego OK. |
| `docker compose exec frontend npm run test -- posMath.test.ts --run` | OK: 13 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/invoices --run` | OK: 138 tests pasan. |
| `docker compose exec frontend npm run test -- NewInvoiceView.test.tsx InvoiceCart.test.tsx InvoiceConfirmation.test.tsx --run` | OK: 31 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |
| `git diff --check` | OK; solo aviso de normalizacion CRLF/LF en esta documentacion. |
| `powershell -ExecutionPolicy Bypass -File scripts\pre-commit-guard.ps1` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte reduce confusion en caja: la cajera ve L.25.00 antes de cobrar y el backend sigue decidiendo el total final con la misma regla no gravable.

## 235. Fase 13/14 - Usuarios filtra permisos inoperables de restore

Cambio aplicado:

- La pantalla de usuarios sanea roles y catalogo de permisos recibidos desde la API antes de renderizar formularios, matriz o payloads.
- Si una instalacion heredada devuelve `backups.restore`, `receipts.void`, `users.assign_admin_role` o el marcador interno `system.exact_user_permissions`, esos permisos no se muestran como checkboxes ni se envian al crear/editar usuarios o roles.
- El backend conserva la barrera real: esos permisos ya estan ocultos del catalogo oficial y se rechazan si llegan por payload.
- No se tocaron migraciones, endpoints ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- UsersView.test.tsx -t "filters inoperable restore" --run` | RED inicial correcto: el formulario exponia `backups.restore`; luego OK. |
| `docker compose exec frontend npm run test -- UsersView.test.tsx --run` | OK: 28 tests pasan. |
| `docker compose exec frontend npm run test -- src/features/admin --run` | OK: 65 tests pasan; conserva advertencia `act(...)` preexistente en `UserFormDialog.test.tsx`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |
| `docker compose exec backend php artisan test --filter=UserManagementTest::test_user_editor_rejects_inoperable_permissions_hidden_from_catalog` | OK: 1 test pasa, 6 aserciones. |
| `git diff --check` | OK; solo aviso de normalizacion CRLF/LF en el test frontend. |
| `powershell -ExecutionPolicy Bypass -File scripts\pre-commit-guard.ps1` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mantiene la UI de usuarios enfocada en admin/cajero/roles operativos reales y evita que permisos de restauracion destructiva o marcadores internos reaparezcan por datos legados.

## 236. Fase 13/21 - QA usuarios sin advertencia act

Cambio aplicado:

- El test de `UserFormDialog` que valida bloqueo de campos durante guardado resuelve la promesa pendiente dentro de `act`.
- El paquete de pruebas de administracion deja de emitir la advertencia `An update to UserFormDialog inside a test was not wrapped in act(...)`.
- No se tocaron componentes de produccion, contratos API, permisos, endpoints ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- UserFormDialog.test.tsx -t "locks user identity" --run` | OK: 1 test pasa sin advertencia `act(...)`. |
| `docker compose exec frontend npm run test -- src/features/admin --run` | OK: 65 tests pasan sin advertencia `act(...)`. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |
| `git diff --check` | OK. |
| `powershell -ExecutionPolicy Bypass -File scripts\pre-commit-guard.ps1` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora la confiabilidad del gate de usuarios para la entrega monocomputadora: las advertencias de test ya no ocultan problemas reales en el flujo admin/cajero.

## 237. Fase 13/22 - QA reglas operativas sin advertencia act

Cambio aplicado:

- El test de `OperationalRulesView` que guarda reglas operativas ahora espera el estado visible de guardado antes de terminar.
- El paquete de pruebas de settings y configuracion de recibos deja de emitir la advertencia `An update to OperationalRulesView inside a test was not wrapped in act(...)`.
- No se tocaron componentes de produccion, contratos API, endpoints, permisos ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- OperationalRulesView.test.tsx -t "submits the toggled flags" --run` | OK: 1 test pasa sin advertencia `act(...)`. |
| `docker compose exec frontend npm run test -- src/features/settings src/features/receipt-settings --run` | OK: 41 tests pasan sin advertencia `act(...)`. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte limpia otro warning de QA en configuracion operativa, reduciendo ruido antes del cierre final de Vitest.

## 238. Fase 13/23 - Vitest completo sin advertencias act ni query

Cambio aplicado:

- `App.test.tsx` envuelve la activacion de tabs fiscales en `act`, evitando actualizaciones tardias de `FiscalSettingsView`/Radix al terminar el test.
- El test de ruta activa de reportes ahora mockea `/api/reports/executive` como error explicito del escenario en vez de dejar que el fallback devuelva `undefined`.
- No se tocaron componentes de produccion, rutas reales, contratos API, permisos ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- App.test.tsx -t "renders app shell and fiscal settings route" --run` | OK: 1 test pasa sin advertencia `act(...)`. |
| `docker compose exec frontend npm run test -- App.test.tsx -t "renders only the active module" --run` | OK: 1 test pasa sin advertencia TanStack Query. |
| `docker compose exec frontend npm run test -- App.test.tsx --run` | OK: 18 tests pasan sin stderr de `act(...)` ni query `undefined`. |
| `docker compose exec frontend npm run test -- --run` | OK: 112 archivos / 737 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte deja el gate completo de Vitest con evidencia fresca y sin las advertencias React/TanStack que quedaban registradas como higiene pendiente.

## 239. Fase 8/24 - Reverso protege recibo institucional emitido

Cambio aplicado:

- `InvoiceReverseTest` ahora cubre el caso de una factura pagada que ya tiene recibo institucional emitido antes del reverso consolidado.
- La prueba verifica que el reverso deja el recibo institucional en estado `void`, conserva el motivo auditado y registra `institutional_receipt.voided`.
- No se tocaron acciones, controladores, migraciones, rutas ni dependencias; la cobertura confirma el comportamiento existente via anulacion de pagos dentro del reverso.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=InvoiceReverseTest::test_reverse_paid_invoice_voids_issued_institutional_receipt_with_audit` | OK: 1 test pasa; la cobertura confirma el contrato existente. |
| `docker compose exec backend php artisan test --filter=InvoiceReverseTest` | OK: 9 tests / 51 aserciones. |
| `docker compose exec backend php artisan test --filter=InstitutionalReceiptPaymentIntegrationTest` | OK: 9 tests / 110 aserciones. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte refuerza una regla sensible de caja e impresion: si una factura cobrada se reversa, el recibo institucional asociado no queda vigente en historial.

## 240. Fase 13/24 - Smoke E2E critico estable para caja e historial

Cambio aplicado:

- El E2E de cierre de caja ahora valida el mensaje real de nota obligatoria con minimo de 5 caracteres cuando hay diferencia.
- El E2E de historial usa un usuario con alcance `invoices.operate_any` y una factura emitida sin sesion de caja para cubrir explicitamente la anulacion administrativa con motivo.
- No se tocaron componentes de produccion, rutas reales, contratos API, permisos backend ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts --workers=2` | OK: 2 tests pasan. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/new-invoice-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts e2e/backups-flow.spec.ts --workers=2` | OK: 4 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte estabiliza el smoke critico de navegador para facturacion, caja, historial/anulacion y backups sin debilitar reglas de negocio.

## 241. Fase 13/25 - Preflight claro para release E2E local

Cambio aplicado:

- `run-release-e2e.mjs` ahora valida antes de migrar que exista `backend/vendor/autoload.php` en el host que ejecuta `npm run e2e`.
- El fallo local por dependencias Composer ausentes deja de aparecer como fatal de PHP y ahora explica que se debe correr `composer install` en `backend/`.
- La guia del error aclara que no se deben copiar vendors desde contenedores como evidencia de release.
- No se tocaron flujos de producto, contratos API, migraciones, permisos ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx vitest run scripts/release-e2e-preflight.test.mjs --pool=forks --maxWorkers=1 --no-file-parallelism` | RED inicial por helper ausente; luego OK: 2 tests pasan. |
| `npm.cmd run e2e` | Falla esperado por preflight: falta `backend/vendor/autoload.php` en host y se muestra instruccion accionable. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte no cierra el release E2E host, pero convierte el bloqueo actual en evidencia operativa clara y evita perder tiempo depurando un fatal de autoload.

## 242. Fase 13/26 - Reporte button-smoke no puede quedar vacio

Cambio aplicado:

- La escritura de `button-smoke-report.json` se movio a un helper probado.
- El helper rechaza `results: []` para que un smoke sin evidencia no deje un artefacto que parezca valido.
- El mock admin de `all-buttons-smoke.spec.ts` ahora incluye `invoices.operate_any`, alineado con el flujo administrativo que abre la accion peligrosa `Reversar pago`.
- No se tocaron componentes de produccion, rutas reales, contratos API, permisos backend ni dependencias.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx vitest run scripts/button-smoke-report.test.mjs --pool=forks --maxWorkers=1 --no-file-parallelism` | OK: 2 tests pasan. |
| `docker compose exec frontend npx eslint e2e/all-buttons-smoke.spec.ts scripts/button-smoke-report.mjs scripts/button-smoke-report.test.mjs` | OK. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser -e E2E_BUTTON_SMOKE_REPORT_PATH=/tmp/button-smoke-dangerous.json frontend npx playwright test e2e/all-buttons-smoke.spec.ts --grep "dangerous history" --workers=1 --reporter=list` | RED inicial: no aparecia `Reversar pago`; luego OK: 1 test pasa y escribe reporte temporal no vacio. |

Decision:

- No se agregaron dependencias nuevas.
- Este corte mejora la confiabilidad de QA final: los reportes button-smoke vacios ahora fallan explicitamente en vez de convertirse en evidencia ambigua.

## 243. Fase 13/27 - Button-smoke completo escribe evidencia en repo

Cambio aplicado:

- `docker-compose.yml` ahora construye una imagen frontend local con Chromium instalado en vez de depender de un `apk add` manual dentro del contenedor.
- El servicio frontend monta `./qa:/qa`, de modo que el path por defecto del smoke de botones escribe evidencia real en `qa/production-audit/button-smoke-report.json`.
- El entorno del servicio declara `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser`, evitando repetir la variable en cada comando containerizado.
- Se regenero el reporte button-smoke con 79 resultados `passed`.
- No se tocaron flujos de producto, contratos API, permisos backend ni dependencias de runtime de produccion.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose config --quiet` | OK. |
| `docker compose build frontend` | OK: imagen local construida con Chromium. |
| `docker compose up -d frontend` | OK: servicio recreado con montaje `./qa:/qa`. |
| `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 frontend npx playwright test e2e/all-buttons-smoke.spec.ts --workers=1 --reporter=list` | OK: 7 tests pasan en 4.7m. |
| Lectura de `qa/production-audit/button-smoke-report.json` | OK: 79 resultados, 0 fallos. |

Decision:

- No se agregaron dependencias nuevas al runtime hospitalario; Chromium queda en la imagen local de QA/frontend para pruebas Playwright.
- Este corte cierra evidencia fresca del smoke de botones: controles nombrados, axe serio/critico y cancelacion de accion peligrosa en historial.

## 244. Fase 13/28 - Composer audit validado en contenedor backend

Cambio aplicado:

- Se ejecuto `composer validate` dentro del contenedor backend soportado por el proyecto.
- Se ejecuto `composer audit --no-interaction` dentro del mismo contenedor.
- El bloqueo historico de "Composer no instalado en PATH del host" queda reemplazado por evidencia containerizada valida.
- No se tocaron archivos de aplicacion, dependencias, lockfiles, contratos API, migraciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend composer validate --no-interaction` | OK: `./composer.json is valid`. |
| `docker compose exec backend composer audit --no-interaction` | OK: `No security vulnerability advisories found.` |

Decision:

- Composer sigue sin requerirse en PATH del host Windows para esta evidencia; el entorno soportado es el contenedor backend.
- Este corte reduce un bloqueante de release sin declarar `PRODUCTION_READY`: todavia faltan audit npm vigente, E2E host o equivalente final, evidencias fisicas y cierre de worktree.

## 245. Fase 13/29 - npm audit limpio en contenedor frontend

Cambio aplicado:

- Se ejecuto `npm audit --audit-level=high --json` dentro del contenedor frontend soportado.
- La auditoria actual reporta 0 vulnerabilidades totales.
- No se tocaron archivos de aplicacion, dependencias, lockfiles, contratos API, migraciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm audit --audit-level=high --json` | OK: `high=0`, `critical=0`, `total=0`. |

Decision:

- `npm audit` deja de ser bloqueante en el entorno frontend containerizado.
- El proyecto sigue `NOT_READY`: todavia faltan E2E host o equivalente final, cierre del worktree, evidencias fisicas y paquete offline final.

## 246. Fase 13/30 - Gate QA final enfocado del nucleo hospitalario

Cambio aplicado:

- Se ejecuto un gate frontend fresco en Docker: TypeScript, lint y build de produccion.
- Se ejecuto un gate backend enfocado en los modulos obligatorios monocomputadora: facturacion, caja/cobros, recibos, historial/reimpresion/anulacion/reverso, catalogo, respaldos, usuarios y reportes.
- No se tocaron archivos de aplicacion, dependencias, lockfiles, contratos API, migraciones ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run build` | OK. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php tests/Feature/CashPaymentsReceiptTest.php tests/Feature/InvoiceHistoryReprintVoidTest.php tests/Feature/InvoiceReverseTest.php tests/Feature/ServiceCatalogTest.php tests/Feature/BackupWorkflowTest.php tests/Feature/UserManagementTest.php tests/Feature/ReportsTest.php tests/Feature/Reports/TodayReportTest.php` | OK: 254 tests / 2032 aserciones. |

Decision:

- Este corte refuerza la evidencia del nucleo operativo real: nueva factura, cobrar, imprimir/reimprimir, anular/reversar, cerrar caja con diferencia, catalogo/eritropoyetina, respaldos, usuarios basicos y reportes.
- El proyecto sigue `NOT_READY`: faltan E2E host o equivalente final, cierre del worktree, evidencias fisicas LAN/impresora/restore/worker y paquete offline final.

## 247. Fase 7/14 - Caja local monocomputadora con una sola apertura

Cambio aplicado:

- `OpenCashSessionAction` dejo de permitir una caja abierta por cajero y ahora valida una sola caja abierta global para la terminal local.
- La apertura usa un lock nombrado de MySQL/MariaDB (`GET_LOCK`/`RELEASE_LOCK`) antes de la transaccion para serializar aperturas simultaneas entre usuarios distintos.
- El mensaje funcional de backend queda orientado al operador: si ya existe una caja abierta, se debe cerrar la caja actual antes de abrir otra.
- Las pruebas que necesitan sesiones historicas o fixtures cruzados crean fixtures explicitos, sin pasar por el endpoint operativo de apertura.
- No se agregaron migraciones, dependencias ni cambios de schema.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php --filter='cashier_can_open_cash_session|only_one_cash_session|another_cashier_can_open'` | RED inicial confirmado para segunda caja global; luego OK: 3 tests pasan. |
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php tests/Unit/OpenCashSessionActionConcurrencyTest.php tests/Feature/Payments/RegisterPaymentDoesNotMutateInvoiceTest.php` | OK: 39 tests / 389 aserciones. |
| `docker compose exec backend php artisan test tests/Feature/Reports/TodayReportTest.php tests/Feature/Reports/ExecutiveReportTest.php` | OK: 20 tests / 246 aserciones. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter='cash_session|managerial_reports|CashSession'` | OK: 8 tests / 103 aserciones. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceReverseTest.php tests/Feature/InvoiceHistoryReprintVoidTest.php` | OK: 29 tests / 175 aserciones. |
| `docker compose exec backend php artisan test tests/Feature/Resilience/IdempotencyKeyTest.php tests/Feature/Resilience/DoublePaymentTest.php` | OK: 18 tests / 139 aserciones. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: sin errores. |

Decision:

- Para la entrega monocomputadora, la caja se trata como gaveta local unica. Esto reduce confusion operativa y evita turnos abiertos paralelos en la misma instalacion.
- El proyecto conserva pruebas de escenarios historicos/cross-session donde hacen falta para reportes y pagos, pero esos escenarios ya no usan el endpoint normal de apertura.

## 248. Fase 14 - Auditoria de desactivacion de usuario exige motivo

Cambio aplicado:

- `InternalControlAuditTest` ahora envia motivo al desactivar un usuario y verifica que `user.deactivated` lo audite.
- No se tocaron controladores, requests, permisos, rutas ni migraciones; el test quedo alineado al contrato actual de seguridad.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/InternalControlAuditTest.php` | RED por motivo faltante; luego OK: 7 tests / 53 aserciones. |
| `docker compose exec backend vendor/bin/pint --test --dirty` | OK. |

Decision:

- Este corte mantiene coherencia con la regla de seguridad: acciones privilegiadas/destructivas deben dejar motivo auditable.

## 249. Fase 7/16 - Mensaje claro cuando otra caja local ya esta abierta

Cambio aplicado:

- El frontend mapea los errores de validacion `cash_session` a la etiqueta humana `Caja`, sin exponer el nombre tecnico del campo.
- `CashBoxView` cubre el caso donde la apertura falla porque ya existe una caja abierta: muestra alerta clara, conserva el formulario cerrado y no marca la caja como abierta.
- No se agregaron dependencias ni cambios de API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- CashBoxView base.test` | RED inicial por etiqueta `cash session`; luego OK: 2 archivos / 47 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- El bloqueo global de caja ya no queda como error tecnico ni mensaje ambiguo. La cajera ve una causa accionable en lenguaje operativo.

## 250. Fase 12/14 - Respaldos no exponen nombre tecnico en API normal

Cambio aplicado:

- `GET /api/backups` y `POST /api/backups` dejaron de incluir `filename` en el payload normal de operador.
- El backend conserva `filename`, `path`, `disk`, `size_bytes` y `checksum_sha256` internamente para integridad, descarga y auditoria, pero el listado normal solo entrega datos operativos.
- El contrato TypeScript `BackupLog` se actualizo para reflejar que el nombre tecnico del archivo no forma parte de la UI/API normal.
- No se agregaron migraciones, dependencias ni cambios de permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/BackupWorkflowTest.php --filter='list_backups_without_exposing_internal_file_details|filter_backups_by_status'` | RED inicial por `filename` presente; luego OK: 2 tests / 11 aserciones. |
| `docker compose exec backend php artisan test tests/Feature/BackupWorkflowTest.php` | OK: 28 tests / 146 aserciones. |
| `docker compose exec frontend npm run test -- BackupsView useBackups backups.test` | OK: 3 archivos / 43 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- La pantalla ya ocultaba el nombre tecnico, pero el API normal todavia lo entregaba. Este corte reduce exposicion innecesaria para una instalacion hospitalaria local sin afectar descarga auditada.

## 251. Fase 6 - Papel normal guarda default aunque exista soporte avanzado

Cambio aplicado:

- `InstitutionalReceiptSettingsView` deja de usar el permiso `receipt_settings.advanced` como criterio para enviar `active` e `is_global_default` desde el flujo normal de papel.
- Los perfiles institucionales principales (`Carta`, `Media carta`, `A5`) siempre se guardan como activos y predeterminados cuando se usa `Guardar perfil` en el flujo normal.
- Los perfiles de soporte tecnico conservan sus banderas tecnicas solo cuando se seleccionan desde el modo soporte.
- No se agregaron dependencias, migraciones, permisos ni cambios de API.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run -t "saves a standard paper profile as the institutional default for support users in the normal flow"` | RED inicial por `is_global_default: false`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run` | OK: 22 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- El permiso de soporte permite abrir controles tecnicos, pero no debe debilitar el flujo operativo normal. El hospital sigue eligiendo papel; el sistema activa el perfil institucional correspondiente.

## 252. Fase 6 - Impresion de prueba respeta perfil de soporte

Cambio aplicado:

- `Imprimir prueba` ahora usa el `code` del perfil seleccionado en la pantalla, no el papel normal previo.
- Si soporte selecciona `Recibo pequeno personalizado`, la prueba pide PDF con `profile_code: recibo_pequeno_personalizado`.
- `docs/print-profiles.md` se actualizo para reflejar el endpoint actual, el selector normal de Carta/Media carta/A5 y el comportamiento de prueba con perfil seleccionado.
- No se agregaron dependencias, migraciones, permisos ni cambios de endpoint.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run -t "generates a test print with the selected support profile"` | RED inicial por `profile_code: media_carta_horizontal`; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run` | OK: 23 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- La impresion de prueba debe probar exactamente el perfil que el usuario esta configurando. Esto evita falsos positivos de soporte cuando el PDF se genera con otro formato.

## 253. Fase 12/20 - E2E visual de respaldos usa contrato actual

Cambio aplicado:

- `frontend/e2e/rc-backup-screen.spec.ts` deja de depender de login manual parcial y usa una sesion mockeada con permisos de respaldos.
- El mock de `/api/backups` usa el contrato paginado actual (`data: []`, `meta`) y no entrega `filename`, `checksum_sha256`, rutas ni datos tecnicos.
- El spec ahora afirma que se muestra una fila operativa con usuario responsable y que no aparecen nombres internos de archivo ni detalles sensibles.
- No se agregaron dependencias, migraciones, permisos ni cambios de backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx playwright test e2e/rc-backup-screen.spec.ts --workers=1 --reporter=list` | RED inicial por spec/login/mock viejo; luego OK: 1 test pasa. |
| `docker compose exec frontend npx playwright test e2e/backups-flow.spec.ts --workers=1 --reporter=list` | OK: 1 test pasa. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- La captura visual de respaldos vuelve a validar la regla actual: la vista normal muestra informacion operativa y oculta nombres tecnicos del archivo de respaldo.

## 254. Fase 10/14 - Auditoria de reportes exige permiso audit.view en UI

Cambio aplicado:

- `useHospitalSession` deriva `canViewAuditReports` desde `audit.view`.
- `AppRoutes` pasa ese permiso explicito a `ReportsView`.
- `ReportsView` ya no muestra la subruta `Auditoria` solo por tener `reports.managerial.view`; si se solicita `/reports/audit` sin `audit.view`, cae a Caja si esta permitida o a Ejecutivo.
- `audit.view` tambien permite entrar a Reportes y abre Auditoria desde `/reports` cuando es el unico reporte disponible.
- No se agregaron dependencias, migraciones, permisos ni cambios de endpoint.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- ReportsView.subroutes --run -t "hides the audit report"` | RED inicial por enlace `Auditoria` visible; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ReportsView.subroutes --run -t "opens audit from root"` | RED inicial por Auditoria visible pero no activa; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ReportsView.subroutes ReportsAudit --run` | OK: 2 archivos / 17 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- La navegacion de reportes queda alineada con la autorizacion real del backend: datos de auditoria requieren `audit.view`, no solo reportes gerenciales.

## 255. Fase 8/14 - Desactivar servicio exige motivo desde catalogo

Cambio aplicado:

- `CatalogView` usa el motivo obligatorio del `ConfirmDialog` al desactivar un servicio activo.
- El payload frontend agrega `availability_change_reason`, alineado con la validacion backend para cambios de `active`, `visible_in_billing` o `is_billable`.
- `ServicePayload` tipa `availability_change_reason`.
- No se agregaron dependencias, migraciones, permisos ni cambios de endpoint.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- CatalogView --run -t "requires confirmation"` | RED inicial por boton habilitado sin motivo; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- CatalogView --run` | OK: 19 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- El operador ya no puede mandar una desactivacion que el backend rechazaria por falta de motivo. La razon queda disponible para auditoria de catalogo.

## 256. Fase 8 - Eritropoyetina bloquea regla/precio/ISV en edicion

Cambio aplicado:

- `ServiceSheet` bloquea precio, regla especial e ISV cuando se edita un servicio existente con regla `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`.
- La creacion sigue usable: al seleccionar la regla se normaliza el precio a L.25.00 y `taxable=false`, pero el usuario aun puede corregir la seleccion antes de guardar.
- El drawer muestra copy operativo que recuerda que la eritropoyetina mantiene precio fijo, sin ISV, y que el descuento por receta de dialisis se aplica al facturar.
- No se agregaron dependencias, migraciones, permisos ni cambios de endpoint.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- ServiceSheet --run -t "locks erythropoietin"` | RED inicial por precio editable; luego OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- ServiceSheet --run` | OK: 18 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- El catalogo evita cambios accidentales sobre campos regulados de eritropoyetina sin convertir la UI en fuente fiscal. El backend sigue siendo la autoridad para totales, precios historicos y regla aplicada al facturar.

## 257. Fase 8/20 - E2E de catalogo valida desactivacion por PATCH con motivo

Cambio aplicado:

- `frontend/e2e/catalog-flow.spec.ts` deja de tratar `DELETE /api/services/:id` como exito de desactivacion.
- El mock E2E captura el payload de `PATCH /api/services/:id`, responde con el servicio actualizado y deja `DELETE` como ruta inesperada con 405.
- El flujo E2E llena el motivo obligatorio y afirma `active: false` junto con `availability_change_reason`.
- Se reinicio el servicio `frontend` del compose antes de repetir Playwright porque habia un Vite previo sirviendo bundle viejo en `127.0.0.1:5173`.
- No se agregaron dependencias, migraciones, permisos ni cambios de endpoint.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx playwright test e2e/catalog-flow.spec.ts --workers=1 --reporter=list` | RED inicial por esperar DELETE; luego RED por bundle viejo sin textarea; despues de `docker compose restart frontend`, OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx --run -t "requires confirmation"` | OK: 1 test pasa. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx --run` | OK: 19 tests pasan. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

Decision:

- El E2E vuelve a cubrir la regla de negocio actual: desactivar un servicio no borra registros, exige motivo y usa el mismo contrato PATCH que valida/audita el backend.

## 258. Fase 10/14 - Exports de reportes ocultan auditoria sin audit.view

Cambio aplicado:

- `ReportController` marca los datos operativos exportados con `can_view_audit` y redacta anulaciones, reimpresiones, cambios de catalogo, reversos de pago y respaldos cuando el usuario no tiene `audit.view`.
- `PremiumExcelExportService` conserva la hoja `Cajeros`, pero no crea la hoja `Auditoria` sin permiso de auditoria.
- `PdfExportService` conserva el detalle operativo/servicios, pero omite el resumen y detalle de auditoria operativa sin `audit.view`.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_report_export_without_audit_view_omits_audit_sheet_but_keeps_cashier_summary` | RED inicial por hoja `Auditoria` visible; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=test_period_closure_pdf_without_audit_view_omits_operational_audit_section` | RED inicial por seccion `Resumen de Auditoria`; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=ReportsTest` | OK: 55 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | RED inicial por formato; luego OK despues de `vendor/bin/pint ...`. |
| `docker compose exec backend vendor/bin/phpstan analyse` | Primer intento incompleto por limite de memoria 128M. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- Los exports gerenciales siguen funcionando para usuarios con `reports.export`, pero los datos auditados quedan bajo el mismo permiso `audit.view` que protege `/api/reports/operations`.

## 259. Fase 10/14 - Reporte ejecutivo redacciona auditoria sin audit.view

Cambio aplicado:

- `ExecutiveReportService` agrega `can_view_audit` y vacia `voids_and_reversals`/`audit_summary` cuando el solicitante no tiene `audit.view`.
- `ExecutivePdfExportService` omite las secciones `Anulaciones y Reversas` y `Resumen de Auditoria` si el payload viene sin permiso.
- `ExecutiveExcelExportService` conserva hojas ejecutivas/financieras, pero no crea `Anulaciones y reversas` ni `Auditoria` sin permiso.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_executive_without_audit_view_redacts_audit_details` | RED inicial por falta de `can_view_audit`; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=test_executive_pdf_without_audit_view_omits_audit_sections` | RED inicial por secciones auditadas visibles; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test --filter=test_executive_excel_without_audit_view_omits_audit_sheets` | RED inicial por hojas auditadas visibles; luego OK: 1 test pasa. |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php tests/Feature/Reports/ExecutivePdfExportTest.php tests/Feature/Reports/ExecutiveExcelExportTest.php` | OK: 24 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: sin errores. |

Decision:

- Los KPIs ejecutivos agregados permanecen disponibles para supervision gerencial, pero las filas y resumen de auditoria quedan reservados para `audit.view`.

## 260. Fase 6/20 - E2E de perfiles normales guarda e imprime prueba

Cambio aplicado:

- `frontend/e2e/print-profiles.spec.ts` cubre el flujo normal de A5: seleccion de papel, `Imprimir prueba` y `Guardar perfil`.
- El test captura el payload de `test-print` y confirma `profile_code: a5_horizontal` junto con datos de prueba seguros.
- El test captura el `PATCH /api/settings/institutional-receipts/print-profiles/2` y confirma que el flujo normal envia campos operativos, pero no envia margenes, ancho, alto, orientacion, fuente, escala ni campos tecnicos.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npx playwright test e2e/print-profiles.spec.ts` | OK: 2 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- La suite E2E ahora protege que el operador normal siga eligiendo solo el papel y acciones operativas; la configuracion tecnica queda fuera del payload normal.

## 261. Fase 5 - useCreateInvoice renueva idempotencia si cambia payload

Cambio aplicado:

- `useCreateInvoice` usa `payloadScopedIdempotencyKey` para conservar la misma clave en reintentos del mismo payload fallido y generar una nueva clave cuando el payload cambia.
- El hook limpia clave y firma solo despues de exito confirmado.
- `useInvoices.test.tsx` agrega cobertura roja/verde para el cambio de paciente despues de un fallo de red.
- Los mocks del archivo se aislan con `vi.resetAllMocks()` para evitar colas de claves entre tests.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- useInvoices.test.tsx` | RED inicial por segunda llamada con `invoice-attempt-1`; luego OK: 4 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check -- frontend/src/hooks/useInvoices.ts frontend/src/hooks/useInvoices.test.tsx` | OK. |

Decision:

- Un reintento recuperable conserva deduplicacion, pero si el operador corrige la factura despues del fallo, el frontend no presenta el nuevo intento como la misma emision logica.

## 262. Fase 11/14 - Numeracion fiscal exige motivo antes de guardar

Cambio aplicado:

- `FiscalNumerationView` muestra `Motivo del cambio fiscal` cuando se edita una secuencia existente.
- El formulario bloquea el envio si el motivo tiene menos de 5 caracteres y muestra error accesible antes de llamar al API.
- El payload de `saveFiscalSequence` incluye `reason` en actualizaciones, alineado con `UpdateFiscalSequenceRequest`.
- `FiscalSequence` admite `reason` opcional como campo de escritura.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- FiscalNumerationView --run` | RED inicial por falta de campo/mensaje de motivo; luego OK: 4 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- El backend seguia siendo la defensa final, pero la UI ya no invita al operador a enviar cambios fiscales que serian rechazados por falta de motivo auditado.

## 263. Fase 12/16 - Ayuda no presenta restore como operacion normal

Cambio aplicado:

- `HelpView` deja de describir restauraciones como tarea cotidiana del administrador.
- La guia mantiene recuperacion de datos como proceso coordinado con soporte desde el servidor local.
- El modo practica evita hablar de ensayar restauraciones sobre produccion y usa lenguaje de recuperacion de datos.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- HelpView --run` | RED inicial porque la ayuda no tenia el copy de soporte y aun mostraba `respaldos y restauraciones`; luego OK: 1 test pasa. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- La UI normal puede orientar sobre respaldos y recuperacion, pero no debe sugerir que la restauracion se ejecuta desde la app ni como tarea operativa diaria.

## 264. Fase 4/20 - E2E critico de nueva factura verificado

Verificacion ejecutada:

| Comando | Resultado |
|---|---|
| `npx playwright test e2e/new-invoice-flow.spec.ts --workers=1 --reporter=list` | OK: 1 test pasa en Chromium. |

Cobertura observada:

- El spec mockeado emite una factura desde una caja abierta.
- Valida el payload de creacion de factura y el payload de pago registrado.
- Mantiene evidencia focalizada del flujo principal factura -> pago mientras la suite E2E completa sigue pendiente para QA final.

Decision:

- Esta verificacion reduce riesgo del core obligatorio, pero no sustituye el E2E completo ni la prueba fisica de impresion/caja del servidor final.

## 265. Fase 4/6 - Factura cero emite recibo institucional

Cambio aplicado:

- `NewInvoiceView` deja de abrir el recibo legacy para facturas pagadas con total `0.00`.
- El flujo de factura cero crea un recibo institucional con `institutionalReceipts.store`, usando idempotencia ligada al payload `{ invoice_id, cash_session_id }`.
- Si el PDF institucional abre correctamente, el dialogo de exito conserva el boton de reimpresion institucional.
- Si falla la emision o apertura del PDF, la factura queda emitida y se muestra una ruta recuperable para generar/reimprimir desde Historial, sin exponer comprobante legacy.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView --run -t "issues an institutional receipt for a paid zero-total invoice"` | RED inicial porque no se llamaba `/api/institutional-receipts`; luego OK. |
| `npm run test -- NewInvoiceView --run` | OK: 25 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- Las facturas en cero, incluyendo escenarios como eritropoyetina cubierta por receta de dialisis, siguen el mismo comprobante institucional que los cobros normales y no pueden imprimirse por el recibo secundario/legacy desde el flujo principal.

## 266. Fase 12 - Estado de respaldos automaticos visible

Cambio aplicado:

- `SystemStatus` frontend reconoce `backups.queue.scheduler_heartbeat`, que ya es entregado por el backend.
- `BackupsView` resume el estado de respaldos automaticos en la card normal de estado operativo con lenguaje humano.
- El detalle de soporte conserva informacion operativa ampliada, pero la vista principal no expone el termino tecnico `scheduler`.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView --run -t "shows automatic backup heartbeat status"` | RED inicial porque el estado solo aparecia dentro del detalle colapsado; luego OK. |
| `npm run test -- BackupsView --run` | OK: 32 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- El operador puede detectar si los respaldos automaticos nunca se han ejecutado o requieren revision sin abrir soporte ni leer nombres de procesos del servidor.

## 267. Fase 10/14 - Auditoria no solicita resumen ejecutivo sin permiso

Cambio aplicado:

- `ReportsAudit` separa el permiso para ver bitacora de auditoria del permiso para solicitar el resumen ejecutivo mensual.
- `ReportsView` pasa `canViewManagerial` como autorizacion del resumen ejecutivo y mantiene `audit.view` solo para la bitacora.
- Usuarios con `audit.view` pueden abrir auditoria sin disparar una llamada a `getExecutiveReport` que el backend puede rechazar por falta de permiso gerencial.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsAudit --run -t "does not fetch the executive summary"` | RED inicial porque auditoria llamaba `getExecutiveReport`; luego OK. |
| `npm run test -- ReportsAudit --run` | OK: 8 tests pasan. |
| `npm run test -- ReportsView.subroutes --run` | OK: 10 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- El frontend ya no usa un permiso parcial de auditoria como sustituto de permisos gerenciales; el backend sigue siendo la defensa final para el endpoint ejecutivo.

## 268. Fase 10/14 - Reporte de caja no lista sesiones sin permiso de caja

Cambio aplicado:

- `ReportsCash` separa el permiso para consultar reportes de caja del permiso para listar cajas recientes.
- `AppRoutes` pasa `canViewCash` como autorizacion para el listado de sesiones recientes.
- Usuarios con `reports.cash_session.view` sin `cash.view` pueden ingresar manualmente el numero de caja y consultar el reporte sin llamar `getCashSessions`.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsCash --run -t "does not list recent cash sessions"` | RED inicial porque el permiso de reporte llamaba `getCashSessions`; luego OK. |
| `npm run test -- ReportsCash --run` | OK: 7 tests pasan. |
| `npm run test -- ReportsView.subroutes --run` | OK: 10 tests pasan. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- La UI evita un 403 evitable en el listado de cajas recientes y conserva el flujo manual de reporte para usuarios con permiso especifico de reportes.

## 269. Fase 11/14 - Reglas operativas usan permiso separado

Cambio aplicado:

- Se agrega el permiso `settings.operational.update` al seeder de roles y permisos.
- `PUT /api/settings/operational` deja de exigir `settings.fiscal.update` y valida el permiso operativo separado.
- Un usuario con permiso operativo puede cambiar `scanner_enabled` y `partial_payments_enabled` sin poder modificar datos fiscales.
- `FiscalSettingsView` recibe `canEditOperationalRules` y habilita solo la pestana Operativa cuando no existe permiso fiscal de escritura.
- No se agregaron migraciones, dependencias ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_operational_settings_update_uses_operational_permission_not_fiscal_update` | RED inicial porque el permiso no existia; luego OK. |
| `npm run test -- FiscalSettingsView --run -t "allows editing only operational rules"` | RED inicial porque la UI seguia usando `canEdit` fiscal global; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 21 tests pasan. |
| `npm run test -- FiscalSettingsView --run` | OK: 5 tests pasan. |
| `npm run test -- OperationalRulesView --run` | OK: 4 tests pasan. |
| `npm run test -- App --run` | OK: 41 tests pasan en 7 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 429 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

Decision:

- La configuracion operativa queda separada de la fiscal sin relajar la defensa backend: editar scanner/abonos ya no requiere conceder permisos fiscales completos.

## 270. Fase 13/14 - Permiso operativo clasificado como sensible

Cambio aplicado:

- `settings.operational.update` se marca como permiso critico en los formularios de roles.
- `RoleCatalog` lo trata como permiso elevado para bloquear creacion o promocion de roles sensibles sin autorizacion de admin.
- No se agregaron migraciones, dependencias, permisos ni endpoints adicionales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- RoleFormDialog --run -t "operational settings updates"` | RED inicial porque el permiso no mostraba etiqueta critica; luego OK. |
| `docker compose exec backend php artisan test tests/Unit/RoleCatalogTest.php` | RED inicial porque el permiso no era elevado; luego OK. |
| `npm run test -- RoleFormDialog --run` | OK: 13 tests pasan. |
| `docker compose exec backend php artisan test --filter=test_user_manager_without_admin_assignment_permission_cannot_create_elevated_operational_roles` | OK. |
| `docker compose exec backend php artisan test --filter=test_user_manager_without_admin_assignment_permission_cannot_promote_user_to_elevated_operational_role` | OK. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

Decision:

- Cambiar reglas operativas afecta caja/facturacion, por lo que el permiso separado no queda como permiso administrativo liviano.

## 271. Fase 13 - Catalogo de permisos usa etiquetas humanas para configuracion operativa

Cambio aplicado:

- `RoleController` agrega etiquetas humanas para modulos administrativos visibles en el catalogo de permisos.
- `settings.operational.update` se muestra como `Editar reglas operativas` dentro de `Configuracion`.
- El nombre tecnico del permiso se conserva en `name` para RBAC, auditoria y contratos API.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_permission_catalog_labels_operational_settings_as_human_configuration_rule` | RED inicial porque el modulo salia como `Settings`; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/RoleManagementTest.php` | OK: 10 tests pasan. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

Decision:

- La separacion de permisos operativos ahora llega hasta la administracion de roles con lenguaje claro para el hospital, sin esconder el identificador tecnico necesario para soporte.

## 272. Fase 11/13 - Editores operativos pueden entrar a configuracion sin permiso fiscal

Cambio aplicado:

- La ruta `/settings/fiscal` acepta `settings.operational.update` como permiso suficiente para entrar al centro de configuracion.
- `FiscalSettingsView` recibe `canViewFiscalSettings` y, cuando el usuario solo puede editar reglas operativas, inicia en la pestana `Operativa`.
- En modo operativo puro, la pantalla no solicita `/api/settings/fiscal` ni secuencias fiscales, evitando un 403 evitable y ocultando secciones fiscales no autorizadas.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- appNavigation --run -t "operational settings editors"` | RED inicial porque la ruta solo aceptaba `settings.fiscal.view`; luego OK. |
| `npm run test -- FiscalSettingsView --run -t "does not request fiscal settings"` | RED inicial porque la pantalla quedaba en resumen fiscal y buscaba `scanner`; luego OK. |
| `npm run test -- appNavigation FiscalSettingsView App --run` | OK: 48 tests pasan en 8 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- La separacion operativa ya es usable por un rol basico sin entregar acceso fiscal completo. Los subagentes de auditoria priorizaron como siguientes P1: alinear el rol `cajero` con receta de dialisis y reportes de caja propia, y cortar el fallback legacy de recibos en pagos nuevos.

## 273. Fase 14 parcial - Cajero seeded puede aplicar receta de dialisis

Cambio aplicado:

- El rol seeded `cajero` ahora incluye `patients.mark_dialysis_prescription`.
- La regla no negociable de eritropoyetina queda usable desde una instalacion limpia: el cajero puede marcar receta de dialisis y la linea de Eritropoyetina queda en L.0.00.
- La prueba negativa se mantiene con un usuario emisor sin ese permiso directo para confirmar que el backend sigue rechazando `dialysis_prescription` con 422 y auditoria `invoice.dialysis_prescription_denied`.
- Se limpiaron grants directos redundantes en pruebas antiguas de facturacion/pagos que ya pueden confiar en el rol seeded.
- No se agregaron migraciones, dependencias, permisos nuevos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_seeded_cashier_can_apply_dialysis_prescription_to_erythropoietin` | RED inicial correcto: 422 por falta de permiso en `cajero`; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/Billing/InvoiceDialysisPrescriptionTest.php` | OK: 6 tests, 45 assertions. |
| `docker compose exec backend php artisan test tests/Feature/AuthTest.php` | OK: 19 tests, 80 assertions. |
| `docker compose exec backend php artisan test tests/Feature/UserManagementTest.php --filter="direct_permissions|module_permissions|regular_direct_permissions"` | OK: 11 tests, 49 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php --filter=erythropoietin` | OK: 2 tests, 12 assertions. |
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php --filter=dialysis_prescription` | OK: 1 test, 23 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- La receta de dialisis no es un flujo administrativo raro sino parte de caja hospitalaria diaria; por eso el rol base `cajero` debe poder usarla sin depender de permisos manuales posteriores al seeding.
- Hallazgo sidecar pendiente para el siguiente corte: el pago nuevo en frontend todavia intenta abrir recibo legacy cuando falta recibo institucional; debe cortarse con TDD sin afectar el fallback historico de facturas antiguas.

## 274. Fase 6/4 - Pago nuevo no abre recibo legacy

Cambio aplicado:

- `NewInvoiceView.submitPayment` ya no llama `/api/invoices/{id}/receipt` cuando `registerPayment` responde sin `institutional_receipt` y sin `institutional_receipt_error`.
- Si la factura queda pagada sin comprobante institucional en la respuesta, el flujo cierra el modal de cobro, abre `Factura pagada` y muestra recuperacion institucional: generar el recibo desde Historial antes de entregar comprobante.
- Si el pago queda parcial, el flujo no intenta recibo legacy; deja el camino visible para seguir cobrando desde `Cobrar ahora`.
- El fallback legacy se conserva en Historial/facturas antiguas y en pruebas especificas de compatibilidad.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView --run -t "legacy receipt|partial payment"` | RED inicial correcto: el flujo nuevo aun llamaba `/receipt`; luego OK: 4 tests pasan. |
| `npm run test -- src/features/invoices/NewInvoiceView.test.tsx -t "without requesting legacy receipt|partial payment|institutional receipt issuance fails"` | OK: 3 tests pasan. |
| `npm run test -- src/features/invoices/InstitutionalReceiptFlow.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx -t "legacy receipt|old invoices without institutional receipt|invoice has no institutional receipt"` | OK: 6 tests pasan, fallback historico intacto. |
| `npm run test -- NewInvoiceView --run` | OK: 26 tests pasan en 3 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- En cobros nuevos, el comprobante operativo debe ser institucional o quedar pendiente de emision institucional/reimpresion desde Historial. El recibo legacy queda limitado a compatibilidad historica, no al flujo diario de caja.

## 275. Fase 10/7 - Cajero puede ver reporte de su propia caja

Cambio aplicado:

- El rol seeded `cajero` ahora incluye `reports.cash_session.view`.
- El backend ya limitaba `GET /api/reports/cash-sessions/{cashSession}` a sesiones propias salvo usuarios con permiso gerencial; el corte activa ese flujo para instalaciones limpias.
- Se agrego prueba para confirmar que un cajero seeded ve su propia caja, no ve la caja de otro cajero y no obtiene totales de pagos ajenos.
- Se ajusto la prueba de permisos generales para que el usuario sin permisos siga recibiendo 403 en reporte de caja.
- No se agregaron migraciones, dependencias, permisos nuevos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=test_seeded_cashier_can_view_own_cash_session_report_only` | RED inicial correcto: 403 para caja propia por permiso faltante; luego OK. |
| `docker compose exec backend php artisan test --filter="cash_session_report"` | OK: 5 tests, 63 assertions. |
| `docker compose exec backend php artisan test tests/Feature/AuthTest.php` | OK: 19 tests, 80 assertions. |
| `docker compose exec backend php artisan test --filter=test_reports_view_permission_is_required` | OK: 1 test, 8 assertions. |
| `npm run test -- ReportsCash ReportsView.subroutes --run` | OK: 17 tests en 2 archivos. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- Para una version monocomputadora estable, el cajero debe poder revisar su turno/cierre sin permiso gerencial. El alcance sigue protegido por propietario de caja, por lo que no se exponen sesiones de otros usuarios.

## 276. Fase 10/7 - Reporte de caja carga el turno reciente

Cambio aplicado:

- `ReportsCash` ahora carga automaticamente el reporte de la caja reciente mas nueva despues de consultar `/api/cash-sessions`.
- El cajero no gerencial entra a `/reports/cash` y ve su turno reciente sin tener que volver a presionar `Ver caja`.
- El selector conserva la caja reciente como valor editable para consultas manuales.
- Los botones de exportacion siguen ocultos cuando `canExport=false`; no se exponen PDF/XLSX a cajeros sin permiso.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsCash --run -t "auto-loads the latest own cash session report"` | RED inicial correcto: `getCashSessionReport` no se llamaba al cargar sesiones recientes; luego OK. |
| `npm run test -- ReportsCash ReportsView.subroutes --run` | OK: 18 tests en 2 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- El reporte propio de caja debe ser visible de inmediato para operacion diaria LAN/offline. El usuario puede revisar su turno al abrir la pantalla, mientras las exportaciones permanecen reservadas a permisos explicitos.

## 277. Fase 10/17 - Ejecutivo sin glosario modal

Cambio aplicado:

- `ReportsExecutive` deja de renderizar el boton/modal `Definicion de metricas`.
- Se eliminaron `MetricsGlossary.tsx` y `MetricsGlossary.test.tsx`, que ya no tenian consumidores.
- El reporte ejecutivo mantiene los paneles operativos en secuencia: resumen, alertas, caja, pendientes, anulaciones/reversos, auditoria, metodos, tendencia y ranking.
- Se reduce ruido visual y codigo de reportes; el chunk `ReportsView` bajo de ~64.26 kB a ~60.71 kB en build local.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsExecutive --run -t "renders the complete executive report panel sequence"` | RED inicial correcto: el boton `Definicion de metricas` seguia visible; luego OK. |
| `npm run test -- src/features/reports --run` | OK: 60 tests en 14 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- Las definiciones contables extensas no deben competir con la lectura rapida del reporte diario. El reporte ejecutivo queda centrado en datos accionables y los terminos se sostienen por labels consistentes en pantalla/PDF/Excel.

## 278. Fase 10/16 - Error ejecutivo con recuperacion LAN

Cambio aplicado:

- `ReportsExecutive` ya no usa `Error desconocido` como fallback visible cuando el reporte falla sin detalle seguro.
- El estado de error ahora indica: `No se pudo cargar la informacion. Revise la conexion LAN y vuelva a intentar.`
- Se mantiene `userSafeErrorMessage` para respetar mensajes seguros del backend cuando existan, sin exponer stack traces ni detalles tecnicos.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReportsExecutive --run -t "LAN-safe error message"` | RED inicial correcto: el fallback LAN no aparecia y seguia `Error desconocido`; luego OK. |
| `npm run test -- ReportsExecutive --run` | OK: 3 tests. |
| `npm run test -- src/features/reports --run` | OK: 61 tests en 14 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- En operacion offline/LAN, un fallo de reporte debe orientar al operador hacia conexion/permisos/reintento, no dejar un texto generico que parece error interno.

## 279. Fase 12/16 - Descarga de respaldo sin huella tecnica

Cambio aplicado:

- El dialogo normal de descarga de respaldos deja de mostrar la fila `Verificacion` y la huella parcial del checksum.
- La confirmacion mantiene solo informacion operativa para el usuario: fecha, tamano, usuario y accion auditada.
- Se elimino el helper frontend que formateaba la huella parcial, porque no tenia otro uso.
- La tabla principal ya seguia sin exponer `sha256`, filename tecnico ni rutas locales.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView --run -t "confirms and reports backup downloads"` | RED inicial correcto: el dialogo mostraba `Verificacion` y `abc123456789`; luego OK. |
| `npm run test -- BackupsView --run` | OK: 32 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- La integridad criptografica es importante, pero la huella del checksum no debe aparecer en el flujo normal de descarga. Para operacion diaria monocomputadora basta confirmar fecha, tamano, usuario y auditoria; los detalles tecnicos quedan para soporte/servidor.

## 280. Fase 9/6/14 - Historial no descarga recibos ya impresos sin auditoria

Cambio aplicado:

- `InvoiceHistoryTable` deja de ofrecer `Descargar` cuando el recibo institucional ya tiene eventos de impresion.
- Para recibos ya impresos, el operador debe usar `Reimprimir PDF`/`Reimprimir`, que pasa por el flujo con motivo por defecto e idempotencia.
- La descarga directa se conserva para recibos institucionales emitidos sin eventos de impresion previos.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView --run -t "previously printed institutional receipt"` | RED inicial correcto: el menu aun mostraba `Descargar` para recibo ya impreso; luego OK. |
| `npm run test -- InvoiceHistoryView --run -t "downloads an issued institutional receipt pdf"` | OK: la descarga normal sigue disponible para recibo no impreso. |
| `npm run test -- InvoiceHistoryView --run` | OK: 42 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- Un recibo ya impreso no debe tener un atajo de descarga sin motivo, porque el backend exige trazabilidad de reimpresion. El historial queda alineado con auditoria y evita un fallo operativo justo en caja.

## 281. Fase 12/14 - Respaldos no consulta diagnostico sin permiso

Cambio aplicado:

- `BackupsView` solo consulta `/api/system/status` cuando el usuario tiene `system.status.view`.
- Usuarios con `backups.view` pueden ver historial/KPIs de respaldos sin recibir un error operativo falso por no tener permisos de soporte.
- El boton `Actualizar` ya no intenta refrescar diagnostico de sistema si el usuario no tiene permiso para verlo.
- El fixture admin de pruebas de respaldos se alineo con el rol real incluyendo `system.status.view`.
- No se agregaron migraciones, dependencias, permisos, endpoints ni cambios backend.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView --run -t "without system status permission"` | RED inicial correcto: `getSystemStatus` se llamaba con solo `backups.view`; luego OK. |
| `npm run test -- BackupsView --run` | OK: 33 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- El modulo de respaldos normal debe funcionar para operadores autorizados a verlo aunque no puedan acceder al diagnostico tecnico del servidor. La vista de soporte queda tras `system.status.view`, sin relajar RBAC backend.

## 282. Fase 4/5/14 - Referencia obligatoria para tarjeta y transferencia

Cambio aplicado:

- `StorePaymentRequest` exige `reference` cuando el metodo de pago es `card` o `transfer`.
- `RegisterPaymentAction` aplica el mismo invariante de dominio, normaliza espacios y no permite crear pagos tarjeta/transferencia sin comprobante aunque se invoque la accion directamente.
- `PaymentModal` bloquea la confirmacion de tarjeta/transferencia sin referencia, enfoca el campo y expone error accesible con `aria-invalid` y `role="alert"`.
- Los helpers de reportes y pruebas de reversa agregan referencias reales/sinteticas para pagos no efectivo exitosos.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=card_and_transfer_payments_require_a_reference` | RED inicial correcto: el endpoint devolvia 201; luego OK. |
| `npm run test -- PaymentModal --run -t "requires a reference"` | RED inicial correcto: el campo referencia no tenia `aria-invalid`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test --filter=it_requires_reference_for_transfer_and_card_payments` | RED inicial correcto: la accion creaba el pago; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Unit/Actions/RegisterPaymentTest.php tests/Feature/CashPaymentsReceiptTest.php tests/Feature/InvoiceReverseTest.php tests/Feature/FinancialFactsReportTest.php tests/Feature/Reports/TodayReportTest.php tests/Feature/Reports/ExecutiveReportTest.php` | OK: 75 tests, 767 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ReportsTest.php` | OK: 56 tests, 810 assertions. |
| `npm run test -- PaymentModal --run` | OK: 24 tests. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- Tarjeta y transferencia necesitan una referencia operativa para conciliacion, soporte y auditoria. Efectivo y `other` siguen permitiendo referencia opcional para no bloquear cobros validos de caja.

## 283. Fase 6/14 - API normal de recibos sin campos tecnicos

Cambio aplicado:

- `GET /api/settings/institutional-receipts` transforma perfiles segun permiso.
- Usuarios con solo `receipt_settings.view` reciben perfiles operativos sin `width_mm`, `height_mm`, margenes, fuente, escala ni `show_technical_fields`.
- Perfiles de soporte (`thermal_80mm`, `thermal_58mm`, `recibo_pequeno_personalizado`) quedan fuera del payload normal.
- `assignments.print_profile` y `resolved_profile` tambien usan la version segura para evitar fugas indirectas.
- Usuarios con `receipt_settings.advanced` conservan el payload completo para soporte tecnico.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=view_only_user_does_not_receive_technical_print_profile_fields` | RED inicial correcto: el payload incluia `width_mm`, margenes, fuente y perfiles termicos; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php` | OK: 19 tests, 103 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |

Decision:

- El hospital elige papel y opciones operativas; el detalle de layout pertenece al modo soporte con `receipt_settings.advanced`. El API normal queda alineado con esa separacion para que la UI no dependa de campos peligrosos.

## 284. Fase 6/14 - Impresion de prueba bloquea perfiles soporte sin avanzado

Cambio aplicado:

- `test-preview` y `test-print` rechazan perfiles de soporte tecnico cuando el usuario no tiene `receipt_settings.advanced`.
- La denegacion responde 403 con error `receipt_settings.advanced` y registra auditoria `receipt_settings.advanced_denied`.
- Perfiles normales como `media_carta_horizontal` siguen disponibles para usuarios con `receipts.print_test`.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=test_preview_and_print_reject_support_profiles_without_advanced_permission` | RED inicial correcto: `test-preview` aceptaba `thermal_80mm` con 200; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php` | OK: 20 tests, 111 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- Los perfiles termicos/personalizados son compatibilidad y soporte, no operacion normal. El backend ahora aplica la misma frontera aunque se intente forzar el `profile_code` desde la API.

## 285. Fase 6 - Frontend acepta payload seguro de perfiles de recibo

Cambio aplicado:

- `ReceiptPrintProfile` en frontend marca como opcionales los campos tecnicos que el backend normal oculta sin `receipt_settings.advanced`.
- `InstitutionalReceiptSettingsView` queda cubierto con una regresion que usa perfiles sin `paper_kind`, dimensiones, margenes, fuente, escala ni `show_technical_fields`.
- La vista normal mantiene seleccion de papel, preview y boton `Guardar perfil` sin exponer controles tecnicos.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | RED inicial correcto: `ReceiptPrintProfile` exigia `paper_kind`, `width_mm`, margenes y otros campos tecnicos; luego OK. |
| `npm run test -- InstitutionalReceiptSettingsView --run -t "safe backend payload"` | OK: 1 focused test. |
| `npm run test -- InstitutionalReceiptSettingsView --run` | OK: 24 tests. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- El contrato frontend ahora refleja el API real: operacion normal recibe datos seguros, mientras soporte avanzado puede recibir campos tecnicos completos.

## 286. Fase 7 - Cierre de caja refresca conciliacion antes de confirmar

Cambio aplicado:

- `CashBoxView` refresca `/api/cash-sessions/current` antes de abrir el dialogo de cierre cuando el monto contado ya es valido.
- La UI bloquea el cierre si el refresco devuelve facturas pendientes o saldo pendiente nuevos, evitando que el cajero confirme con datos de conciliacion cacheados.
- Si el refresco falla por red LAN/backend, la UI no abre la confirmacion y muestra un mensaje humano sin exponer errores SQL o tecnicos.
- Las pruebas existentes de cierre esperan ahora el dialogo real antes de confirmar, reflejando el flujo asincrono.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView --run -t "refreshes cash reconciliation"` | RED inicial correcto: solo habia 1 lectura de caja y el dialogo abria con cache; luego OK. |
| `npm run test -- CashBoxView --run -t "reconciliation refresh fails"` | RED inicial correcto: el dialogo abria aunque el refresco fallara; luego OK. |
| `npm run test -- CashBoxView --run` | OK: 16 tests. |
| `npm run test -- src/features/cash --run` | OK: 36 tests en 5 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- El backend sigue siendo la autoridad final para cerrar caja, pero el frontend debe sincronizar el dato operativo justo antes de pedir confirmacion para evitar sorpresas evitables al cajero durante el cierre.

## 287. Fase 8/14 - Modelo impide borrar servicios facturados

Cambio aplicado:

- `Service` ahora tiene una relacion `invoiceItems()` y un guard `deleting`.
- Si un servicio ya aparece en `invoice_items`, cualquier intento de borrarlo por Eloquent lanza `LogicException` y conserva el servicio activo y el vinculo historico.
- El endpoint HTTP mantiene su comportamiento anterior: servicios no facturados se desactivan, servicios facturados devuelven 409.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=invoiced_service_cannot_be_deleted_through_model` | RED inicial correcto: Eloquent borraba el servicio facturado; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ServiceCatalogTest.php --filter=deleting` | OK: 2 tests, 9 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ServiceCatalogTest.php` | OK: 41 tests, 245 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- La regla de negocio "desactivar en vez de borrar" ya no depende solo del controller. El modelo protege borrados internos por Eloquent y conserva la trazabilidad entre catalogo e historico facturado.

## 288. Fase 8/10 - Reporte operativo muestra motivo de cambio de impuesto

Cambio aplicado:

- `OperationsReportService::safeServiceValues()` ahora conserva `tax_change_reason` para auditoria operativa de `service.tax_updated`.
- El reporte sigue ocultando IDs tecnicos (`entity_id`, `service_id`, `category_id`) y expone solo valores operativos seguros.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=operations_report_lists_catalog_tax_change_reason` | RED inicial correcto: `new_values.tax_change_reason` llegaba como `null`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ReportsTest.php --filter=operations_report_lists_catalog` | OK: 2 tests, 29 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ReportsTest.php` | OK: 57 tests, 824 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- Si el sistema exige motivo para cambiar impuesto, ese motivo debe quedar visible en auditoria operativa sin obligar al usuario a consultar filas crudas de `audit_logs`.

## 289. Fase 4 - POS rechaza paciente en blanco por teclado

Cambio aplicado:

- `invoiceSchema` ahora normaliza `patient_name` con `trim()` antes de aplicar la regla requerida.
- El flujo POS por teclado (`Ctrl+Enter`) rechaza nombres compuestos solo por espacios y no abre la confirmacion de emision.
- El frontend sigue enviando nombres reales ya recortados; el backend continua siendo la autoridad final de facturacion y totales.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView --run -t "whitespace-only patient"` | RED inicial correcto: un nombre con solo espacios pasaba la validacion y podia abrir la confirmacion; luego OK. |
| `npm run test -- NewInvoiceView --run` | OK: 27 tests en 3 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- La validacion de paciente obligatorio debe tratar espacios como vacio en todos los caminos de emision, incluyendo el flujo rapido de teclado usado en caja.

## 290. Fase 5/9 - Anulacion no concede lectura historica global

Cambio aplicado:

- `InvoiceAccess::canAccessAnyInvoice()` ya no trata `invoices.void` como permiso de lectura historica global.
- El alcance global de lectura queda reservado para admin/supervisor, `invoices.operate_any`, `receipts.reprint_any` o `reports.managerial.view`.
- Un usuario con `invoices.view` + `invoices.void`, sin alcance operativo global, no puede listar ni abrir detalle de facturas ajenas por filtros historicos.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=invoice_void_permission_does_not_grant_historical_invoice_read_scope` | RED inicial correcto: el listado devolvia la factura ajena (`meta.total = 1`); luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InvoiceHistoryReprintVoidTest.php` | OK: 22 tests, 135 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- Poder anular una factura dentro del alcance operativo permitido no debe conceder por si solo busqueda o lectura de historico ajeno. La lectura historica amplia queda separada de la capacidad de anular.

## 291. Fase 6/9 - Roles elevados requieren confirmacion visible

Cambio aplicado:

- `UserFormDialog` detecta cuando el rol operativo seleccionado pasa a ser elevado (`admin`, `supervisor`, `auditor`, `root` o rol protegido).
- Crear o promover una cuenta a rol elevado muestra una advertencia con badge `Rol critico` y bloquea guardar hasta marcar confirmacion explicita.
- Editar una cuenta que ya conserva el mismo rol elevado no queda bloqueado por esta confirmacion, evitando friccion innecesaria en mantenimiento de datos.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UserFormDialog --run -t "elevated operational role"` | RED inicial correcto: no habia badge `Rol critico` ni confirmacion para rol admin; luego OK. |
| `npm run test -- UserFormDialog --run` | OK: 16 tests. |
| `npm run test -- UsersView --run` | OK: 30 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- La asignacion de un rol elevado completo debe tener la misma friccion operacional que los permisos directos criticos, aunque el backend ya valide `users.assign_admin_role`.

## 292. Fase 4/7 - POS revalida caja antes de confirmar emision

Cambio aplicado:

- `NewInvoiceView` refresca `/api/cash-sessions/current` justo antes de abrir la confirmacion de emision.
- Si la caja se cerro o ya no hay sesion abierta, la UI bloquea la confirmacion, actualiza el estado visual a caja cerrada y conserva paciente/carrito para reintentar tras abrir caja.
- El backend ya rechazaba emitir sin caja abierta; este corte reduce friccion operativa al detectar la carrera antes de pedir confirmacion al cajero.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- NewInvoiceView --run -t "refreshes cash session"` | RED inicial correcto: la confirmacion abria con caja obsoleta; luego OK. |
| `npm run test -- NewInvoiceView --run` | OK: 28 tests en 3 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- En caja hospitalaria, la UI debe revalidar estado operativo justo antes de una accion fiscal/caja. La autoridad final sigue siendo Laravel, pero el cajero recibe una alerta temprana y no pierde el carrito.

## 293. Fase 12/14 - Listado de respaldos oculta checksum tecnico

Cambio aplicado:

- `GET /api/backups` ya no incluye `checksum_sha256` en el payload normal de listado.
- El listado mantiene campos operativos: estado, tipo, tamano, fechas y usuario creador.
- La integridad sigue registrada internamente y se sigue auditando al descargar; la descarga conserva validacion de tamano/checksum antes de servir el archivo.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=admin_can_list_backups_without_exposing_internal_file_details` | RED inicial correcto: `data.0.checksum_sha256` estaba presente; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/BackupWorkflowTest.php` | OK: 28 tests, 146 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 430 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- El checksum es evidencia tecnica de integridad, no informacion necesaria en la vista normal de respaldos. Debe quedar disponible para validacion interna, auditoria y runbooks, no en el listado operacional.

## 294. Fase 12/14 - Vista normal de respaldos no menciona restauracion

Cambio aplicado:

- `BackupsView` ya no muestra el aviso principal "Restauracion no disponible desde la app" en la vista operacional de respaldos.
- La pantalla normal conserva indicadores, historial, descarga y creacion de respaldos segun permisos, sin presentar restaurar como flujo visible.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- BackupsView --run -t "concise backup guidance"` | RED inicial correcto: la vista aun mostraba el aviso de restauracion; luego OK. |
| `npm run test -- BackupsView --run` | OK: 33 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- La restauracion de respaldos es una operacion tecnica de recuperacion, no una accion normal de caja/administracion. La vista cotidiana debe enfocarse en crear, verificar estado y descargar respaldos autorizados.

## 295. Fase 5/7 - Caja conserva resumen confirmado tras cierre

Cambio aplicado:

- `CashBoxView` conserva la sesion cerrada devuelta por Laravel y muestra un resumen confirmado despues de cerrar caja.
- El resumen post-cierre permite imprimir y exportar CSV sin volver a ejecutar la accion de cierre.
- Al abrir una nueva caja se limpia el resumen del cierre anterior.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CashBoxView --run -t "confirmed close summary"` | RED inicial correcto: despues del cierre no existia resumen imprimible/exportable; luego OK. |
| `npm run test -- CashBoxView --run` | OK: 17 tests. |
| `npm run test -- CloseSessionDialog --run` | OK: 8 tests. |
| `npm run test -- src/features/cash --run` | OK: 37 tests en 5 archivos. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- El cierre de caja debe dejar evidencia operativa disponible despues de confirmar, usando el payload autoritativo del backend. Imprimir/exportar no debe depender de mantener abierto el dialogo pre-cierre.

## 296. Fase 5/7 - Cierre de caja registra usuario que cierra

Cambio aplicado:

- `cash_register_sessions` ahora guarda `closed_by_user_id` nullable con FK a `users`.
- `CloseCashSessionAction` registra el usuario autenticado que ejecuta el cierre, incluyendo cierres autorizados de una caja ajena por supervisor.
- La respuesta de cierre y el reporte de sesion de caja exponen `closed_by` separado del cajero dueño de la sesion.
- Se actualizo el tipo frontend `CashSession` para aceptar `closed_by`/`closed_by_user_id`.
- No se agregaron permisos, dependencias ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test --filter=supervisor_close_records_closing_user_in_session_and_report` | RED inicial correcto: `data.closed_by.id` era `null`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/CashPaymentsReceiptTest.php` | OK: 36 tests, 382 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | Primer intento excedio 3 minutos; segunda corrida OK sin errores. |
| `npm run typecheck` | OK. |

Decision:

- El cajero propietario de la sesion y el usuario que ejecuta el cierre son hechos auditables distintos. Los reportes deben conservar ambos para supervision y conciliacion posterior.

## 297. Fase 6 - Vista previa de recibos usa copy operativo

Cambio aplicado:

- `ReceiptSettingsPreview` ya no describe la vista previa normal con terminos tecnicos como "PDF final" o "servidor".
- El copy del preview se enfoca en papel, copias y prueba de impresion, manteniendo la pantalla normal libre de detalles de implementacion.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReceiptSettingsPreview --run -t "classic institutional fields"` | RED inicial correcto: el preview aun mostraba "PDF final" y "servidor"; luego OK. |
| `npm run test -- ReceiptSettingsPreview --run` | OK: 4 tests. |
| `npm run test -- InstitutionalReceiptSettingsView --run` | OK: 24 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- La configuracion normal de impresion debe hablar en terminos operativos del hospital. Los detalles sobre servidor/PDF interno pertenecen al sistema, no a la pantalla cotidiana del usuario.

## 298. Fase 6/14 - Denegaciones avanzadas usan resultado compatible con constraints

Cambio aplicado:

- Los audit logs `receipt_settings.advanced_denied` ahora se guardan con `result = failed`, valor permitido por las constraints offline/MySQL.
- Se conserva la accion `receipt_settings.advanced_denied` para trazabilidad, pero se evita que el 403 auditado falle por constraint de base de datos.
- Se cubrieron tanto campos manuales avanzados como perfiles de soporte en prueba/preview.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php --filter="without_advanced_permission"` | RED inicial correcto: audit log guardaba `result = denied`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php --filter=test_test_preview_and_print_reject_support_profiles_without_advanced_permission` | RED controlado correcto para perfil soporte: audit log guardaba `result = denied`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php` | OK: 7 tests, 41 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php` | OK: 13 tests, 71 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |

Decision:

- Las denegaciones siguen siendo auditables por accion, pero el campo `result` debe respetar el contrato persistente del sistema (`success`/`failed`) para no romper MariaDB local en produccion.

## 299. Fase 10 - Reportes requieren permisos concretos

Cambio aplicado:

- La ruta y navegacion `/reports` ya no se habilitan con el permiso generico legado `reports.view`.
- Reportes queda accesible solo con permisos que muestran contenido real: `reports.managerial.view`, `reports.cash_session.view` o `audit.view`.
- `useHospitalSession` ya no cuenta `reports.view` como reportes operativos ni como permiso operacional por si solo.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- appNavigation --run -t "generic reports.view"` | RED inicial correcto: `/reports` aparecia con solo `reports.view`; luego OK. |
| `npm run test -- useHospitalSession --run -t "generic reports.view"` | RED inicial correcto: el hook marcaba `reports=yes` y `operational=yes`; luego OK. |
| `npm run test -- appNavigation --run` | OK: 6 tests. |
| `npm run test -- useHospitalSession --run` | OK: 8 tests en 2 archivos. |
| `npm run test -- ReportsView.subroutes --run` | OK: 10 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `npm run build` | OK. |

Decision:

- Un permiso generico que no habilita ninguna subvista produce una pantalla vacia y confusa. La entrada a reportes debe depender de una capacidad concreta: ejecutivo, caja o auditoria.

## 300. Fase 10/QA - E2E de auditoria usa permiso real

Cambio aplicado:

- `frontend/e2e/reports-flow.spec.ts` ahora incluye `audit.view` en el usuario mock de reportes.
- El E2E de `/reports/audit` valida la pantalla de auditoria con el permiso concreto que la app exige, no con el permiso generico legado `reports.view`.
- No se relajaron permisos ni rutas; la correccion mantiene la separacion entre reporte ejecutivo, reporte de caja y auditoria.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK. |
| `docker exec s_hospital-backend-1 php artisan test --filter=InvoiceCreationTest` | OK: 33 tests, 136 assertions. |
| `npm run test -- NewInvoiceView PaymentModal ReceiptPreview InvoiceHistoryView BackupsView ReportsView DashboardView UsersView --run` | OK: 11 files, 192 tests. |
| `npx playwright test e2e/new-invoice-flow.spec.ts e2e/cashbox.spec.ts e2e/print-profiles.spec.ts e2e/reports-flow.spec.ts` | RED inicial: `/reports/audit` no mostraba auditoria con mock sin `audit.view`; luego OK al reejecutar `e2e/reports-flow.spec.ts`: 3 tests pasan. |
| `npm run test -- ReportsView.subroutes ReportsAudit --run` | OK: 2 files, 18 tests. |

Ejecuciones no concluyentes:

- `docker exec s_hospital-backend-1 php artisan test`, `npm run test` completo y `npx playwright test` completo fueron interrumpidos por reanudacion automatica del hilo antes de producir salida verificable. No se declaran verdes en este corte.

Decision:

- El reporte de auditoria es una capacidad critica, pero debe seguir protegido por `audit.view`. El E2E estaba desalineado con la politica actual y ahora prueba el flujo real autorizado.

## 301. Fase 10/14 - Backend rechaza reporte ejecutivo con permiso generico

Cambio aplicado:

- `ExecutiveReportRequest` ya no autoriza el reporte ejecutivo con solo `reports.view`.
- `ExecutivePdfExportRequest` ya no autoriza PDF ejecutivo con solo `reports.view` + `reports.export`.
- El acceso ejecutivo queda alineado con la UI: requiere `reports.managerial.view`, o `reports.cash_session.view` cuando la consulta esta limitada por `cash_session_id`.
- Se agregaron regresiones 403 para impedir que el backend dependa de la navegacion frontend como unica defensa.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/Reports/ExecutiveReportTest.php --filter=generic_reports_view` | RED inicial correcto: devolvia 200 con `reports.view`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/Reports/ExecutivePdfExportTest.php --filter=generic_reports_view` | RED inicial correcto: devolvia 200 con `reports.view` + `reports.export`; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/Reports/ExecutiveReportTest.php tests/Feature/Reports/ExecutivePdfExportTest.php` | OK: 20 tests, 203 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/Reports/ExecutiveReportTest.php tests/Feature/Reports/ExecutivePdfExportTest.php tests/Feature/ReportsTest.php --filter="generic_reports_view|executive|cash_session_report_user_cannot_export_managerial_daily_pdf"` | OK: 21 tests, 207 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `npm run test -- appNavigation useHospitalSession ReportsView.subroutes --run` | OK: 4 files, 24 tests. |

Decision:

- `reports.view` queda como permiso legado/generico, no como capacidad suficiente para ver reportes consolidados. La defensa real vive tambien en Laravel, no solo en el menu React.

## 302. Fase 13/14 - Usuarios oculta permiso reservado de asignacion admin

Cambio aplicado:

- `VisiblePermissions` ahora oculta `users.assign_admin_role` junto a permisos internos o inoperables.
- El listado de usuarios ya no expone `users.assign_admin_role` en permisos efectivos ni directos, incluso si una instalacion heredada lo tiene asignado directamente.
- El editor backend de usuarios rechaza `users.assign_admin_role` como `permissions.0`, igual que otros permisos ocultos del catalogo operativo.
- Roles protegidos y asignacion de roles elevados siguen controlados por las politicas y reglas existentes; no se agregaron permisos, migraciones, dependencias ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/UserManagementTest.php --filter="inoperable_permissions_hidden|reserved_admin_assignment"` | RED inicial correcto: el permiso reservado llegaba a validacion tardia y aparecia en listado; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/UserManagementTest.php` | OK: 42 tests, 183 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/UserManagementTest.php tests/Feature/RoleManagementTest.php tests/Feature/PermissionAuditTest.php tests/Feature/AuthTest.php --filter="user|role|permission|session_payload"` | OK: 70 tests, 303 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `npm run test -- UsersView UserFormDialog RoleFormDialog PermissionMatrix --run` | OK: 4 files, 65 tests. |

Decision:

- La version monocomputadora necesita usuarios basicos entendibles. `users.assign_admin_role` es una capacidad administrativa reservada para reglas internas y no debe aparecer ni aceptarse como permiso operativo directo en el editor de usuarios.

## 303. Fase 13/14 - reports.view queda como permiso legado oculto

Cambio aplicado:

- `VisiblePermissions` ahora oculta `reports.view` junto a permisos internos, reservados o no operables desde UI.
- La sesion `/api/auth/session` ya no expone `reports.view` aunque una instalacion heredada lo conserve asignado directamente.
- El catalogo de roles ya no muestra `reports.view` en roles ni en `permission_catalog`; quedan visibles los permisos concretos de reportes.
- El editor backend de usuarios rechaza `reports.view` como `permissions.0`, igual que los demas permisos ocultos.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/AuthTest.php --filter=session_payload_does_not_expose` | RED inicial correcto: `reports.view` seguia en sesion; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/RoleManagementTest.php --filter=permission_catalog_grouped` | RED inicial correcto: `reports.view` seguia en catalogo; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/UserManagementTest.php --filter="inoperable_permissions_hidden|direct_module_permissions_override"` | RED inicial correcto: `reports.view` era aceptado por el editor; luego OK. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/AuthTest.php tests/Feature/RoleManagementTest.php tests/Feature/UserManagementTest.php` | OK: 71 tests, 316 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `npm run test -- UsersView UserFormDialog RoleFormDialog PermissionMatrix --run` | OK: 4 files, 65 tests. |

Decision:

- `reports.view` se conserva como dato historico/legado para no romper instalaciones existentes, pero la version monocomputadora debe guiar a permisos concretos: `reports.cash_session.view`, `reports.managerial.view` y `reports.export` segun el flujo.

## 304. Fase 13/14 - Frontend oculta reports.view legado en usuarios

Cambio aplicado:

- `UsersView` ahora filtra `reports.view` en la misma lista local de permisos ocultos que usa para permisos internos o inoperables.
- Los formularios de usuarios y roles usan `reports.cash_session.view` como permiso visible de reportes en pruebas, dejando `reports.view` solo como dato legado filtrado.
- Si un backend o mock heredado devuelve `reports.view` en roles o catalogo, la UI no lo muestra como checkbox y no lo reenvia en payloads de usuario.
- No se agregaron dependencias, endpoints ni permisos nuevos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- UsersView UserFormDialog RoleFormDialog PermissionMatrix --run` | OK: 4 files, 65 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- El backend ya rechaza y oculta `reports.view`; el frontend tambien debe proteger al operador si recibe datos heredados, manteniendo visibles solo permisos concretos de reportes.

## 305. Fase 8/QA - PDF institucional no cuenta como impresion fisica

Cambio aplicado:

- `InstitutionalReceiptController::pdf` ahora genera PDF autorizado sin registrar eventos de impresion.
- `InstitutionalReceiptPdfService` separa `pdfForAuthorizedReceipt` de `recordAuthorizedReceiptPrintEvent`.
- Abrir, descargar o repetir la descarga del PDF ya no incrementa `reprint_count` ni crea `institutional_receipt_print_events`.
- La ruta `POST /institutional-receipts/{receipt}/print-events` sigue siendo la unica que registra primera impresion o reimpresion fisica, con motivo obligatorio despues de la primera impresion.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php --filter="institutional_receipt_pdf_get|explicit_print_event|reprint_event_requires"` | OK: 3 tests, 36 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptPdfTest.php --filter="repeated_receipt_pdf|receipt_pdf_post_with_idempotency|locked_print_event"` | OK: 3 tests, 40 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/InstitutionalReceiptPdfTest.php` | OK: 24 tests, 302 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- La descarga del PDF es una vista del documento, no evidencia de impresion fisica. La auditoria de impresion queda concentrada en el endpoint explicito `print-events` para evitar reimpresiones falsas cuando el operador solo abre o descarga el recibo.

## 306. Fase 8/QA - API rechaza perfil termico para recibo principal

Cambio aplicado:

- `IssueInstitutionalReceiptAction` valida el perfil resuelto antes de reservar numero o crear recibo institucional.
- La emision principal rechaza `thermal_80mm` y `thermal_58mm` cuando llegan por `profile_code`, `profile_id` o asignacion activa heredada.
- El rechazo devuelve 422 sobre `profile_code`, `profile_id` o `print_profile` segun el origen, sin consumir correlativo ni crear recibo.
- Carta, media carta y A5 siguen siendo los perfiles institucionales principales; los perfiles termicos quedan como compatibilidad secundaria fuera de esta emision principal.
- No se agregaron migraciones, dependencias, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptIssueTest.php --filter=secondary_thermal_profile` | OK: 2 tests, 13 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptIssueTest.php` | OK: 10 tests, 75 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/InstitutionalReceiptIssueTest.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php` | OK: 19 tests, 185 assertions. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- El recibo institucional principal no debe degradarse a ticket termico por una llamada API directa o por una asignacion de perfil heredada. La version monocomputadora reduce complejidad de despliegue, pero mantiene seriedad fiscal en recibos, correlativos e impresion.

## 307. Fase 9/QA - Historial exige motivo humano para reimpresion

Cambio aplicado:

- `InvoiceHistoryView` elimino el motivo fijo de reimpresion desde historial.
- La accion Reimprimir abre un dialogo de confirmacion con textarea obligatorio y minimo de 5 caracteres antes de llamar al PDF institucional o al recibo legacy.
- El motivo ingresado alimenta la idempotencia y la auditoria de reimpresion; si falla el PDF, el dialogo queda abierto para reintentar o cancelar sin perder el contexto.
- Las vistas de PDF sin impresion previa siguen abriendo o descargando el documento sin registrar reimpresion.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- InvoiceHistoryView --run` | OK: 1 file, 42 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- La version monocomputadora necesita reimpresiones simples, pero no motivos genericos. Cada copia posterior debe tener una razon humana registrada para que caja, auditoria y reportes expliquen por que se entrego otra copia.

## 308. Fase 6/QA - Preview legacy no expone CAI ni rango fiscal

Cambio aplicado:

- `ReceiptPreview` ya no renderiza CAI, vencimiento ni rango autorizado dentro del documento imprimible legacy.
- El recibo mantiene datos operativos utiles: numero de factura, fecha, paciente, estado, cajero, servicios, totales, pagos y firma/sello.
- La prueba del preview ahora asegura que el documento imprimible no contenga `CAI`, `Rango`, `Vence`, `TEST-CAI` ni el extremo del rango fiscal.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ReceiptPreview --run` | OK: 2 files, 11 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |

Decision:

- El fallback legacy existe solo para compatibilidad de historicos. No debe parecer factura fiscal ni exponer metadatos fiscales que el recibo institucional principal evita mostrar al paciente.

## 309. Fase 13/QA - Permisos visibles usan etiquetas operativas

Cambio aplicado:

- `RoleController` ahora usa etiquetas humanas explicitas para permisos visibles del MVP monocomputadora.
- Se reemplazan textos generados como `Cash - close any` por etiquetas operativas: cerrar/revisar cajas de otros cajeros, reportes ejecutivos, reporte de caja, soporte tecnico de impresion, usuarios y receta de dialisis.
- No cambia ningun permiso interno, rol, endpoint ni regla RBAC; solo cambia el texto que ve administracion al asignar roles o permisos directos.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/RoleManagementTest.php --filter=permission_catalog` | OK: 3 tests, 18 assertions. |
| `docker exec s_hospital-backend-1 php artisan test tests/Feature/RoleManagementTest.php` | OK: 11 tests, 56 assertions. |
| `npm run test -- UsersView UserFormDialog RoleFormDialog PermissionMatrix --run` | OK: 4 files, 65 tests. |
| `docker exec s_hospital-backend-1 vendor/bin/pint --test` | OK: 431 files. |
| `docker exec s_hospital-backend-1 vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |

Decision:

- Usuarios basicos no deben administrar una matriz gigante de strings tecnicos. Los codigos internos siguen visibles en gris para soporte, pero la decision principal se toma por etiquetas humanas y orientadas a caja hospitalaria.

## 310. Fase 14/QA - Crear respaldos exige ver el modulo

Cambio aplicado:

- `StoreBackupRequest` ahora requiere `backups.view` ademas de `backups.create` para crear respaldos manuales desde el API.
- `BackupLogPolicy::create` queda alineada con la misma regla de permisos.
- Se agrega cobertura para un usuario mal configurado que solo tiene `backups.create`: no puede disparar un respaldo invisible y no se crea ningun `backup_log`.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --filter=BackupWorkflowTest` | OK: 29 tests, 148 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- En la version monocomputadora, respaldar sigue siendo una accion administrativa sensible. Quien pueda crear respaldos debe poder ver el historial del modulo para confirmar estado, auditoria y descarga autorizada.

## 311. Fase 6/QA - Readiness fisico no exige tickets termicos

Cambio aplicado:

- `SystemStatusController` deja de requerir evidencia 80mm/58mm en `INSTITUTIONAL_RECEIPT_PRINT_PROOF`.
- El blocker `PENDING_HARDWARE_VALIDATION` y la evidencia fisica quedan enfocados en recibo institucional media carta, carta y A5.
- Se agrega una regresion que valida una evidencia completa sin campos ni checks termicos, y confirma que el payload no menciona 80mm/58mm.
- La compatibilidad termica queda fuera del criterio normal de readiness fisico; no se agregan endpoints, migraciones, roles ni permisos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php --filter=primary_receipt_print_proof` | OK: 1 test, 7 assertions. |
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php` | OK: 22 tests, 149 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- La version monocomputadora debe validar seriamente el recibo institucional principal, pero no bloquear salida por tickets 80mm/58mm que son compatibilidad secundaria.

## 312. Fase 19/QA - Readiness LAN no exige realtime avanzado

Cambio aplicado:

- `SystemStatusController` deja de requerir `/api/system/echo-config`, WebSocket y Soketi como checks obligatorios de `LAN_CLIENT_VALIDATION_PROOF`.
- La evidencia LAN sigue validando servidor, login, assets, caja, factura, pago, recibo, historial, reportes y respaldo.
- La prueba existente ahora confirma que una validacion LAN sin realtime avanzado queda `validated` y que el payload operativo no vuelve a mencionar Echo/WebSocket/Soketi.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php --filter=without_realtime_websocket` | OK: 1 test, 6 assertions. |
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php` | OK: 22 tests, 152 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- Para entregar una version monocomputadora/LAN simple, realtime no debe ser requisito de preparacion final. La validacion debe probar el navegador y los flujos criticos, sin exigir infraestructura avanzada que no es necesaria para caja local.

## 313. Fase 8/QA - Catalogo pide motivo al cambiar disponibilidad

Cambio aplicado:

- `ServiceSheet` ahora detecta cambios en activo, visible en caja y facturable al editar un servicio.
- El formulario muestra y exige `availability_change_reason` antes de guardar esos cambios, con el mismo minimo de 5 caracteres usado para motivos de precio e impuesto.
- El payload enviado al API incluye el motivo de disponibilidad, y los errores de validacion del backend se enfocan en el campo correcto.
- La prueba del formulario cubre ausencia de motivo, motivo corto y envio correcto del motivo junto con los flags de caja/facturacion.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- ServiceSheet.test.tsx --run` | OK: 1 file, 20 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- Cambiar si un servicio aparece o se cobra en caja es una decision operativa auditable, igual que precio e impuesto. El frontend no debe permitir un cambio que el backend rechaza o que quedaria sin motivo humano.

## 314. Fase 8/QA - Reactivar servicios desde tabla exige motivo

Cambio aplicado:

- `CatalogView` usa el mismo dialogo con motivo obligatorio para activar y desactivar servicios desde la tabla.
- Reactivar un servicio inactivo ya no llama directo al API sin `availability_change_reason`.
- El payload conserva snapshots operativos del servicio y envia el motivo auditado al cambiar `active`.
- La prueba de la vista cubre reactivacion con confirmacion, motivo minimo y payload esperado.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `npm run test -- CatalogView.test.tsx --run` | OK: 1 file, 20 tests. |
| `npm run typecheck` | OK. |
| `npm run lint` | OK. |
| `git diff --check` | OK. |

Decision:

- Activar un servicio vuelve a exponerlo en caja y debe quedar explicado con un motivo humano, no solo desactivar. La tabla no debe tener un camino rapido que omita la auditoria que exige el backend.

## 315. Fase 8/QA - Seeder de catalogo no pisa cambios operativos

Cambio aplicado:

- `ServiceCatalogSeeder` conserva precio, ISV, estado activo, visibilidad/facturable y codigos locales cuando el servicio ya existe.
- El seeder sigue creando servicios nuevos con los valores del CSV y sigue refrescando metadatos de origen como nombre, categoria, area, slug y hash.
- Los codigos de validacion se asignan al crear o cuando el campo esta vacio, pero no reemplazan codigos locales ya configurados.
- Se agrega una regresion que modifica un servicio sembrado, vuelve a ejecutar el seeder y confirma que los campos operativos locales no regresan al CSV.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/ServiceCatalogTest.php --filter=preserves_existing_operational_service_changes` | Primero fallo por sobrescribir precio; luego OK: 1 test, 8 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ServiceCatalogTest.php` | OK: 42 tests, 253 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- Reejecutar seeders en una instalacion local no debe revertir ajustes reales de caja. El CSV inicial sirve para crear y actualizar metadatos, no para borrar decisiones operativas ya auditables.

## 316. Fase 3/QA - Caja cerrada queda inmutable por modelo

Cambio aplicado:

- `CashRegisterSession` rechaza actualizaciones o eliminacion cuando la sesion ya estaba cerrada.
- `CashMovement` rechaza crear, actualizar o eliminar movimientos asociados a una caja cerrada.
- `CloseCashSessionAction` crea el movimiento de cierre antes de marcar la sesion como cerrada dentro de la misma transaccion, evitando abrir una excepcion especial post-cierre.
- Se agrega una regresion que cierra una caja vacia y prueba que no se pueda mutar la sesion, mutar el movimiento de cierre ni crear un movimiento nuevo para esa caja cerrada.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/Cash/CloseCashSessionTest.php --filter=immutable` | Primero fallo por permitir mutacion; luego OK: 1 test, 7 assertions. |
| `docker compose exec backend php artisan test tests/Feature/Cash/CloseCashSessionTest.php` | OK: 5 tests, 22 assertions. |
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php` | OK: 36 tests, 382 assertions. |
| `docker compose exec backend php artisan test tests/Feature/Payments/VoidPaymentAgainstClosedCashSessionTest.php` | OK: 2 tests, 10 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- Una caja cerrada es evidencia contable. Las correcciones posteriores deben ir por flujos autorizados y auditados, no por mutaciones directas sobre la sesion o sus movimientos.

## 317. Fase 7/QA - Exportes de caja incluyen cierre desde snapshot

Cambio aplicado:

- `ReportController` reutiliza `CashSessionReportService` cuando se exporta Excel o PDF con `cash_session_id`.
- El Excel consolidado agrega una hoja dedicada `Cierre de Caja` con caja, estado, cajero, apertura/cierre, esperado, contado, diferencia, totales por metodo, pagos y pendientes.
- El PDF consolidado agrega una seccion `Cierre de Caja` con los mismos totales de cierre, usando el payload de reporte de caja.
- Las pruebas cubren que el Excel tenga la hoja dedicada y que el PDF renderice la seccion de cierre para una caja cerrada real con pagos en efectivo y tarjeta.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter=dedicated_close_sheet` | Primero fallo por falta de hoja; luego OK: 1 test, 15 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter=period_pdf_includes_dedicated_close_snapshot_section` | Primero fallo por falta de seccion; luego OK: 1 test, 17 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter="cash_session_export|cash_session_period_pdf"` | OK: 5 tests, 62 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 431 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK: no errors. |
| `git diff --check` | OK. |

Decision:

- El boton de Excel/PDF de caja debe producir un cierre imprimible y exportable, no solo un reporte generico filtrado. Los agregados visibles para cierre salen del snapshot de caja para conservar evidencia contable.

## 318. Fase 5/QA - Asignaciones de recibos ocultan identificadores tecnicos

Cambio aplicado:

- La respuesta normal de configuracion de recibos ya no expone `receipt_print_profile_id`, `profile_code` ni `profile_name` en asignaciones para usuarios sin `receipt_settings.advanced`.
- Los perfiles de soporte siguen fuera del payload normal y el perfil embebido conserva solo los campos seguros que necesita el flujo operativo.
- Los usuarios con permiso avanzado mantienen la respuesta completa para soporte tecnico.
- Se actualiza la regresion existente de configuracion de recibos para confirmar que el payload normal no incluye los identificadores duplicados.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php --filter=view_only_user_does_not_receive_technical_print_profile_fields` | Primero fallo por exponer identificadores tecnicos; luego OK: 1 test, 19 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InstitutionalReceiptSettingsTest.php tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php` | OK: 20 tests, 115 assertions. |

Decision:

- La configuracion normal de recibos debe operar con opciones humanas de papel, copias, logo y sello/firma. Los identificadores duplicados de perfiles quedan fuera del contrato normal para reducir exposicion tecnica sin afectar la impresion ni el soporte avanzado.

## 319. Fase 7/12/QA - Reporte operativo no expone nombre tecnico de respaldo

Cambio aplicado:

- `OperationsReportService` deja de incluir `filename` en las filas de respaldos del reporte operativo.
- El reporte conserva datos utiles para auditoria diaria: estado, tipo, tamano, fechas y usuario creador.
- La prueba existente de anulaciones, reimpresiones y respaldos ahora exige que el nombre tecnico del archivo no salga en el payload normal.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter=operations_report_lists_voids_reprints_and_backups` | Primero fallo por exponer `data.backups.0.filename`; luego OK: 1 test, 20 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter="operations.*backup|backup.*operations|operations_report_lists_voids"` | OK: 2 tests, 29 assertions. |

Decision:

- El nombre del archivo de respaldo es detalle tecnico de almacenamiento. Los reportes operativos deben confirmar que hubo respaldos y su resultado sin mostrar nombres internos al flujo normal.

## 320. Fase 4/QA - DELETE de servicio exige motivo de disponibilidad

Cambio aplicado:

- `DELETE /api/services/{service}` ahora valida `availability_change_reason` cuando el servicio no facturado puede desactivarse.
- La desactivacion por DELETE conserva el comportamiento de no borrar la fila, pero registra el motivo en `service.deactivated`.
- Los servicios ya facturados mantienen el conflicto 409 existente antes de pedir motivo, porque no pueden eliminarse por este camino.
- Se actualiza la prueba de borrado/desactivacion para cubrir el rechazo sin motivo, la desactivacion con motivo y el audit log resultante.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/ServiceCatalogTest.php --filter=deleting_unbilled_service_requires_reason` | Primero fallo por permitir DELETE sin motivo; luego OK: 1 test, 10 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ServiceCatalogTest.php` | Primero detecto que servicios facturados debian conservar 409; luego OK: 42 tests, 258 assertions. |

Decision:

- Ocultar un servicio de caja es un cambio operativo auditable aunque se haga desde el camino de DELETE. El sistema local puede ser mas simple, pero no debe permitir que catalogo cambie disponibilidad sin una razon humana.

## 321. Fase 7/QA - Ejecutivo cuenta reimpresiones institucionales

Cambio aplicado:

- `ExecutiveReportService` suma eventos `institutional_receipt_print_events` de tipo `reprint` al KPI `audit_summary.reprints`.
- Los reportes ejecutivos sin filtros cuentan todas las reimpresiones institucionales del rango.
- Los reportes ejecutivos filtrados enlazan recibo institucional con factura para respetar los filtros existentes de caja, cajero, servicio, area, metodo y estado.
- La prueba de resumen de auditoria ahora cubre una reimpresion legacy y una reimpresion institucional en el mismo periodo.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php --filter=executive_includes_audit_summary_counts` | Primero fallo con `reprints=1`; luego OK: 1 test, 4 assertions. |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php` | OK: 13 tests, 172 assertions. |

Decision:

- El recibo principal del sistema es institucional. El KPI ejecutivo de reimpresiones debe reflejar copias institucionales reales, no solo eventos legacy de facturas.

## 322. Fase 5/QA - Reimpresion institucional desde historial queda auditada

Cambio aplicado:

- La reimpresion de recibos institucionales desde historial registra primero `institutional_receipt_print_events` con motivo humano e idempotencia.
- El PDF institucional se abre despues del registro auditado, usando la descarga simple del recibo ya emitido.
- Los casos de historial ahora verifican que la reimpresion institucional no dependa de parametros ignorados por el endpoint de PDF.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `cd frontend && npm run test -- InvoiceHistoryView.test.tsx -t "reprinting a previously printed institutional receipt" -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | Primero fallo porque no se llamaba `registerInstitutionalReceiptPrintEvent`; luego OK: 1 test, 41 skipped. |
| `cd frontend && npm run test -- InvoiceHistoryView.test.tsx -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 42 tests. |
| `cd frontend && npm run typecheck` | OK. |
| `cd frontend && npm run lint` | OK. |

Decision:

- Historial es un punto operativo de reimpresion real. Si la copia institucional se entrega desde ahi, debe quedar auditada antes de abrir el PDF, igual que el flujo principal de recibos.

## 323. Fase 5/QA - Primer PDF institucional desde historial registra impresion

Cambio aplicado:

- `Ver recibo` en historial registra un evento de impresion institucional antes de abrir el PDF cuando el recibo emitido aun no tenia eventos previos.
- El registro usa idempotencia por recibo para evitar duplicados por doble clic o reintento del mismo primer print.
- La descarga del PDF sigue usando el endpoint simple y conserva nombres seguros, incluso con numeros de recibo malformados.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `cd frontend && npm run test -- InvoiceHistoryView.test.tsx -t "opens institutional receipt pdf from history when the invoice has one" -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | Primero fallo porque `registerInstitutionalReceiptPrintEvent` no se llamaba; luego OK: 1 test, 41 skipped. |
| `cd frontend && npm run test -- InvoiceHistoryView.test.tsx -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 42 tests. |
| `cd frontend && npm run typecheck` | OK. |
| `cd frontend && npm run lint` | OK. |

Decision:

- Abrir el recibo institucional desde historial representa una impresion operativa si aun no existe evento. El sistema debe convertir ese primer acceso en evidencia auditada antes de permitir reimpresiones con motivo.
## 324. Fase 1/5/QA - Venta registra impresion institucional antes del PDF

Cambio aplicado:

- El flujo de nueva factura/cobro registra `institutional_receipt_print_events` antes de abrir el PDF institucional.
- La primera impresion desde pago o factura cero se registra sin motivo; las reimpresiones desde venta/cobro se registran con motivo humano e idempotencia.
- El PDF institucional vuelve a abrirse con el endpoint simple, evitando depender de parametros de motivo que el backend de PDF no usa.
- Se actualiza el test de flujo institucional para confirmar que `Ver recibo` tambien registra el primer evento auditado.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `cd frontend && npm run test -- NewInvoiceView.test.tsx -t "issues an institutional receipt for a paid zero-total invoice" -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | Primero fallo porque no se llamaba `registerInstitutionalReceiptPrintEvent`; luego OK: 1 test, 23 skipped. |
| `cd frontend && npm run test -- NewInvoiceView.test.tsx -t "reprints the institutional receipt from the sale flow" -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 1 test, 23 skipped. |
| `cd frontend && npm run test -- NewInvoiceView.test.tsx -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 24 tests. |
| `cd frontend && npm run test -- InstitutionalReceiptFlow.test.tsx -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 tests. |
| `cd frontend && npm run typecheck` | OK. |
| `cd frontend && npm run lint` | OK. |

Decision:

- El recibo principal se considera entregado cuando queda evidencia de impresion. La venta no debe abrir PDFs institucionales sin registrar primero el evento que alimenta auditoria, historial y reportes.

## 325. Fase 8/QA - Setup exige admin activo recuperable

Cambio aplicado:

- `/api/system/setup-status` ahora cuenta `admin_exists` solo cuando existe un usuario admin activo.
- `auth:create-initial-admin` sigue rechazando crear otro admin si ya hay un admin activo, pero permite recuperar una instalacion donde solo quedo un admin inactivo.
- Se agregan regresiones para setup con admin inactivo y recuperacion por comando inicial.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php --filter=setup_status_does_not_count_inactive_admin_as_usable_setup` | Primero fallo porque `steps.admin_exists=true`; luego OK: 1 test, 3 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InitialAdminCommandTest.php --filter=initial_admin_command_allows_recovery_when_only_admin_is_inactive` | Primero fallo con exit code 1; luego OK: 1 test, 3 assertions. |
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php` | OK: 23 tests, 155 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InitialAdminCommandTest.php` | OK: 6 tests, 14 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | Primero fallo por estilo/line endings tras editar tests; luego OK: 432 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. El primer intento sin memoria explicita llego al limite configurado de 128M. |

Decision:

- Para una instalacion local real, “admin existe” debe significar que hay una cuenta admin activa capaz de iniciar sesion. Si solo queda un admin inactivo, setup no debe verse completo y el comando inicial debe permitir recuperacion controlada.

## 326. Fase 2/5/QA - Cierre de caja bloquea recibos institucionales pendientes

Cambio aplicado:

- La reconciliacion de caja ahora cuenta facturas pagadas de la sesion que no tienen recibo institucional emitido.
- El cierre de caja rechaza cerrar cuando existe al menos una factura pagada sin recibo institucional, con mensaje operativo para generar el recibo pendiente.
- Las pruebas de cierres exitosos declaran explicitamente recibos institucionales emitidos, alineando los escenarios con el recibo principal del sistema.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php --filter=cash_session_cannot_close_paid_invoice_without_institutional_receipt` | Primero fallo porque el cierre respondia 200; luego OK: 1 test, 10 assertions. |
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php` | OK: 37 tests, 392 assertions. |
| `docker compose exec backend php artisan test tests/Feature/Cash/CloseCashSessionTest.php` | OK: 5 tests, 22 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 432 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

Decision:

- Una caja no debe cerrar si ya cobro una factura pero el comprobante institucional principal quedo pendiente. La version monocomputadora reduce complejidad de despliegue, no la seriedad de caja, recibos y auditoria.
## 327. Fase QA/Release - Preflight exige prueba de recibo institucional

Cambio aplicado:

- `production_readiness_preflight.ps1` deja de bloquear produccion por evidencia termica 80mm/58mm.
- El gate fisico obligatorio ahora exige `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con media carta, carta y A5, mas reimpresion, margenes, encabezados/pies e historial.
- La documentacion de instalacion/release apunta al recibo institucional principal; 80mm/58mm queda como compatibilidad secundaria si se habilita.
- Se agrega una prueba local de consistencia para evitar que el preflight vuelva a pedir `qa\THERMAL_PRINTER_PROOF.md` o resultados 80mm/58mm como bloqueo primario.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Unit/ProductionPreflightProofTest.php` | RED inicial de harness: el contenedor backend no monta `scripts/`, por lo que el test se descarto y no se commitea. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.test.ps1` | OK: confirma proof institucional y ausencia de proof termico 80mm/58mm en el preflight. |
| `rg -n "THERMAL_PRINTER_PROOF|80mm result|58mm result|INSTITUTIONAL_RECEIPT_PRINT_PROOF|Media carta result|A5 result" scripts docs\INSTALL_SUMMARY.md docs\RELEASE_CHECKLIST.md` | OK: solo quedan referencias institucionales en el gate y docs tocadas; las cadenas termicas quedan solo como negaciones del test. |

Decision:

- La entrega local monocomputadora reduce complejidad de despliegue, pero el comprobante fiscal principal sigue siendo el recibo institucional en papel/PDF. La compatibilidad termica no debe bloquear el release normal si no es el flujo operativo del hospital.

## 328. Fase 7/8/QA - Scope gerencial de reportes no depende de cierre de caja

Cambio aplicado:

- `reports.managerial.view` pasa a ser el permiso que habilita filtros gerenciales globales en reportes JSON/Excel ejecutivos y de rango.
- Se elimina la dependencia escondida de `cash.close_any` para ver reportes de otros cajeros; ese permiso queda ligado a caja, no a lectura gerencial.
- El rol `auditor` conserva lectura gerencial y auditoria sin poder cerrar cajas ajenas.
- Los usuarios con solo `reports.cash_session.view` siguen limitados a una caja propia y deben enviar `cash_session_id`.
- Los fixtures de cierre en `ReportsTest` ahora emiten recibos institucionales antes de cerrar caja, respetando el invariant nuevo de recibo principal.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter=auditor_managerial_reports_include_other_cashiers_without_close_permission` | RED inicial: el auditor recibia 0 categorias porque el request forzaba `user_id` propio; luego OK dentro del focused combinado. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter='auditor_managerial_reports_include_other_cashiers_without_close_permission\|cash_session_reports_without_managerial_are_scoped_to_own_activity'` | OK: 2 tests, 25 assertions. |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php` | OK: 13 tests, 172 assertions. |
| `docker compose exec backend php artisan test tests/Feature/ReportsTest.php` | Primero fallo en 4 cierres por facturas pagadas sin recibo institucional; luego OK: 60 tests, 866 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | Primero fallo por estilo en `ReportsTest`; luego OK: 432 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

Decision:

- Para usuarios basicos, `reports.cash_session.view` cubre caja propia. Para lectura gerencial/auditoria, `reports.managerial.view` debe expresar alcance global de lectura sin mezclarlo con permisos operativos de cierre de caja.

## 329. Fase 6/QA - Restore seguro solo en base descartable

Cambio aplicado:

- `restore_hospital_windows.ps1` ya no permite que `-ForceProductionRestore` convierta `hospital_billing` o `hospital_billing_production` en destinos validos.
- El helper aborta temprano si alguien intenta usar `-ForceProductionRestore`; el restore productivo queda reservado al runbook manual con parada operativa y backup previo.
- El self-test del helper ahora valida explicitamente que el force flag no pueda aceptar la base activa.
- La documentacion de restore en Windows recomienda checksum + helper seguro con `.sql.gz.enc`, `-ExpectedSha256` y base descartable; el helper descifra internamente a SQL temporal.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -SelfTest` | RED inicial cuando `ForceProductionRestore` aceptaba `hospital_billing`; luego OK, sin tocar bases ni backups. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -ForceProductionRestore -TargetDatabase hospital_restore_validation` | Falla esperada antes de leer backup o conectar MySQL: el flag ya no esta soportado. |
| `git diff --check` | OK; solo advertencia normal de line endings en el script PowerShell. |

Decision:

- La version local puede necesitar restaurar una base en emergencia, pero el helper incluido debe ser conservador: valida backups en bases descartables. Produccion se restaura solo con proceso manual, parada operativa, backup previo y evidencia escrita.

## 330. Fase QA/E2E - Golden release DB invalida cambios de auth y preparacion

Cambio aplicado:

- El hash de la golden SQLite de release E2E deja de depender solo de migraciones y seeders.
- Se agrega `release-e2e-hash.mjs` para incluir migraciones, seeders, `PrepareE2eReleaseDataCommand`, rutas, auth controller, auth requests, middleware de cookies, bootstrap y config de session/Sanctum.
- `run-release-e2e.mjs` usa el nuevo hash, de modo que cambios de preparacion/auth/session regeneran la golden DB en lugar de reutilizar una copia vieja.
- Se agrega test unitario del hash para comprobar inputs incluidos y cambios de hash al modificar prep/auth.
- Se actualiza el board V1.3: la invalidacion del hash queda corregida; el release E2E real y una compuerta MariaDB siguen pendientes.
- No se agregaron dependencias, migraciones, roles, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- release-e2e-hash release-e2e-preflight --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 2 files, 3 tests. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK; solo advertencia normal de line endings en `run-release-e2e.mjs`. |

Limitacion:

- No se corrio `npm run e2e` completo porque el host de esta sesion no tiene `backend/vendor/autoload.php`; el preflight existente lo bloquearia antes de levantar Laravel. El contenedor backend si tiene vendor, pero el runner de release esta disenado para host.

Decision:

- Aunque el E2E real siga pendiente, la golden DB ya no debe quedarse obsoleta cuando cambian las piezas que causaron el fallo historico de sesion/auth. Este corte reduce falsos verdes y falsos rojos antes de reintentar el release gate completo.

## 331. Fase Facturacion/Caja - Recuperacion visible de recibo institucional pendiente

Cambio aplicado:

- El dialogo de factura pagada ahora prioriza `Resolver recibo en Historial` cuando el pago quedo registrado pero no hay recibo institucional imprimible en la venta.
- La accion `Crear otra factura` queda secundaria en ese estado para reducir el riesgo de entregar o cerrar la atencion sin comprobante institucional.
- Se conserva el flujo normal de imprimir recibo institucional cuando el recibo existe y el flujo de permisos restringidos cuando no hay mensaje de recuperacion.
- No se agregaron dependencias, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- InvoiceSuccess --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial por asercion del mensaje duplicado; luego OK: 1 file, 5 tests. |
| `docker compose exec frontend npm run test -- NewInvoiceView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 3 files, 28 tests. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |

Decision:

- En version monocomputadora, el pago puede quedar confirmado aunque falle la emision/apertura del recibo. La pantalla debe guiar a recuperacion del comprobante institucional antes de continuar, no insinuar que el problema se resuelve creando otra factura.

## 332. Fase QA - Board V1.3 reconciliado con pruebas vigentes

Cambio aplicado:

- `docs/v1-3/COORDINATION_BOARD.md` deja de listar como P0 abiertos hallazgos ya corregidos de RBAC, CI pnpm y papel institucional del seed E2E.
- El board conserva como pendientes reales el release E2E auth/session, gate MariaDB, prueba responsive/recibo, timeout de suite backend completa y evidencia final LAN/fisica.
- Se registra que la recuperacion de recibo institucional pendiente ya tiene contrato backend y accion visible de Historial en frontend.
- No se modifico codigo de aplicacion, migraciones, permisos ni endpoints.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/UserManagementTest.php` | OK: 42 tests, 186 assertions. |
| `docker compose exec backend php artisan test tests/Feature/RoleManagementTest.php` | OK: 11 tests, 56 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php --filter='paid_receipt_can_be_issued_after_cash_session_closed_when_payment_was_already_posted|paid_payment_response_issues_institutional_receipt_with_configured_number'` | OK: 2 tests, 25 assertions. |

Decision:

- La lista de riesgos debe guiar entrega real: mantener P0s ya cerrados en el board distrae del bloqueo activo de E2E release y evidencia final. La fuente de verdad sigue siendo codigo y pruebas; esta entrada solo alinea la coordinacion documental con esa evidencia.

## 333. Fase QA/E2E - Release specs pasan en Docker con Chromium del sistema

Cambio aplicado:

- `playwright.release.config.ts` ahora respeta `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, igual que el config principal, para ejecutar gates release en entornos offline/contenedor sin descargar navegadores.
- `release-gate.spec.ts` se alinea al flujo actual: cobro institucional directo, total de Glucosa con ISV (`17.25`) y dialogo final `Factura pagada`.
- `release-rbac.spec.ts` se alinea al flujo release realista: admin crea un usuario cajero, valida permisos efectivos del rol, cambio obligatorio de contrasena y bloqueo de modulos administrativos.
- El board V1.3 deja de tratar la falla auth/session como P0 abierta para Docker/live stack; conserva pendiente el runner host SQLite/MariaDB final.
- No se agregaron dependencias, migraciones, endpoints ni permisos productivos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan hospital:prepare-e2e-release-data --password=Password123! --json` | OK: usuarios E2E, caja abierta, servicio Glucosa y configuracion institucional preparados en entorno local. |
| `docker compose exec -e E2E_RELEASE_ALLOW_MUTATIONS=1 -e E2E_RELEASE_BASE_URL=http://127.0.0.1:5173 -e E2E_RELEASE_API_BASE_URL=http://backend:8000 -e E2E_RELEASE_REPORT_PATH=/app/test-results/docker-release-e2e-report.json -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test --config=playwright.release.config.ts --reporter=list` | RED inicial por browser no descargado; luego RED por selectors/spec drift; finalmente OK: 2 passed. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |

Limitacion:

- No se declara cerrado el runner host `npm run e2e` porque esta sesion no tiene `backend/vendor/autoload.php` en el host. La evidencia nueva cubre navegador real contra el stack Docker local y descarta la regresion auth/session observada.

Decision:

- Para la version monocomputadora, el gate release debe poder correr sin internet usando Chromium del sistema. El bloqueo restante ya no es sesion expirada en la app, sino empaquetar/ejecutar el runner final con dependencias host o una compuerta MariaDB equivalente.

## 334. Fase QA/E2E - Gate release repetible contra Docker MariaDB

Cambio aplicado:

- Se agrega `scripts/run_release_e2e_mariadb.ps1` como wrapper repetible para preparar datos E2E no productivos y ejecutar las specs release contra el stack Docker/MariaDB local.
- El script exige una contrasena explicita por `-SeedPassword`, `E2E_RELEASE_PASSWORD` o `E2E_SEED_PASSWORD`, oculta credenciales en la linea impresa y evita `--json` para no registrar la contrasena de seed en logs.
- Se agrega `scripts/run_release_e2e_mariadb.test.ps1` como prueba estatica de las garantias del wrapper: mutaciones explicitas, Chromium del contenedor, reporte MariaDB y ausencia de contrasena de ejemplo.
- `release-rbac.spec.ts` filtra el usuario creado antes de esperar su fila, estabilizando corridas repetidas cuando la tabla de usuarios ya acumula datos E2E.
- El board V1.3 marca resuelto el gate MariaDB-backed y conserva separado el runner host SQLite, bloqueado en esta maquina por falta de `backend/vendor/autoload.php`.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_release_e2e_mariadb.test.ps1` | OK. |
| `docker compose exec -T -e E2E_RELEASE_ALLOW_MUTATIONS=1 -e E2E_RELEASE_BASE_URL=http://127.0.0.1:5173 -e E2E_RELEASE_API_BASE_URL=http://backend:8000 -e E2E_RELEASE_REPORT_PATH=/app/test-results/mariadb-release-e2e-report.json -e E2E_RELEASE_LOGIN=cajero.e2e -e E2E_RELEASE_ADMIN_LOGIN=admin.e2e -e E2E_RELEASE_PASSWORD=<E2E password> -e E2E_RELEASE_SERVICE_QUERY=Glucosa -e E2E_RELEASE_PAYMENT_AMOUNT=17.25 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test --config=playwright.release.config.ts --reporter=list -g "administrator creates cashier"` | OK: 1 passed. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_release_e2e_mariadb.ps1 -SeedPassword '<E2E password>'` | RED inicial por fila de usuario no visible tras muchas corridas; luego OK: 2 passed contra Docker/MariaDB. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |

Limitacion:

- Este wrapper usa el stack Docker/MariaDB local existente y muta datos E2E no productivos. No sustituye la evidencia fisica final de LAN/impresora ni el runner host `npm run e2e` cuando falten dependencias Composer en el host.

Decision:

- Para la version monocomputadora, la compuerta release debe validar el runtime real de base de datos local sin depender de SQLite ni de descargas de navegador. Este corte deja ese camino en un comando unico, repetible y apto para QA offline con Docker ya levantado.

## 335. Fase QA/Responsive - Reportes y recibos cubiertos a 320px

Cambio aplicado:

- `reports-flow.spec.ts` agrega cobertura mobile de 320px para la navegacion de reportes, cambio a Caja y ausencia de overflow horizontal de pagina/nav.
- `print-profiles.spec.ts` agrega cobertura mobile de 320px para controles de papel institucional y la pestana de vista previa de recibo, verificando contencion del preview y ausencia de overflow horizontal.
- El board V1.3 marca resuelto el riesgo de reportes mobile nav/receipt preview proof.
- No se cambiaron reglas fiscales, endpoints, permisos, payloads ni estilos productivos.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| Browser plugin viewport 320 contra `http://127.0.0.1:5173/login` | Parcial: screenshot/evaluate OK, `domSnapshot()` no disponible por error del runtime `incrementalAriaSnapshot`; se uso Playwright del repo para la prueba reproducible. |
| `docker compose exec frontend npx playwright test e2e/reports-flow.spec.ts e2e/print-profiles.spec.ts --reporter=list --workers=1` | RED inicial por selector de vista previa fuera de la pestana correcta; luego OK: 7 passed. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npm run typecheck` | OK. |

Decision:

- El riesgo de 320px debe quedar como prueba automatizada focalizada, no como inspeccion manual suelta. Reportes y recibos institucionales son superficies de entrega diaria; si vuelven a desbordar en mobile, el gate E2E lo detecta.
## 336. Fase QA/Backend - Unit y Feature verdes en Docker

Cambio aplicado:

- Se actualizan tres pruebas Feature que cerraban caja despues de registrar un pago sin recibo institucional emitido.
- `InternalControlAuditTest`, `InvoiceReverseTest` y `DoublePaymentTest` ahora preparan emision institucional real en los escenarios que necesitan cerrar una caja pagada.
- La correccion conserva la regla de negocio nueva: una caja con facturas pagadas sin recibo institucional sigue bloqueada por `CloseCashSessionAction`.
- El board V1.3 deja de marcar backend full-test Docker como bloqueado por mounts/timeouts, porque Unit, Feature y Coverage ya se ejecutaron por suite en Docker.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test --testsuite=Unit` | OK: 151 passed, 2 skipped. |
| `docker compose exec backend php artisan test --testsuite=Feature` | RED inicial: 3 failures por cierre de caja con factura pagada sin recibo institucional; luego OK: 698 passed, 10 skipped. |
| `docker compose exec backend php artisan test --testsuite=Coverage` | OK esperado: 1 skipped porque el coverage driver no esta habilitado. |
| `docker compose exec backend php artisan test tests/Feature/InternalControlAuditTest.php tests/Feature/InvoiceReverseTest.php tests/Feature/Resilience/DoublePaymentTest.php` | OK: 23 passed. |

Decision:

- La fuente de verdad no cambia: el sistema debe impedir cerrar caja si falta recibo institucional. Las pruebas antiguas estaban modelando un estado invalido para los flujos que querian validar diferencia de caja, reverso posterior al cierre y doble cierre.

## 337. Fase QA/LAN - Performance LAN reconciliado en board

Cambio aplicado:

- Se actualiza el board V1.3 para cerrar el riesgo stale de `Performance/LAN` sobre carga estatica de Echo/Pusher y polling acumulado.
- La evidencia queda atada a codigo existente: `frontend/src/lib/realtime/echo.ts` lazy-loads Echo/Pusher solo cuando el backend habilita broadcasting, y los hooks de polling usan intervalos dependientes de visibilidad.
- No se cambia runtime; este corte solo reconcilia coordinacion documental con pruebas actuales.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npm run test -- src/lib/realtime/echo.test.ts src/hooks/useBackups.test.tsx --run` | OK: 2 files passed, 14 tests passed. |

Decision:

- Para la version monocomputadora/LAN, realtime avanzado no es requisito. Mantener Echo/Pusher como carga diferida y pausar polling en pestanas ocultas reduce presion local sin eliminar compatibilidad futura.

## 338. Fase QA/E2E - Host release runner sin password por defecto

Cambio aplicado:

- `frontend/scripts/run-release-e2e.mjs` deja de usar `Password123!` como credencial E2E por defecto.
- `release-e2e-preflight.mjs` exige `E2E_RELEASE_PASSWORD` o `E2E_SEED_PASSWORD` para el runner host cuando las dependencias Composer locales existen.
- El preflight de Composer ahora apunta al gate real `scripts\run_release_e2e_mariadb.ps1 -SeedPassword <secret>` en vez de sugerir un smoke mockeado.
- El seeder host ya no se invoca con `--json`, evitando imprimir datos E2E sensibles en stdout/logs del runner.
- El board y `docs/testing-report.md` documentan que el host runner sigue bloqueado en esta maquina por falta de `backend/vendor/autoload.php`, mientras Docker/MariaDB queda como gate automatizado validado actual.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec frontend npx vitest run scripts/release-e2e-preflight.test.mjs --pool=forks --maxWorkers=1 --no-file-parallelism` | RED inicial por lectura de `import.meta.url`; luego OK: 4 tests passed. |
| `npm.cmd run e2e` desde `frontend/` | FALLO esperado: `backend/vendor/autoload.php is missing`; el mensaje recomienda `composer install` o el wrapper MariaDB con `-SeedPassword <secret>`. |

Decision:

- No se declara completo el runner host porque faltan dependencias Composer locales. Para la entrega monocomputadora, el gate Docker/MariaDB ya cubre el flujo real de base local; el runner host queda como evidencia adicional cuando se instale `backend/vendor` en host.

## 339. Fase QA/Offline - Readiness monocomputadora sin segunda PC obligatoria

Cambio aplicado:

- `SystemStatusController` selecciona `LOCAL_SERVER_VALIDATION_PROOF` cuando `APP_URL` es loopback/local, manteniendo `LAN_CLIENT_VALIDATION_PROOF` para despliegues multi-PC.
- `production_readiness_preflight.ps1` acepta loopback como modo monocomputadora y exige `qa\LOCAL_SERVER_VALIDATION_PROOF.md` en ese caso.
- Se agrega `qa/LOCAL_SERVER_VALIDATION_PROOF.example.md` con checks de login, caja, factura, pago, recibo, historial, reportes y backup desde el navegador local del servidor.
- Docs de instalacion/checklist separan claramente monocomputadora de multi-PC sin relajar MySQL/MariaDB, backups, impresion institucional, restore ni concurrencia.

Pruebas ejecutadas:

| Comando | Resultado |
|---|---|
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php --filter=loopback_app_url_is_treated_as_local_single_machine_mode` | RED inicial: devolvia `LAN_CLIENT_VALIDATION_PROOF`; luego OK: 1 passed, 15 assertions. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.test.ps1` | RED inicial: faltaba `qa\LOCAL_SERVER_VALIDATION_PROOF.md`; luego OK. |

Decision:

- La entrega monocomputadora no debe quedar bloqueada por una segunda PC. La evidencia sigue siendo obligatoria, pero ahora valida el navegador local del servidor y conserva el gate LAN externo solo cuando el despliegue sea multi-PC.

## 340. Fase QA/Docs - Evidencia monocomputadora reconciliada

### Cambios

- `docs/INSTALL_SUMMARY.md` ahora describe el modo monocomputadora aprobado y deja el modo multi-PC como opcion posterior, sin permitir bases separadas ni correlativos duplicados.
- `docs/testing-report.md`, `docs/00_README.md` y `docs/v1-3/COORDINATION_BOARD.md` cambian el bloqueo generico de LAN por evidencia de navegador segun modo seleccionado.
- `docs/RELEASE_CHECKLIST.md` evita decir que el flujo de factura/pago/recibo/reporte siempre debe ejecutarse desde un cliente LAN.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.test.ps1` | OK: el preflight test sigue validando prueba local/loopback e impresion institucional. |
| `git diff --check` | OK: sin whitespace conflictivo. |

### Decision

La documentacion debe reflejar el alcance aprobado: menos complejidad de despliegue, misma seriedad en facturacion, caja, recibos, respaldos, restore, concurrencia y auditoria. Monocomputadora no significa instalar copias separadas ni saltarse la evidencia fisica; solo cambia la prueba de navegador de segunda PC LAN a navegador local del servidor cuando `APP_URL` es loopback.

## 341. Fase UI/QA - Diagnostico admin reconoce monocomputadora

### Cambios

- `AboutView` deriva el modo de acceso desde `systemStatus.network.host_type`.
- Cuando el backend reporta `loopback`, la tarjeta administrativa muestra `Modo monocomputadora`, `Direccion local configurada` y `Acceso local` en lugar de marcar falta de LAN.
- El modo multi-PC conserva `Acceso LAN` y direccion LAN configurada.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- AboutView --run -t "loopback diagnostics"` | RED inicial: no aparecia `Modo monocomputadora`; luego OK. |
| `docker compose exec frontend npm run test -- AboutView --run` | OK: 7 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

La pantalla de soporte no debe pedir una direccion LAN cuando el alcance aprobado es monocomputadora. La fuente de verdad sigue siendo el backend; frontend solo traduce el modo seleccionado a lenguaje operativo para admin/soporte.
## 342. Fase Backups/QA - Validacion LAN visible solo en multi-PC

### Cambios

- `BackupsView` deja de ocultar `PENDING_LAN_CLIENT_VALIDATION` solo porque `APP_URL` ya tiene una IP LAN configurada.
- La prueba de segunda PC LAN queda visible para despliegues multi-PC y se etiqueta como `Confirmar prueba desde segunda PC LAN`.
- El modo loopback/monocomputadora sigue ignorando blockers heredados de segunda PC para no degradar readiness local.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- BackupsView --run -t "second-client LAN"` | RED inicial: no aparecia el aviso de pendientes; luego OK. |
| `docker compose exec frontend npm run test -- BackupsView --run` | OK: 34 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Configurar una IP LAN y completar la evidencia de segunda PC no son lo mismo. La version monocomputadora no exige segunda PC, pero si el despliegue es multi-PC, Backups/readiness debe seguir mostrando esa prueba como pendiente hasta que exista evidencia real.
## 343. Fase Backend/QA - Resumen publico usa evidencia local

### Cambios

- `BuildOperationalStatusAction` selecciona `LOCAL_SERVER_VALIDATION_PROOF` para `APP_URL` loopback y mantiene `LAN_CLIENT_VALIDATION_PROOF` para multi-PC.
- `SystemStatusController::baseStatus()` incluye `networkStatus()` para que el resumen publico pueda distinguir monocomputadora de LAN.
- El parser de evidencias acepta CRLF en campos y checks, necesario para archivos `.md` editados en Windows.
- Se agrega regresion para `/api/system/status-summary` con proof local completo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php --filter=public_summary_uses_local_server_proof` | RED inicial: devolvia `LAN_ACCESS`; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/SystemStatusTest.php` | OK: 24 tests, 167 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | OK: 432 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G --no-progress` | OK. |

### Decision

El resumen publico de estado debe seguir el mismo modo seleccionado que el readiness completo. En monocomputadora no debe pedir prueba de segunda PC, y los archivos de evidencia creados en Windows deben validarse aunque usen CRLF.
## 344. Fase Frontend/Monocomputadora - Indicador de conexion local

### Cambios

- El indicador operativo superior deja de anunciar `LAN activa` como estado global y usa `Conexion local activa`.
- El texto accesible cambia de `Red local disponible` a `Conexion local disponible`, valido para monocomputadora y para LAN sin imponer una segunda PC.
- Las regresiones de AppShell y accesibilidad cubren el nuevo contrato de texto.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- AppShell --run -t "local connection status"` | RED inicial: seguia anunciando `Red local disponible`; luego OK. |
| `docker compose exec frontend npm run test -- AppShell --run` | OK: 13 tests. |
| `docker compose exec frontend npm run test -- AppShell.a11y --run` | OK: 4 tests. |

### Decision

La barra global debe comunicar salud del servidor local sin convertir LAN/multi-PC en requisito visual. `Conexion local` conserva el sentido operativo y evita confundir el alcance monocomputadora.
## 345. Fase Frontend/Monocomputadora - Login con identidad local

### Cambios

- La pantalla de login deja de presentarse como `Sistema hospitalario LAN` y usa `Sistema hospitalario local`.
- El texto institucional explica operacion en esta computadora o servidor local, sin requerir clientes LAN para el flujo inicial.
- La prueba de LoginView impide reintroducir `clientes LAN`, `Sistema hospitalario LAN` u `offline/LAN` en la pantalla inicial.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- LoginView --run -t "local institutional"` | RED inicial: seguia mostrando `Sistema hospitalario LAN`; luego OK. |
| `docker compose exec frontend npm run test -- LoginView.a11y --run` | OK: 3 tests. |
| `docker compose exec frontend npm run test -- LoginView --run` | OK: 14 tests. |

### Decision

El acceso inicial debe tranquilizar al usuario sobre operacion local sin internet, pero no presentar LAN/multi-PC como requisito de la version monocomputadora estable.
## 346. Fase Frontend/Monocomputadora - Menu lateral local

### Cambios

- El pie del menu lateral cambia de `Operacion LAN` a `Operacion local`.
- AppShell cubre que el estado de caja, conexion local y alcance local sigan visibles sin reintroducir la etiqueta LAN.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- AppShell --run -t "local connection status"` | RED inicial: no encontraba `Operacion local`; luego OK. |
| `docker compose exec frontend npm run test -- AppShell.a11y --run` | OK: 4 tests. |
| `docker compose exec frontend npm run test -- AppShell --run` | OK: 13 tests. |
| `rg -n "Operacion LAN|Sistema hospitalario LAN|clientes LAN|offline/LAN|LAN activa|Sin LAN|Red local disponible" frontend/src` | OK: solo queda la guardia negativa del test de login. |

### Decision

El menu global debe describir el modo operativo local de la instalacion estable. LAN queda como capacidad de despliegue posterior, no como estado permanente del usuario.
## 347. Fase Frontend/Monocomputadora - Errores usan servidor local

### Cambios

- `apiClient` y `userSafeErrorMessage` reemplazan los fallos genericos de `servidor LAN` por `servidor local`.
- Nueva Factura cubre que el fallo inicial de caja/servicios no vuelva a guiar al cajero a un servidor LAN.
- Catalogo, dashboard, ayuda, reportes y componentes compartidos actualizan mensajes y pruebas de error comun a conexion/servidor local.
- `i18n` y el catalogo local de soporte quedan alineados con la terminologia monocomputadora.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- NewInvoiceView --run -t "local server wording"` | RED inicial: el sanitizador comun devolvia `servidor LAN`; luego OK. |
| `docker compose exec frontend npm run test -- base NewInvoiceView --run` | OK: 62 tests. |
| `docker compose exec frontend npm run test -- HelpView DashboardView ReportsExecutive design-system --run` | OK: 31 tests. |
| `docker compose exec frontend npm run test -- CatalogView CategorySheet ServiceSheet ServiceCatalogTable --run` | OK: 54 tests. |

### Decision

Los mensajes de error comunes deben pedir revisar el servidor local. LAN puede aparecer como detalle saneado del navegador o como modo multi-PC explicito, pero no como instruccion base para la version monocomputadora.
## 348. Fase Recibos/Impresion - Selector unico de papel normal

### Cambios

- La pantalla normal de `Papel y copias` elimina el bloque duplicado `Perfiles disponibles`.
- El flujo normal queda centrado en un unico selector de papel institucional: Carta, Media carta y A5.
- Se conserva el modo soporte tecnico en `<details>` para perfiles avanzados, sin exponerlo al usuario normal.
- Se agrega regresion para impedir que vuelvan botones duplicados de Carta/Media carta/A5 junto al selector principal.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run -t "one paper selector"` | RED inicial: aparecia `Perfiles disponibles`; luego OK. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run` | OK: 25 tests. |
| `docker compose exec frontend npm run test -- ReceiptSettingsPreview --run` | OK: 4 tests. |

### Decision

El hospital debe elegir papel una sola vez. Mantener un listado de perfiles normales junto al selector principal era redundante y aumentaba la carga cognitiva en el modulo donde la regla absoluta es ocultar complejidad tecnica.
## 349. Fase Reportes - Subrutas sin helper legacy

### Cambios

- Se elimina `ReportsView.helpers.ts`, helper local sin consumidores despues de la consolidacion por subrutas.
- `ReportsView.subroutes.test.tsx` deja de describir la navegacion como tabs y valida explicitamente que no exista `tablist` legacy.
- Se agrega una regresion estrecha de arquitectura para impedir que vuelva el helper muerto de `ReportsView`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsView.architecture --run` | RED inicial: `ReportsView.helpers.ts` existia; luego OK. |
| `docker compose exec frontend npm run test -- ReportsView.subroutes --run` | OK: 10 tests. |

### Decision

Reportes ya opera por subrutas Ejecutivo, Caja y Auditoria. Mantener nombres de tests tipo `tabs` y helpers locales muertos conserva ruido del modelo anterior y dificulta ver el siguiente refactor real de reportes.
## 350. Fase Usuarios - Extraer helpers puros de UsersView

### Cambios

- Se crea `users-view.helpers.ts` para roles protegidos, permisos ocultos y sanitizacion de roles/catalogo.
- `UsersView.tsx` queda como orquestador de pantalla y baja de 602 a 564 lineas sin cambiar flujos ni endpoints.
- Se agrega una regresion de arquitectura para evitar que `UsersView` vuelva a crecer como megacomponente monolitico.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- UsersView.architecture --run` | RED inicial: 602 lineas, sobre el limite; luego OK. |
| `docker compose exec frontend npm run test -- UsersView --run` | OK: 31 tests. |

### Decision

Las reglas sensibles de usuarios ya estan protegidas en backend; este corte reduce deuda frontend sin tocar seguridad, permisos ni auditoria. La siguiente fase puede extraer carga/cache o dialog orchestration con menor riesgo.

## 351. Fase Reportes - Renombrar panel de caja sin tab legacy

### Cambios

- `CashSessionReportTab` pasa a `CashSessionReportPanel` para alinear el nombre con la navegacion por subrutas.
- `ReportsCash` importa y renderiza el panel renombrado sin cambiar props ni comportamiento de caja.
- Se agrega regresion de arquitectura para impedir que vuelvan archivos `CashSessionReportTab` despues de eliminar el modelo visual legacy.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsView.architecture --run` | RED inicial: existia `CashSessionReportTab.tsx`; luego OK: 2 tests. |
| `docker compose exec frontend npm run test -- ReportsCash CashSessionReportPanel --run` | OK: 15 tests. |

### Decision

Reportes ya no presenta tabs legacy. Mantener un componente nombrado como `Tab` en caja confundia la arquitectura y escondia deuda pequena; el rename conserva la superficie funcional y hace visible que la pantalla es un panel de subruta.

## 352. Fase Reportes - Eliminar hook TodayReport frontend sin consumidores

### Cambios

- `useExecutiveReport.ts` queda limitado al query ejecutivo que consumen Reportes Ejecutivo y Auditoria.
- Se elimina `useTodayReport`, que no tenia consumidores en el frontend actual.
- `TodayReportService` conserva el contrato del endpoint `/api/reports/today`, pero su comentario deja de apuntar a un hook eliminado.
- Se agrega regresion de arquitectura para impedir que el hook muerto vuelva al modulo ejecutivo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- useExecutiveReport.architecture --run` | RED inicial: el modulo contenia `useTodayReport`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ReportsExecutive ReportsAudit ReportsView.subroutes --run` | OK: 21 tests. |

### Decision

El endpoint diario sigue disponible y probado en backend para compatibilidad operativa y smoke tests, pero el frontend estable de reportes ya no debe cargar deuda de un hook sin pantalla consumidora.

## 353. Fase Recibos - Bloquear borrado de recibos institucionales emitidos

### Cambios

- `InstitutionalReceipt` agrega guard de modelo para impedir `delete()` sobre recibos institucionales emitidos.
- La prueba de integridad ahora cubre recibos sin eventos de impresion, evitando depender solo de claves foraneas posteriores.
- La restriccion previa con evento de impresion queda alineada al mismo mensaje de dominio: anular con motivo y auditoria, no borrar.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=test_issued_institutional_receipt_cannot_be_deleted_even_without_print_events` | RED inicial: el recibo se eliminaba; luego cubierto por la suite focal. |
| `docker compose exec backend php artisan test --filter=InstitutionalReceiptSettingsMigrationTest` | OK: 5 tests / 34 assertions. |
| `docker compose exec backend php artisan test --filter=InstitutionalReceiptIssueTest` | OK: 10 tests / 75 assertions. |
| `docker compose exec backend vendor/bin/pint --test app/Models/InstitutionalReceipt.php tests/Feature/InstitutionalReceiptSettingsMigrationTest.php` | OK. |

### Decision

Un recibo institucional emitido es evidencia documental y fiscal. Debe sobrevivir aunque todavia no exista evento de impresion; la correccion operacional es anulacion auditada, nunca borrado directo.

## 354. Fase Usuarios - Bloquear borrado directo de usuarios

### Cambios

- `User` agrega guard de modelo para impedir `delete()` directo.
- `UserManagementTest` cubre que un usuario cajero permanece en base de datos y que el flujo permitido es desactivacion auditada con motivo.
- Se conserva el flujo existente de `/api/admin/users/{user}/toggle-active`, revocacion de tokens y auditoria de ciclo de vida.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=test_user_cannot_be_deleted_and_must_be_deactivated` | RED inicial: el usuario se eliminaba; luego OK: 1 test / 5 assertions. |
| `docker compose exec backend php artisan test --filter=UserManagementTest` | OK: 43 tests / 191 assertions. |
| `docker compose exec backend php artisan test --filter=InternalControlAuditTest` | OK: 7 tests / 54 assertions. |
| `docker compose exec backend vendor/bin/pint --test app/Models/User.php tests/Feature/UserManagementTest.php` | OK. |

### Decision

Los usuarios son parte de la trazabilidad de caja, facturacion, respaldos y auditoria. En la version monocomputadora tambien deben conservarse; retirar acceso significa desactivar con motivo, no borrar el registro historico.

## 355. Fase Reportes - Helpers explicitos para exportar caja

### Cambios

- `reports` agrega `downloadCashSessionReportExcel` y `downloadCashSessionReportPdf` como wrappers explicitos de los endpoints existentes.
- `apiClient` expone esos helpers para la pantalla de caja.
- `ReportsCash` deja de llamar `downloadReportExport`/`downloadReportPdf` directamente para exportaciones de caja.
- Las pruebas cubren URL final y `cash_session_id` para Excel/PDF de caja.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsCash reports.test --run` | RED inicial: helpers inexistentes y vista llamaba metodos genericos; luego OK: 12 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

La caja puede seguir usando los endpoints compartidos del backend, pero la frontera frontend debe nombrar la intencion operacional: exportar la caja seleccionada, no un reporte generico de periodo.

## 356. Fase Usuarios - Separar paneles de gestion

### Cambios

- `UsersView` baja de 565 a 436 lineas y queda como orquestador de datos, permisos y mutaciones.
- Se extraen `UserManagementOverview`, `UserRolesPanel`, `UsersDirectoryPanel` y `UserStatusToggleDialog`.
- Se conservan los dialogos y tablas existentes para no cambiar contratos API, RBAC, auditoria ni reglas de usuarios protegidos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- UsersView.architecture --run` | RED inicial: 565 lineas > limite; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- UsersView UserFormDialog RoleFormDialog UsersTable PermissionMatrix --run` | OK: 70 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Usuarios deja de ser una pantalla monolitica. La vista principal coordina estado y reglas de acceso; la UI pesada vive en componentes por responsabilidad sin relajar seguridad ni auditoria.
## 357. Fase Respaldos - Ocultar diagnostico automatico en vista normal

### Cambios

- La tarjeta principal de estado operativo deja de mostrar el diagnostico del programador de respaldos automaticos.
- El mismo estado humano queda disponible dentro de `Ver detalle de soporte` para revision tecnica.
- La vista normal conserva KPIs y alertas operativas sin exponer jerga de scheduler/worker al operador de caja.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx --run` | RED inicial: el diagnostico automatico aparecia visible; luego OK: 34 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Respaldos debe responder primero si el hospital puede confiar en copias recientes. Los detalles del programador automatico siguen disponibles para soporte, pero no compiten con el estado operativo normal.
## 358. Fase Caja - Trazabilidad en resumen de cierre

### Cambios

- El resumen confirmado de cierre muestra numero de caja y fecha de cierre cuando el backend devuelve la sesion cerrada.
- La exportacion CSV del resumen incluye `Caja` y `Cerrada` para archivo/auditoria del turno.
- `CashBoxView` pasa metadata de la sesion cerrada sin cambiar el payload de cierre ni recalcular totales en frontend.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- CashBoxView --run` | RED inicial: el resumen confirmado no mostraba caja/fecha; luego OK: 17 tests. |
| `docker compose exec frontend npm run test -- CloseSessionDialog --run` | RED inicial: el CSV no exportaba caja/fecha; luego OK: 9 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

El cierre de caja impreso/exportado debe servir como evidencia operativa del turno. Agregar numero de sesion y fecha de cierre mejora archivo y auditoria sin tocar calculos monetarios ni contratos fiscales.

## 359. Fase Catalogo - Separar secciones del formulario de servicio

### Cambios

- `ServiceSheet` baja de 722 a 510 lineas y queda como orquestador de estado, validacion y mutacion.
- Se extraen `ServiceSheetBasicSection`, `ServiceSheetPriceSection` y `ServiceSheetScannerSection`.
- El schema, defaults y constantes del formulario viven en `serviceSheetTypes`.
- Se conservan reglas existentes: motivo por precio/impuesto/disponibilidad, eritropoyetina fija, payloads y bloqueo de duplicados.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ServiceSheet.architecture --run` | RED inicial: 722 lineas > 520; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- CatalogView ServiceCatalogTable ServiceSheet --run` | OK: 47 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Catalogo conserva sus reglas de caja/facturacion y auditoria, pero el formulario deja de concentrar UI, schema y secciones en un solo megacomponente.

## 360. Fase Historial - Reimpresion institucional directa

### Cambios

- `Reimprimir PDF` desde historial deja de abrir un dialogo de motivo para recibos institucionales ya impresos.
- El frontend registra el evento de impresion con motivo estandar `Reimpresión solicitada desde historial.` e idempotencia antes de abrir el PDF.
- El E2E mockeado valida `print-events`, apertura del PDF institucional y ausencia de fallback legacy `/receipt` o `/reprint`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- InvoiceHistoryView --run -t "reprints a previously printed institutional receipt from history without asking for a reason"` | RED inicial: no registraba reimpresion porque esperaba dialogo; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView --run` | OK: 42 tests. |
| `docker compose exec frontend npx playwright test e2e/invoice-history-flow.spec.ts` | OK: 2 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Historial prioriza recuperacion rapida del recibo institucional para caja monocomputadora. La reimpresion queda auditada con motivo estandar y sin exponer controles tecnicos ni rutas legacy.

## 361. Fase Reportes - Snapshot operativo en auditoria

### Cambios

- `ReportsAudit` consume `/api/reports/operations` para mostrar un panel de operaciones del periodo mensual.
- Se agregan tipos y helper `getOperationsReport` en la capa API frontend.
- El panel muestra conteos de anulaciones, reimpresiones, pagos anulados y respaldos fallidos, mas filas recientes con datos humanos.
- La UI no expone filename, checksum, id tecnico ni rutas internas de respaldos aunque lleguen en el payload.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsAudit.test.tsx --run -t "renders the operations snapshot without exposing backup internals"` | RED inicial: no existia panel de operaciones; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ReportsAudit.test.tsx reports.test --run` | OK: 14 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec backend php artisan test --filter=ReportsTest` | OK: 60 tests. |
| `git diff --check` | OK. |

### Decision

Auditoria gana una vista ejecutable para la operacion local sin duplicar agregaciones en frontend. El backend sigue siendo fuente de verdad y la pantalla solo presenta datos seguros para supervision hospitalaria.

## 362. Fase Respaldos - Nombre de descarga sin ID tecnico

### Cambios

- La descarga local de respaldos usa un nombre sugerido con fecha y hora (`respaldo-local-YYYY-MM-DD-HHMM.sql.gz.enc`).
- Se elimina el ID tecnico visible del nombre de archivo descargado.
- La descarga sigue usando el ID internamente para pedir el archivo al backend y mantener auditoria.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx --run -t "confirms and reports backup downloads without exposing the technical filename"` | RED inicial: el nombre incluia `-1`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx --run` | OK: 34 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

El operador puede guardar el respaldo con un nombre entendible y sin identificadores internos. La seguridad real permanece en backend: permisos, descarga registrada y archivo servido por registro existente.

## 363. Fase Facturacion - Separar orquestacion de nueva factura

### Cambios

- `NewInvoiceView` baja de 774 a 711 lineas y deja de contener el listener global de teclado.
- Se agrega `useNewInvoiceShortcuts` para Ctrl+N, Ctrl+B, Ctrl+K, Escape y Ctrl+Enter.
- Se agrega `useNewInvoiceScreenGuards` para foco inicial y advertencia al cerrar con carrito activo.
- Se agrega `useNewInvoiceValidation` para mantener la validacion Zod fuera del megacomponente.
- Se conserva el comportamiento existente de emision, cobro, recibo institucional y reglas de eritropoyetina.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- NewInvoiceView.architecture --run` | RED inicial: 774 lineas > 720; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- NewInvoiceView --run` | OK: 30 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Nueva factura sigue siendo la pantalla principal de caja, pero la orquestacion repetible de teclado, foco y validacion vive en hooks dedicados. El backend continua como fuente de verdad para totales y pagos; este corte solo reduce el riesgo de seguir evolucionando el flujo.

## 364. Fase Facturacion - Precargar cobro exacto

### Cambios

- Al emitir una factura con saldo, el modal de cobro abre con `balance_due` devuelto por backend como monto recibido.
- El boton `Cobrar` de una factura pendiente tambien usa el saldo pendiente vigente si el monto estaba vacio o en cero.
- `PaymentModal` enfoca y selecciona el monto al abrir para confirmar rapido o sobrescribir sin pasos extra.
- El E2E de nueva factura valida el monto precargado antes de registrar el pago y mockea el evento auditado de impresion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- NewInvoiceView --run -t "prefills payment amount"` | RED inicial: el monto abria en `0.00`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- PaymentModal --run` | OK: 25 tests. |
| `docker compose exec frontend npm run test -- NewInvoiceView PaymentModal --run` | OK: 56 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec frontend npx playwright test e2e/new-invoice-flow.spec.ts` | OK: 1 test. |
| `docker compose exec frontend npm run build` | OK. |
| `git diff --check` | OK. |

### Decision

Caja monocomputadora gana velocidad sin pago automatico: el cajero sigue confirmando el cobro, pero el monto exacto ya viene desde la factura emitida por el backend. La UI no recalcula impuestos ni totales; solo reutiliza el saldo oficial y permite sobrescribirlo.

## 365. Fase Respaldos - Separar presentacion operativa

### Cambios

- `BackupsView` baja de 877 a 620 lineas y deja de concentrar formatos, sanitizacion y resumen operativo.
- Se agrega `backupPresentation` como fuente compartida para nombres seguros, formatos de tamano/fecha, etiquetas humanas y estado operativo.
- `BackupHistoryTable` reutiliza el mismo formato de tamano que el resto de respaldos.
- Se agrega `BackupPageActions` para separar la accion primaria de crear respaldo y la accion secundaria de actualizar.
- Se conserva la vista normal sin restauracion, sin SHA256/checksum y sin rutas tecnicas visibles.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- BackupsView.architecture --run` | RED inicial: 877 lineas > 620; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- BackupsView --run` | OK: 35 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Respaldos mantiene la operacion normal clara para caja monocomputadora, mientras la logica de soporte queda fuera del componente principal. Esto reduce riesgo para seguir limpiando estado avanzado sin exponer datos tecnicos al operador.

## 366. Fase Seguridad/Recibos - Bloquear asignacion de perfiles de soporte

### Cambios

- `ReceiptPrintProfile` centraliza los codigos de perfiles solo soporte y expone `isSupportOnly()`.
- `UpsertReceiptProfileAssignmentRequest` rechaza con 403 la asignacion activa de perfiles solo soporte si el usuario no tiene `receipt_settings.advanced`.
- El intento denegado queda auditado como `receipt_settings.advanced_denied` con resultado `failed`.
- `InstitutionalReceiptSettingsController` reutiliza el metodo del modelo para evitar listas duplicadas.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=test_user_without_advanced_permission_cannot_assign_support_only_profile_and_is_audited` | RED inicial: devolvia 200; luego OK: 1 test. |
| `docker compose exec backend php artisan test --filter=ReceiptProfileAssignmentTest` | OK: 11 tests. |
| `docker compose exec backend php artisan test --filter=ReceiptPrintProfileAdvancedFieldsTest` | OK: 7 tests. |
| `docker compose exec backend php artisan test --filter=InstitutionalReceiptSettingsTest` | OK: 13 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Models/ReceiptPrintProfile.php app/Http/Requests/InstitutionalReceipts/UpsertReceiptProfileAssignmentRequest.php app/Http/Controllers/InstitutionalReceiptSettingsController.php tests/Feature/ReceiptProfileAssignmentTest.php` | OK: 4 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK: no errors. |
| `git diff --check` | OK. |

### Nota de baseline

`docker compose exec backend vendor/bin/pint --test` global sigue fallando por un estilo preexistente en `app/Actions/Reports/TodayReportService.php` (`line_ending`, `unary_operator_spaces`). No se corrige en este commit para no mezclar reportes con seguridad de recibos.

### Decision

La seguridad de impresion no depende solo de ocultar controles en frontend. Aunque un perfil termico o personalizado ya exista y este activo por soporte, un usuario normal de configuracion no puede asignarlo al flujo operativo sin permiso avanzado.

## 367. Fase Reportes - Separar Ejecutivo de Caja y Auditoria

### Cambios

- `ReportsExecutive` deja de renderizar paneles de detalle de caja, anulaciones/reversos y auditoria.
- El reporte ejecutivo conserva resumen, alertas, cartera pendiente, metodos de pago, tendencia y ranking de servicios.
- `ReportsCash` y `ReportsAudit` quedan como rutas dueñas del detalle operativo correspondiente.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/reports/ReportsExecutive.test.tsx --run -t "keeps executive free"` | RED inicial: `cash-reconciliation-panel` seguia visible; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ReportsExecutive ReportsCash ReportsAudit --run` | OK: 20 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `git diff --check` | OK. |

### Decision

Reportes avanza hacia tres vistas claras: Ejecutivo para supervision rapida, Caja para conciliacion y Auditoria para control. Esto reduce ruido visual y evita que una ruta de resumen vuelva a convertirse en una pantalla con todos los detalles mezclados.

## 368. Fase Usuarios - Metadata de riesgo desde backend

### Cambios

- `RoleCatalog` centraliza que permisos son operativamente sensibles y que texto de riesgo se muestra.
- `/api/admin/roles` expone `critical`, `risk_level` y `risk_label` tanto en roles como en `permission_catalog`.
- `RoleFormDialog`, `UserFormDialog` y `PermissionMatrix` dejan de depender de una lista local de permisos criticos.
- La UI muestra el motivo de riesgo cuando el backend lo envia y mantiene confirmacion explicita para roles/permisos criticos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter RoleManagementTest::test_permission_catalog_marks_elevated_permissions_with_risk_metadata` | RED inicial: `critical` era `null`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- RoleFormDialog PermissionMatrix UserFormDialog --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED inicial: la UI ignoraba metadata nueva; luego OK: 38 tests. |
| `docker compose exec backend php artisan test --filter RoleManagementTest` | OK: 12 tests. |
| `docker compose exec backend php artisan test --filter RoleCatalogTest` | OK: 1 test. |
| `docker compose exec frontend npm run test -- RoleFormDialog PermissionMatrix UserFormDialog UsersView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 69 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Support/RoleCatalog.php app/Http/Controllers/RoleController.php tests/Feature/RoleManagementTest.php` | OK: 3 files. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

### Decision

Usuarios y roles conservan una pantalla simple para monocomputadora, pero la clasificacion de permisos sensibles queda gobernada por backend. Asi se evita que futuras reglas de seguridad fiscal, respaldos o caja queden duplicadas en React.

## 369. Fase Catalogo - Resumen de cambios auditados

### Cambios

- `ServiceSheet` muestra un resumen compacto cuando el operador cambia precio, ISV o disponibilidad de caja.
- El resumen enumera valores anterior/nuevo antes de guardar para que el riesgo sea visible sin texto largo.
- `ServiceAuditedChangesSummary` concentra el render y los helpers de comparacion para mantener `ServiceSheet` como orquestador.
- Se conserva el contrato backend existente: los motivos siguen siendo obligatorios y auditados por Laravel.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/catalog/components/ServiceSheet.test.tsx --run -t "summarizes audited catalog changes"` | RED inicial: no existia el resumen; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ServiceSheet ServiceCatalogTable CatalogView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | RED intermedio: `ServiceSheet` excedia 520 lineas; luego OK: 48 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Catalogo mantiene la edicion rapida, pero ahora las modificaciones sensibles se ven como un resumen auditado antes de guardar. Esto reduce riesgo operativo cuando se cambian precios, impuestos o visibilidad sin agregar otra confirmacion pesada.

## 370. Fase Recibos - Vista previa respeta sello/firma

### Cambios

- `ReceiptSettingsPreview` oculta el bloque completo de sello/firma cuando el perfil desactiva `show_physical_seal_space`.
- La vista previa conserva la firma del enterante y adapta la grilla para que el operador no vea un espacio institucional que no se imprimira.
- Se agrega una prueba enfocada para evitar regresiones entre el control de perfil y la previsualizacion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/ReceiptSettingsPreview.test.tsx --run -t "hides the seal"` | RED inicial: el texto `Espacio para sello/firma` seguia visible; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/ReceiptSettingsPreview.test.tsx src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 30 tests. |

### Decision

La configuracion normal de recibos debe mostrar exactamente lo que el hospital imprimira. Si el perfil desactiva el espacio de sello/firma, la previsualizacion ya no mantiene un rastro visual contradictorio.

## 371. Fase Historial - Motivo manual para reimprimir PDF institucional

### Cambios

- `Reimprimir PDF` en historial ya no registra una reimpresion institucional previamente impresa con un motivo fijo.
- Cuando el recibo institucional ya tiene eventos de impresion, el flujo abre el mismo dialogo auditado de reimpresion y exige motivo minimo.
- El backend sigue recibiendo el motivo escrito por el usuario junto con la llave de idempotencia del intento.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx --run -t "requires a manual reason before reprinting a previously printed institutional PDF"` | RED inicial: no aparecia dialogo y el backend recibia el motivo fijo; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/invoices/InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 42 tests. |

### Decision

La reimpresion de un PDF institucional ya impreso es un evento auditado. El historial puede acelerar el acceso al PDF, pero no debe inventar el motivo: el cajero o supervisor debe escribirlo antes de abrir otra copia.

## 372. Fase Respaldos - Bloquear respaldo manual si hay pendiente

### Cambios

- La pantalla de respaldos deshabilita `Crear respaldo` cuando el servidor reporta respaldos pendientes.
- `BackupPageActions` muestra una razon operativa breve para esperar antes de solicitar otra copia.
- Se cubre el flujo para evitar que el dialogo de creacion se abra mientras ya existe un respaldo pendiente.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx --run -t "blocks a new manual backup"` | RED inicial: el boton seguia activo; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/backups/BackupsView.test.tsx src/features/backups/BackupsView.architecture.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 36 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

En monocomputadora conviene evitar que el operador apile solicitudes de respaldo. Si ya hay una copia pendiente, la app prioriza esperar a que termine o revisar el estado del servidor antes de crear otra.

## 373. Fase Reportes - Ejecutivo enfoca servicios principales

### Cambios

- `ServiceRanking` deja de mostrar rankings secundarios por cantidad, categoria y area dentro del ejecutivo.
- El bloque se concentra en el top de servicios por monto, con facturado y cobrado visibles en una sola tabla.
- Se elimina el chip explicativo `Lectura` para reducir ruido visual en el reporte ejecutivo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/reports/components/ServiceRanking.test.tsx --run -t "focuses executive service ranking"` | RED inicial: seguian visibles `Top por cantidad`, `Por categoria` y `Por area`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ServiceRanking ReportsExecutive ReportsView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 18 tests. |

### Decision

El ejecutivo debe responder rapido que servicios explican la facturacion del periodo. Los cortes por volumen, categoria o area pueden vivir en reportes dedicados, pero no deben competir con la lectura principal de caja/gerencia.

## 374. Fase Dashboard - No promover apertura de caja sin permiso

### Cambios

- `DashboardView` recibe `canOpenCash` y usa ese permiso para mostrar la accion principal `Abrir caja`.
- `cash.view` queda como permiso de consulta/navegacion: permite entrar a Caja, pero no promociona una apertura desde el centro de mando.
- `AppRoutes` pasa el permiso real `cash.open` al dashboard y se elimina el contrato viejo basado en `canViewCash`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/App.test.tsx --run -t "does not promote opening cash"` | RED inicial: el dashboard mostraba `Abrir caja` con solo `cash.view`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/dashboard/DashboardView.test.tsx --run` | OK: 15 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Nota

El intento amplio `docker compose exec frontend npm run test -- AppRoutes App DashboardView --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` fallo en dos pruebas existentes de `App.test.tsx` (`renders backups view actions for an admin` y `renders not found for an unknown authenticated route`). El nuevo caso de permisos de caja y el dashboard completo quedaron verdes.

### Decision

Abrir caja es una accion operativa, no una lectura. La interfaz debe respetar el mismo limite que ya aplican `CashBoxView` y el backend: consultar caja requiere `cash.view`, abrir caja requiere `cash.open`.

## 375. Fase QA - Recuperar suite App.test

### Cambios

- `App.test.tsx` alinea el caso de respaldos con la vista normal actual: no debe mostrar restauracion ni boton de restaurar.
- El mock de admin de respaldos recibe `system.status.view` cuando el test exige estado operativo y detalle de soporte.
- El caso de ruta desconocida usa `reports.managerial.view`, un permiso operativo vigente, en lugar del permiso obsoleto `reports.view`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/App.test.tsx --run -t "renders backups view actions for an admin"` | RED inicial: esperaba texto de restauracion y luego `estado operativo` sin permiso; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/App.test.tsx --run -t "renders not found for an unknown authenticated route"` | RED inicial: `reports.view` no habilitaba modulo operativo; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/App.test.tsx --run --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 19 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La suite de app debe reflejar permisos reales y el flujo normal de respaldos. Restaurar sigue siendo trabajo de soporte fuera de la app, y el 404 autenticado debe probarse con un permiso operativo existente para no caer en `Sin permisos operativos`.

## 376. Fase QA - Build frontend y suites criticas backend

### Cambios

- No hubo cambios de codigo en esta fase.
- Se ejecuto verificacion de entrega sobre build frontend y grupos backend de facturacion, caja, pagos, recibos, historial y respaldos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run build` | OK: `tsc --noEmit` y `vite build`. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php tests/Feature/Billing/InvoiceDialysisPrescriptionTest.php tests/Unit/CalculateInvoiceTotalsActionTest.php tests/Unit/Actions/EritropoyetinaRuleTest.php` | OK: 53 tests. |
| `docker compose exec backend php artisan test tests/Feature/Cash/CloseCashSessionTest.php tests/Feature/CloseCashSessionDifferenceTest.php tests/Feature/CashPaymentsReceiptTest.php tests/Feature/Payments/RegisterPaymentDoesNotMutateInvoiceTest.php tests/Unit/Actions/RegisterPaymentTest.php` | OK: 52 tests. |
| `docker compose exec backend php artisan test tests/Feature/InstitutionalReceiptIssueTest.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/InstitutionalReceiptPdfTest.php tests/Feature/InvoiceHistoryReprintVoidTest.php tests/Feature/Resilience/ReprintDoesNotMutateTest.php` | OK: 58 tests. |
| `docker compose exec backend php artisan test tests/Feature/BackupWorkflowTest.php tests/Feature/Resilience/BackupRestoreRoundtripTest.php` | OK: 33 tests, 1 skip documentado por simulacion MySQL. |

### Decision

Antes de seguir refactorizando, se confirma que los flujos criticos de entrega siguen verdes: emitir factura, eritropoyetina, cobrar, cerrar caja, recibo institucional, reimpresion/anulacion y respaldo local.

## 377. Fase Recibos - Flujo normal sin leyenda tecnica de copias

### Cambios

- `InstitutionalReceiptSettingsView` deja de mostrar el control `Leyenda de copias` en el flujo normal de papel y copias.
- El flujo normal queda limitado a papel, cantidad de copias, logo, sello/firma, imprimir prueba y guardar perfil.
- El valor interno de `show_copy_legend` se conserva desde el perfil para no migrar ni romper recibos existentes.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx --run -t "keeps normal print controls limited"` | RED inicial: el checkbox `Leyenda de copias` seguia visible; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx --run` | OK: 26 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La configuracion diaria de impresion debe mantenerse estricta. La leyenda de copias es un detalle de implementacion del perfil, no una decision operativa que el hospital deba ajustar durante caja.

## 378. Fase Recibos - Payload normal sin campo oculto de leyenda

### Cambios

- El guardado normal de perfil de recibo ya no envia `show_copy_legend` cuando el control no existe en pantalla.
- El payload normal queda limitado a campos visibles: copias, logo, sello/firma y los flags internos necesarios para activar el perfil institucional.
- El modo soporte avanzado conserva su ruta separada para ajustes auditados.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx --run -t "saves the selected normal paper profile"` | RED inicial: `show_copy_legend` viajaba en el payload oculto; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx --run` | OK: 26 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Ocultar un control no basta si el request todavia lo modifica. El flujo normal de impresion debe enviar solo lo que el operador realmente decide, dejando detalles de plantilla fuera de la operacion diaria.

## 379. Fase Reportes - Filtros ejecutivos sin panel generico

### Cambios

- `ReportFiltersPanel` se retiro como nombre generico del modulo de reportes.
- El control de periodo/exportacion queda como `ExecutiveReportFilters`, acotado al reporte ejecutivo.
- `computePresetRange`, `PresetKey` y etiquetas de periodos pasan a `reportDateRanges`, helper compartido por ejecutivo y auditoria.
- La prueba de arquitectura bloquea el regreso de archivos `ReportFiltersPanel`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- src/features/reports/ReportsView.architecture.test.ts --run -t "generic report filter"` | RED inicial: existian `ReportFiltersPanel.tsx` y `ReportFiltersPanel.test.tsx`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- src/features/reports/components/ExecutiveReportFilters.test.tsx --run` | OK: 2 tests. |
| `docker compose exec frontend npm run test -- src/features/reports --run --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | OK: 15 files, 65 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

El modulo ya no conserva un filtro transversal con nombre de arquitectura vieja. Auditoria comparte solo el calculo de rangos; la UI de filtros pertenece explicitamente al reporte ejecutivo consolidado.

## 380. Fase Reportes - Referencias de QA alineadas a nombres vivos

### Cambios

- El inventario vivo de reportes reemplaza `CashSessionReportTab`, `ReportFiltersPanel` y `MetricsGlossary` por los componentes actuales.
- `docs/testing-report.md` actualiza el comando reutilizable de reportes de caja para apuntar a `CashSessionReportPanel.test.tsx`.
- El comentario del helper de fechas referencia `CashSessionReportPanel` y `ReportsAudit`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `rg --files frontend/src/features/reports \| rg "MetricsGlossary\|CashSessionReport\|ExecutiveReportFilters\|ReportFiltersPanel"` | OK: solo existen `ExecutiveReportFilters` y `CashSessionReportPanel`. |
| `rg -n "CashSessionReportTab\|ReportFiltersPanel\|MetricsGlossary" frontend/src docs/testing-report.md -S` | OK: sin referencias vivas fuera de pruebas de arquitectura que bloquean regresiones. |

### Decision

La trazabilidad de QA debe apuntar a archivos ejecutables actuales. Las entradas historicas del changelog se conservan como historia, pero el inventario y comandos vivos no deben sugerir rutas eliminadas.

## 381. Fase QA - Inventario sin tests saltados vivos

### Cambios

- El inventario vivo deja de listar seis `it.skip` como deuda abierta.
- Se documenta que no quedan `it.skip`, `test.skip` ni `describe.skip` en frontend o backend.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `rg -n "\b(it\|test\|describe)\.skip\b|\.skip\(" frontend/src backend/tests -S` | OK: sin resultados. |

### Decision

El registro de deuda debe reflejar el codigo actual. Mantener una deuda cerrada en el inventario final distrae del QA pendiente real: gates E2E completos, evidencia fisica/LAN cuando aplique y verificacion final de release.

## 382. Fase Permisos - AreaPolicy usa permiso gerencial vigente

### Cambios

- `AreaPolicy` deja de autorizar lectura con el permiso legado `reports.view`.
- La lectura por Gate queda alineada con `IndexAreaRequest`: `catalog.view` o `reports.managerial.view`.
- `PermissionAuditTest` cubre que un usuario solo con `reports.view` no pueda pasar `viewAny` de areas.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test tests/Feature/PermissionAuditTest.php --filter=area_policy_uses_managerial_report_permission` | RED inicial: `reports.managerial.view` no autorizaba la policy; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/ServiceCatalogTest.php --filter=area_options_are_available` | OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/PermissionAuditTest.php` | OK: 9 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Policies/AreaPolicy.php tests/Feature/PermissionAuditTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK. |

### Decision

`reports.view` puede existir como compatibilidad historica, pero no debe ser el permiso operativo para nuevas autorizaciones. Las policies deben seguir los permisos concretos que ve el administrador en la version monocomputadora.

## 383. Fase Permisos - Roles operativos sin reports.view legado

### Cambios

- `RolesAndPermissionsSeeder` conserva `reports.view` en el catalogo de permisos, pero ya no lo asigna a `supervisor` ni `auditor`.
- El comando `hospital:validation-user` ya no incluye `reports.view` en permisos exactos por defecto.
- `PermissionAuditTest` valida que roles no-admin no reciban `reports.view`.
- `ValidationUserCommandTest` valida que el usuario temporal de validacion conserve reportes concretos sin el permiso oculto legado.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test tests/Feature/PermissionAuditTest.php --filter=default_non_admin_roles_do_not_receive_legacy_reports_view` | RED inicial: `supervisor` recibia `reports.view`; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/ValidationUserCommandTest.php --filter=creates_non_admin_exact_permission_validation_user` | RED inicial: el usuario temporal recibia `reports.view`; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/PermissionAuditTest.php tests/Feature/ValidationUserCommandTest.php` | OK: 15 tests. |
| `docker compose exec backend php artisan test tests/Feature/Reports/TodayReportTest.php tests/Feature/Reports/ExecutiveReportTest.php` | OK: 22 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Console/Commands/ManageFinalValidationUserCommand.php database/seeders/RolesAndPermissionsSeeder.php tests/Feature/PermissionAuditTest.php tests/Feature/ValidationUserCommandTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK. |

### Decision

La compatibilidad historica no debe expandirse por seeders ni usuarios temporales nuevos. Para una instalacion monocomputadora, los roles predeterminados deben usar permisos concretos y visibles: reportes gerenciales, reporte de caja y exportacion.

## 384. Fase Configuracion - Fiscal no muta reglas operativas

### Cambios

- `UpdateFiscalSettingsRequest` prohibe `scanner_enabled` y `partial_payments_enabled`.
- Las reglas operativas quedan exclusivamente en `/api/settings/operational` con permiso `settings.operational.update`.
- `FiscalSettingsTest` cubre que un request fiscal con esos campos sea 422 y no audite ni mute datos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php --filter=fiscal_settings_update_rejects_operational_rule_fields` | RED inicial: el endpoint fiscal aceptaba y mutaba reglas operativas; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php --filter=operational_settings` | OK: 3 tests. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 22 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Requests/Fiscal/UpdateFiscalSettingsRequest.php tests/Feature/FiscalSettingsTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK. |

### Decision

La separacion visual de configuracion debe estar respaldada por el contrato backend. Scanner y abonos parciales pertenecen a reglas operativas, no a la actualizacion fiscal/institucional normal.

## 385. Fase Configuracion - Fiscal rechaza papel legacy

### Cambios

- `UpdateFiscalSettingsRequest` prohibe `receipt_paper_size`.
- El endpoint fiscal deja de devolver warnings, headers y metadata de cambio de papel a mitad de caja.
- El papel normal queda bajo perfiles de impresion institucionales; `fiscal_settings.receipt_paper_size` se conserva solo como fallback legacy.
- La guia de migracion documenta que clientes legacy reciben 422 y deben migrar a `/settings/institutional-receipts`.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `Get-ChildItem backend/storage/app/private/backups` | OK: existen respaldos `.sql.gz.enc` recientes antes del cambio. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php --filter=fiscal_settings_update_rejects_legacy_receipt_paper_size_field` | RED inicial: el endpoint fiscal aceptaba `receipt_paper_size`; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | OK: 19 tests. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php --filter=receipt_paper_size_uses_resolved_print_profile` | OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php tests/Feature/InstitutionalReceiptSettingsTest.php` | OK: 20 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Requests/Fiscal/UpdateFiscalSettingsRequest.php app/Http/Controllers/FiscalSettingsController.php tests/Feature/FiscalSettingsTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK. |

### Decision

El tamano de papel no debe formar parte de la configuracion fiscal normal. Para entrega monocomputadora, la UI y el contrato backend deben guiar al operador hacia perfiles institucionales simples y evitar mezclar opciones tecnicas con datos fiscales.

## 386. Fase Inicio - Acciones primarias usan rutas canonicas

### Cambios

- El Dashboard deja de abrir la factura rapida mediante estado global.
- La accion primaria `Nueva factura` navega a `/billing/new`.
- La accion primaria `Abrir caja` navega a `/cashbox`.
- `App.tsx` elimina el modal global de factura rapida; la caja compacta sigue disponible para la ruta normal de facturacion cuando se necesita abrir caja.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- DashboardView` | OK: 13 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |

### Decision

Para una instalacion monocomputadora estable, las acciones principales deben ser recuperables con refrescar/volver y tener URLs canonicas. Reducir modales globales baja estado implicito y hace mas predecibles facturacion y caja.

## 387. Fase Historial - Descargar recibo audita primera impresion

### Cambios

- `Descargar` en historial registra el primer evento de impresion institucional antes de pedir el PDF.
- La descarga usa una llave idempotente propia por recibo para evitar duplicar auditoria en reintentos.
- Despues de descargar correctamente, se invalidan auditoria y datos de facturacion para que la UI deje de tratar el recibo como primera impresion.
- El flujo no pide motivo porque la accion solo aparece cuando el recibo aun no tiene eventos de impresion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- InvoiceHistoryView -t "audits the first institutional receipt print before downloading from history"` | RED inicial: descarga no registraba evento; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView` | OK: 42 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |

### Decision

Descargar el PDF institucional es una forma real de entregar o imprimir el recibo. La trazabilidad fiscal no debe depender de que el operador use especificamente `Ver recibo`; ambos caminos deben dejar auditoria antes de exponer el documento.

## 388. Fase Respaldos - Recuperacion queda como guia de soporte

### Cambios

- `BackupsView` extrae el estado operativo y detalles de soporte a `BackupSupportStatusPanel`.
- La vista normal muestra recuperacion como guia de soporte, sin acciones de restaurar, eliminar o borrar.
- Los textos de soporte sanitizan nombres reales de respaldo, rutas locales, comandos artisan, `SQLSTATE` y secretos antes de mostrarse.
- El limite arquitectonico de `BackupsView` baja a 360 lineas para sostener la separacion entre orquestacion y presentacion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- BackupsView -t "shows recovery readiness as support guidance without exposing restore actions"` | OK: 1 test. |
| `docker compose exec frontend npm run test -- BackupsView` | OK: 37 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La version monocomputadora necesita respaldos simples y visibles, pero la recuperacion completa no debe convertirse en una accion diaria peligrosa. El operador puede crear y descargar respaldos; la restauracion queda como proceso guiado con soporte y sin exponer detalles tecnicos crudos.

## 389. Fase Caja - Resumen de cierre extraido

### Cambios

- La construccion y descarga del CSV de cierre de caja pasan a `cashCloseSummary`.
- `CloseSessionDialog` y `CashCloseSummaryPanel` comparten el mismo helper para evitar duplicacion.
- El helper queda probado de forma aislada para BOM UTF-8, valores auditables, comillas escapadas, descarga y liberacion de URL.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- cashCloseSummary` | RED inicial: modulo inexistente; luego OK: 2 tests. |
| `docker compose exec frontend npm run test -- cashCloseSummary CloseSessionDialog CashBoxView` | OK: 28 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

El cierre de caja debe seguir siendo un flujo guiado, pero la logica de archivo/exportacion no pertenece al dialogo visual. Extraerla permite probar el resumen auditable sin montar toda la UI y reduce el peso del componente critico de caja.

## 390. Fase Reportes - Caja abierta muestra efectivo esperado vivo

### Cambios

- `ExecutiveReportService` calcula `expected_cash` en sesiones abiertas como apertura + pagos en efectivo posted no anulados.
- Las sesiones cerradas conservan su snapshot `expected_amount`, `closing_amount` y `difference_amount`.
- `ExecutiveReportTest` cubre que una caja abierta pagada en efectivo aparezca con efectivo esperado vivo y sin conteo/diferencia.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php --filter=executive_cash_sessions_show_live_expected_cash_for_open_sessions` | RED inicial: devolvia `0.00`; luego OK: 1 test. |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php` | OK: 14 tests. |
| `docker compose exec backend vendor/bin/pint --test app/Actions/Reports/ExecutiveReportService.php tests/Feature/Reports/ExecutiveReportTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | OK. |

### Decision

El reporte ejecutivo debe servir durante el turno, no solo despues de cerrar caja. Para cajas abiertas, el efectivo esperado se deriva de pagos vivos; para cajas cerradas se respeta el snapshot auditado.

## 391. Fase Caja - Cierre bloquea recibos institucionales pendientes

### Cambios

- `CashSession` frontend reconoce `missing_institutional_receipt_count`.
- `CashBoxView` refresca caja antes de cerrar y bloquea el dialogo si hay facturas pagadas sin recibo institucional emitido.
- El mensaje indica al cajero generar el recibo institucional antes de cerrar, sin duplicar la logica fiscal del backend.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- CashBoxView -t "blocks close after refresh when paid invoices are missing institutional receipts"` | RED inicial: abria el dialogo; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- CashBoxView` | OK: 18 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

El backend sigue siendo la autoridad, pero la pantalla de caja debe anticipar bloqueos conocidos despues del refresco de conciliacion. Esto evita que el cajero avance hasta el dialogo de cierre para descubrir un error que ya estaba calculado por el servidor.

## 392. Fase Usuarios - Ocultar slugs tecnicos visibles

### Cambios

- `PermissionMatrix` muestra permisos por nombre humano y conserva los slugs solo como claves internas.
- `UserFormDialog` y `RoleFormDialog` dejan de imprimir slugs de permisos en las listas de seleccion, sin cambiar los valores enviados a callbacks/API.
- `UsersTable` muestra nombres humanos de roles sin exponer slugs secundarios como `catalog_manager`.
- El texto de ayuda de roles deja de presentar los nombres tecnicos como parte normal de la operacion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- PermissionMatrix UserFormDialog RoleFormDialog UsersTable` | RED inicial: 6 fallas por slugs visibles; luego OK: 43 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La administracion de usuarios necesita seguir usando permisos canonicos para seguridad y auditoria, pero la pantalla diaria no debe obligar al operador a leer identificadores tecnicos. Los componentes mantienen `permission.name` y `role.name` como datos internos, mientras la interfaz presenta nombres entendibles.

## 393. Fase Facturacion - Payload de factura extraido

### Cambios

- La construccion del payload de nueva factura pasa a `buildInvoicePayload`.
- El helper prueba que el nombre del paciente se envia trimmeado.
- La receta de dialisis se mantiene como bandera de factura y nunca como dato por item.
- `NewInvoiceView` conserva idempotencia y flujo de emision, pero reduce logica fiscal/contrato inline.
- El guard arquitectonico de `NewInvoiceView` baja de 720 a 710 lineas.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- invoicePayload` | RED inicial: modulo inexistente; luego OK: 2 tests. |
| `docker compose exec frontend npm run test -- invoicePayload NewInvoiceView` | OK: 33 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

El backend sigue siendo la fuente de verdad para totales y reglas fiscales. Aun asi, el frontend debe formar un contrato limpio: paciente obligatorio como texto normalizado, items sin banderas especiales y receta de dialisis solo como autorizacion a nivel de factura.

## 394. Fase Historial - Generar PDF audita primera impresion

### Cambios

- `Generar PDF` para facturas pagadas sin recibo institucional ahora registra `registerInstitutionalReceiptPrintEvent` antes de abrir el PDF.
- La creacion del recibo y el evento de impresion usan llaves de idempotencia separadas.
- El PDF se obtiene como blob y solo se abre despues de que la auditoria de impresion institucional fue aceptada.
- Las pruebas de historial cubren generacion pendiente, generacion con pago/caja y reintento tras fallo de creacion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- InvoiceHistoryView -t "generates a missing institutional receipt"` | RED inicial: 2 fallas por evento no registrado; luego OK: 2 tests. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView` | OK: 42 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Abrir un PDF institucional desde historial equivale operativamente a entregar o imprimir una copia. La generacion manual de un recibo faltante debe quedar trazada igual que descarga, primera impresion y reimpresion, sin mezclar la idempotencia de creacion del recibo con la del evento auditable.

## 395. Fase Reportes - Auditoria muestra numero de recibo institucional

### Cambios

- `OperationsReport.reprints` reconoce `receipt_number_full` enviado por backend.
- `ReportsAudit` usa `invoice_number`, luego `receipt_number_full`, luego `receipt_number` antes de caer al texto generico `institucional`.
- El snapshot de operaciones cubre una reimpresion institucional sin factura asociada visible.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsAudit -t "operations snapshot"` | RED inicial: mostraba `Reimpresion institucional`; luego OK: 1 test. |
| `docker compose exec frontend npm run test -- ReportsAudit` | OK: 9 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La auditoria operativa debe identificar reimpresiones institucionales con el numero real del recibo aunque no venga `invoice_number` en el registro resumido. El backend ya envia `receipt_number_full`; el frontend debe preservarlo para trazabilidad visible.

## 396. Fase Usuarios - Payload de usuario extraido

### Cambios

- La construccion del payload de crear/actualizar usuarios pasa a helpers testeados.
- Crear usuario conserva `active: true` y password inicial, mientras actualizar excluye password y estado.
- Los permisos directos solo se envian en modo avanzado y pasan por el filtro de permisos visibles.
- El guard arquitectonico de `UsersView` baja de 440 a 430 lineas.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- users-view.helpers` | RED inicial: builders inexistentes; luego cubierto por la suite focalizada. |
| `docker compose exec frontend npm run test -- users-view.helpers UsersView` | OK: 34 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La pantalla de usuarios debe seguir siendo simple para admin/cajero basico, pero el contrato enviado al backend no debe quedar armado dentro del componente principal. Extraer el payload reduce riesgo al tocar permisos exactos sin exponer permisos tecnicos ni mezclar campos de creacion con campos de edicion.

## 397. Fase Caja - Rescate de caja cerrable por supervisor

### Cambios

- `GET /api/cash-sessions/current` conserva el comportamiento de caja propia por defecto.
- `GET /api/cash-sessions/current?scope=closable` permite a usuarios con `cash.close_any` ver la caja abierta que pueden cerrar.
- El frontend distingue la cache de caja propia y caja cerrable para evitar mezclar POS con rescate supervisor.
- `cash.close_any` habilita la accion de cierre en UI sin exigir `cash.close`.
- `CashBoxView` pide `scope=closable` solo cuando recibe permiso explicito de cierre de cualquier caja.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=CloseCashSessionTest::test_close_any_user_can_request_closable_current_cash_session_without_making_pos_current_global` | RED inicial: `scope=closable` devolvia `null`; luego OK. |
| `docker compose exec backend php artisan test tests/Feature/Cash/CloseCashSessionTest.php` | OK: 6 tests, 27 assertions. |
| `docker compose exec frontend npm run test -- cash.test CashBoxView useHospitalSession` | RED inicial: 3 fallas por API sin scope, vista sin prop y permiso no derivado; luego OK: 40 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Controllers/CashSessionController.php app/Http/Requests/Cash/CurrentCashSessionRequest.php tests/Feature/Cash/CloseCashSessionTest.php` | OK. |

### Decision

En instalacion monocomputadora, una caja abierta por otro usuario no debe dejar bloqueado el puesto si el supervisor tiene permiso de rescate. El cambio limita ese alcance a cierre/auditoria: la caja ajena se puede encontrar como cerrable, pero el flujo normal de POS y facturacion sigue consultando caja propia.

## 398. Fase Recibos - Schema avanzado compartido para soporte

### Cambios

- `receiptProfileAdvancedSchema` ahora exige dimensiones compatibles con el flujo soporte: ancho 80-300 mm y alto 50-220 mm.
- El schema avanzado requiere `support_reason` de al menos 5 caracteres.
- `InstitutionalReceiptSettingsView` deja de duplicar el schema avanzado y de perfil; usa los schemas compartidos.
- El test del schema cubre que un ancho de 45 mm y un ajuste sin motivo no sean aceptados.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- receiptSettings.schema` | RED inicial: el schema aceptaba ancho 45 sin motivo; luego cubierto por suite focalizada. |
| `docker compose exec frontend npm run test -- receiptSettings.schema InstitutionalReceiptSettingsView` | OK: 27 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Los controles avanzados siguen siendo solo soporte, pero la validacion compartida no puede ser mas permisiva que la vista real. Centralizar este schema reduce el riesgo de reintroducir perfiles tecnicos pequenos o sin justificacion mientras se mantiene el flujo normal limitado a carta, media carta y A5.

## 399. Fase Navegacion - Topbar operativo compacto

### Cambios

- `OperationalStatus` deja de renderizar el reloj local como chip visible en la barra superior.
- El topbar conserva los indicadores operativos utiles: conexion LAN y estado de caja.
- `Topbar` elimina el temporizador de un minuto que solo alimentaba el reloj visible.
- Se agrega prueba focalizada para impedir que vuelva a aparecer el chip de fecha/hora en el estado operativo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- OperationalStatus` | RED inicial: el `<time>` del reloj era visible; luego cubierto por suite layout. |
| `docker compose exec frontend npm run test -- OperationalStatus AppShell` | OK: 14 tests, incluye axe del shell autenticado. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La barra superior no debe competir con la operacion diaria mostrando reloj, conexion, caja, usuario y acciones auxiliares al mismo tiempo. El reloj no decide ninguna accion critica; conexion local y caja si. Este corte reduce ruido visual sin quitar accesibilidad ni navegacion.

## 400. Fase Reportes - Eliminar paneles muertos del ejecutivo

### Cambios

- Se eliminan `CashReconciliationPanel` y su test; Caja ya vive en la subruta de reporte de caja.
- Se eliminan `VoidsReversalsPanel` y su test; Auditoria ya vive en la subruta de auditoria.
- `ReportsExecutive.test` deja de mockear componentes muertos.
- `ReportsView.architecture.test` agrega un guardrail para impedir que esos paneles vuelvan tras la consolidacion por subrutas.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- ReportsView.architecture.test.ts` | RED inicial: los archivos muertos existian; luego OK dentro de suite focalizada. |
| `docker compose exec frontend npm run test -- ReportsView.architecture.test.ts ReportsExecutive.test.tsx` | OK: 7 tests. |
| `rg -n "CashReconciliationPanel|VoidsReversalsPanel" frontend/src/features/reports` | OK: solo quedan referencias en el guardrail de arquitectura. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

La consolidacion de reportes debe dejar Ejecutivo, Caja y Auditoria con responsabilidades separadas. Mantener paneles ejecutivos viejos de caja/anulaciones confundia el inventario y prolongaba tests obsoletos. El guardrail evita que el reporte ejecutivo vuelva a absorber detalles que pertenecen a subrutas dedicadas.

## 401. Fase Respaldos - Estado del sistema sin comandos tecnicos

### Cambios

- `/api/system/status` deja de enviar `last_success_filename` en el bloque de respaldos.
- El bloque de cola ya no expone `worker_command` ni `scheduler_command`.
- `preflight.commands` sale del payload normal de estado del sistema.
- `SystemStatus` en frontend se alinea con el contrato reducido.
- Fixtures de Respaldos, Soporte y Acerca de dejan de fabricar comandos y nombres tecnicos que el navegador normal no debe recibir.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=SystemStatusTest::test_admin_can_view_operational_status_without_secret_values` | RED inicial: `last_success_filename` seguia presente; luego cubierto por suite completa. |
| `docker compose exec backend php artisan test --filter=SystemStatusTest` | OK: 24 tests, 174 assertions. |
| `docker compose exec frontend npm run test -- BackupsView.test.tsx SupportCenterView.test.tsx AboutView.test.tsx` | OK: 48 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Controllers/SystemStatusController.php tests/Feature/SystemStatusTest.php` | OK. |

### Decision

La vista normal de respaldos ya evitaba mostrar rutas, hashes y comandos, pero el endpoint de estado todavia los enviaba al navegador. Para una instalacion monocomputadora estable, el operador necesita estado y orientacion, no comandos `php artisan` ni nombres tecnicos de archivos. El soporte puede conservar runbooks fuera del payload operativo normal.

## 402. Fase Catalogo - Regla de eritropoyetina sin impuesto en actualizaciones

### Cambios

- `UpdateServiceRequest` valida el impuesto resultante cuando se asigna la regla especial de eritropoyetina.
- Un servicio normal ya no puede convertirse a eritropoyetina si conserva `taxable=true` por omitir el campo `taxable` en el payload.
- Se agrega prueba feature para cubrir la conversion desde un servicio gravado y confirmar que no persiste la regla especial.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest::test_erythropoietin_rule_requires_non_taxable_service_on_update` | RED inicial: el endpoint aceptaba la conversion con status 200; luego OK. |
| `docker compose exec backend php artisan test --filter=ServiceCatalogTest --testsuite=Feature` | OK: 43 tests, 264 assertions. |
| `docker compose exec backend vendor/bin/pint --test app/Http/Requests/Catalog/UpdateServiceRequest.php tests/Feature/ServiceCatalogTest.php` | OK. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | OK. |

### Decision

La eritropoyetina es una regla fiscal y operativa cerrada: precio fijo L.25.00, sin ISV y gratis solo al marcar receta de dialisis en facturacion. La validacion de actualizacion debe proteger el estado final completo del servicio, no solo los campos enviados por la UI.

## 403. Fase Historial - Generacion de PDF solo con acceso operativo

### Cambios

- `InvoiceHistoryTable` exige acceso operativo a la factura antes de ofrecer `Generar PDF` para recibos institucionales faltantes.
- Se agrega prueba de historial para una factura pagada ajena, sin recibo institucional, con permisos de recibo y pago pero sin alcance operativo.
- La UI deja de mostrar una accion que el backend bloquearia con 403, manteniendo el historial consistente para uso de caja.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx -t "does not offer missing receipt generation for invoices outside operational access"` | RED inicial: el menu de acciones aparecia para una factura ajena; luego OK. |
| `docker compose exec frontend npm run test -- InvoiceHistoryView.test.tsx` | OK: 43 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

El backend ya protege la emision de recibos institucionales por acceso operativo. El frontend debe reflejar esa misma regla para que el operador no vea acciones que parecen disponibles y fallan despues. En monocomputadora estable, menos acciones falsas significa menos friccion en caja e historial.

## 404. Fase Caja - Cierre guiado con diferencia viva

### Cambios

- `CashClosingPanel` deja de usar `Card` como contenedor y pasa a un panel sobrio de cierre guiado.
- El panel muestra una salida accesible `Diferencia en vivo` mientras el cajero cuenta efectivo, antes de abrir el dialogo final.
- Se conserva el flujo existente: alerta de diferencia, nota obligatoria en el dialogo, impresion/exportacion del resumen y bloqueo backend si falta motivo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx -t "shows an accessible live difference"` | RED inicial: no existia un `status` accesible nombrado para la diferencia; luego OK. |
| `docker compose exec frontend npm run test -- CashBoxView.test.tsx CloseSessionDialog.test.tsx cashCloseSummary.test.ts` | OK: 31 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |
| `docker compose exec backend php artisan test --filter=CloseCashSessionDifferenceTest` | OK: 3 tests, 11 assertions. |

### Decision

El cierre de caja debe guiar el conteo antes de pedir confirmacion. Mostrar la diferencia en vivo reduce errores operativos y evita que el cajero descubra el faltante o sobrante solo dentro del dialogo de cierre. El backend sigue siendo la defensa final para motivo obligatorio y auditoria.

## 405. Fase Usuarios - Roles personalizados criticos ocultos sin autorizacion

### Cambios

- `UserFormDialog` considera elevado cualquier rol con permisos marcados como `critical` o `risk_level=critical`.
- Los creadores de usuarios sin permiso para asignar roles administrativos ya no ven roles personalizados que incluyan accesos sensibles como descarga de respaldos.
- La regla conserva la excepcion existente para editar el rol actual de una cuenta y mantiene el flujo de confirmacion explicita para operadores autorizados.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- UserFormDialog.test.tsx -t "hides custom roles with critical permissions"` | RED inicial: `Backup Operator` aparecia en el selector; luego OK. |
| `docker compose exec frontend npm run test -- UserFormDialog.test.tsx` | OK: 19 tests. |
| `docker compose exec frontend npm run test -- UserFormDialog.test.tsx UsersView.test.tsx` | OK: 49 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Un rol personalizado puede tener nombre operativo normal pero permisos de alto impacto. La UI debe seguir la metadata de riesgo del backend, no solo nombres fijos como `admin` o `auditor`, para evitar que un operador ofrezca accesos criticos desde el formulario equivocado.

## 406. Fase Usuarios - Busqueda de permisos sin slugs tecnicos

### Cambios

- `RoleFormDialog` deja de buscar permisos por `permission.name` en el buscador normal.
- La busqueda conserva coincidencias por etiqueta visible, grupo visible y descripcion de riesgo.
- El placeholder del buscador aclara que opera sobre nombre visible, no sobre identificadores internos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `docker compose exec frontend npm run test -- RoleFormDialog.test.tsx -t "does not match technical permission slugs"` | RED inicial: `settings.operational.update` encontraba el permiso; luego OK. |
| `docker compose exec frontend npm run test -- RoleFormDialog.test.tsx` | OK: 15 tests. |
| `docker compose exec frontend npm run typecheck` | OK. |
| `docker compose exec frontend npm run lint` | OK. |

### Decision

Los permisos deben administrarse por lenguaje humano en la interfaz normal. Los slugs siguen siendo el contrato interno para enviar payloads correctos, pero no deben convertirse en una forma visible de navegar la matriz diaria de roles.

## 407. Fase Calidad - Cierre medido de rendimiento y navegador

Fecha de verificacion: 2026-07-16 (America/Tegucigalpa).

### Cambios consolidados

- El centro de soporte inicia en paralelo el resumen y el diagnostico avanzado; una prueba de concurrencia evita reintroducir la cascada de red.
- El catalogo deja de conservar un hook de detalle sin consumidores que resolvia un servicio descargando el catalogo completo.
- Los paneles de conteo y reporte de caja eliminan cinco grids Tailwind arbitrarios; el gate UI final queda sin excepciones.
- Las consultas de salud, estado, respaldos y mantenimiento comparten resultados, agregan contadores en SQL, cachean hashes de integridad y conservan retenciones por lotes con indices temporales.
- El contexto Docker medido bajo de 496.23 MiB a 58.25 KiB; la capa de permisos del backend bajo de 70.1 s a 1.1 s y la construccion completa medida quedo en 130.9 s.
- La ejecucion frontend segmentada habia reducido su referencia de 1896.3 s a 742.7 s. La corrida final tomo 832.6 s con dos pruebas adicionales; la variacion aislada no se atribuye a una regresion sin una serie comparable.

### Verificacion final de esta fase

| Gate | Resultado |
| --- | --- |
| Laravel completo | OK: 916 passed, 12 skipped justificados, 6964 assertions, 0 failures; 581.50 s. |
| Frontend completo segmentado | OK: 138/138 archivos, 1085 tests, 0 failures, 0 skipped; 832.6 s. |
| ESLint + TypeScript | OK: lint global y `tsc --noEmit`. |
| Build Vite | OK: 3979 modulos; 4.35 s. |
| Presupuesto de bundle | OK: inicio 326.7 KiB gzip (limite 488.3); total JS 1061.8 KiB gzip (limite 1074.2). |
| Reglas UI | OK: 4 archivos institucionales conformes; gate final sobre 343 archivos con 0 violaciones. |
| E2E mock oficial | OK: 49 tests Playwright, 0 fallas. Incluye factura, cobro, recuperacion tras fallo de recibo, catalogo, usuarios, historial, anulacion, reimpresion, reportes, respaldos, paginas de soporte e impresion. |
| Accesibilidad navegador | OK: 0 violaciones axe minor, moderate, serious o critical; contraste medido entre 5.47 y 16.27 en los casos que axe marco como revision incompleta por solapamiento. |
| Formatos de impresion | OK: carta, media carta, A5, 80 mm, 58 mm y personalizado; original y copias. |

Playwright no encontro su Chromium empaquetado (`chromium_headless_shell-1223`). La misma suite se ejecuto con Chrome del sistema mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; no se instalaron dependencias ni se altero el lockfile del usuario.

### Oportunidades revisadas y descartadas

| Oportunidad | Decision basada en evidencia |
| --- | --- |
| Dividir AG Grid o ECharts de nuevo | Ya son chunks asincronos de rutas que los usan. No pesan en el inicio y otra fragmentacion agrega complejidad sin mejorar el presupuesto medido. |
| Redisenar las notificaciones globales por el chunk llamado `clientIssueLog` | El contenido generado corresponde principalmente a React DOM y notificaciones de Ant Design, no al pequeno registrador de errores. Cambiar el sistema global seria de alto riesgo y no reduciria el total demostrado. |
| Cachear la respuesta completa de salud | Podria ocultar una caida reciente de base de datos. Se comparten solo sondeos costosos y se mantienen frescas las comprobaciones criticas. |
| Virtualizar todas las tablas | Las vistas operativas ya tienen paginacion o grids especializados. La virtualizacion general agregaria foco, medicion y accesibilidad complejos sin un cuello de botella reproducido. |
| Partir componentes o controladores solo por numero de lineas | El tamano aislado no demuestra latencia, defecto ni riesgo. Se mantienen extracciones con una responsabilidad o prueba concreta. |
| Optimizar busqueda del catalogo en memoria | La busqueda candidata ya ocurre en SQL y tiene cobertura con 1001 filas; no se encontro descarga completa en el flujo vivo. |
| Tratar una sola corrida frontend mas lenta como regresion | La muestra incluye dos pruebas nuevas y variacion del entorno. Se conserva la cifra como observacion, no como causa inventada. |

### Decision

Esta fase cierra los hallazgos demostrados del barrido frontend y del navegador sin declarar agotado el objetivo integral. Los siguientes ciclos deben volver a buscar evidencia accionable en dependencias, contratos operativos, observabilidad, base de datos y seguridad; una propuesta sin fallo, metrica o riesgo concreto se registra como descartada en vez de introducir complejidad especulativa.

## 408. Fase Dependencias - Una sola cadena JavaScript

### Cambios

- Se elimina la cadena Vite heredada dentro de `backend/`: manifiesto Node, configuracion, entradas CSS/JS y la vista `welcome` sin rutas consumidoras.
- `composer.json` deja de ofrecer scripts de plantilla que ejecutaban `npm`, `npx` o creaban `database.sqlite`.
- Laravel conserva las vistas PHP vivas para recibos y mantenimiento, y sigue sirviendo exclusivamente el build React de `frontend/dist`.
- El runbook de cadena de suministro declara una unica fuente de dependencias JavaScript y lock congelado en `frontend/`.
- Un contrato arquitectonico impide reintroducir una segunda toolchain o bootstrap de SQLite en produccion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `php artisan test tests/Unit/BackendFrontendBoundaryTest.php tests/Feature/ProductionSpaRouteTest.php` | OK: 8 tests, 117 assertions. |
| `vendor/bin/pint --test tests/Unit/BackendFrontendBoundaryTest.php` | OK. |
| `scripts/security/supply-chain-check.ps1 -SkipTemp` | OK: 0 hallazgos, 0 advertencias. |
| `composer validate --strict --no-check-publish` en imagen local aislada y sin red | OK: `composer.json` valido. |

### Decision

El backend no compila una interfaz propia: todas las rutas de aplicacion resuelven la SPA React y el Docker de produccion construye `frontend/`. Mantener seis dependencias Node adicionales, scripts de desarrollo incompatibles y una plantilla con enlaces externos ampliaba superficie de suministro y confusion operativa sin aportar una ruta viva.

## 409. Fase Dependencias - Herramientas Composer de plantilla retiradas

### Cambios

- Se eliminan `laravel/pail` y `laravel/sail` de desarrollo: no tenian consumidores en codigo, pruebas, CI, Docker, scripts ni runbooks.
- El lock elimina tambien `symfony/yaml`, dependencia transitiva que ninguna dependencia restante requiere para ejecucion.
- Se conserva `laravel/tinker` porque el runbook de secretos lo usa para diagnosticar la conexion local a base de datos.
- Un contrato del manifiesto evita que Pail o Sail vuelvan a ampliar silenciosamente el grafo de desarrollo.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `composer validate --strict --no-check-publish` | OK en imagen local Composer. |
| `composer install --dry-run --no-scripts` sin red | OK: lock instalable; exactamente 3 remociones sobre el `vendor` anterior. |
| `php artisan test tests/Unit/BackendDependencyManifestTest.php tests/Unit/BackendFrontendBoundaryTest.php` | OK: 3 tests, 15 assertions. |
| Pint focalizado | OK. |
| Guarda de cadena de suministro | OK: 0 hallazgos, 0 advertencias. |

### Decision

El proyecto tiene Docker Compose propio y soporte operativo dentro de la aplicacion; Sail y Pail duplicaban esas responsabilidades. La eliminacion reduce superficie de descarga y mantenimiento sin tocar paquetes productivos ni actualizar versiones ajenas.

## 410. Fase Repositorio - Parche historico redundante eliminado

### Cambios

- Se elimina `qa/production-audit/worktree_backup.diff`, objeto rastreado de 3,535,558 bytes con 233 diffs ya representados por Git, sin referencias ni uso en gates.
- La guarda pre-commit rechaza nuevos archivos `worktree_backup.diff`, `worktree-backup.diff` y sus equivalentes `.patch` en cualquier directorio.
- La prueba de la guarda crea un repositorio temporal y demuestra que el artefacto queda bloqueado con un mensaje explicativo.
- Se conservan capturas y reportes QA que si aportan evidencia visual o estructurada; esta fase no aplica una purga indiscriminada de artefactos.

### Verificacion

| Comando | Resultado |
| --- | --- |
| `scripts/test_pre_commit_guard.ps1` | RED inicial al aceptar el parche; luego OK. |
| `git diff --check` | OK. |
| Busqueda de referencias a `worktree_backup.diff` | Sin consumidores fuera del propio archivo eliminado. |

### Decision

Un volcado de worktree dentro del repositorio duplica historial, conserva texto con codificacion defectuosa y aumenta clonados y revisiones sin ser una fuente de verdad. Git y los reportes QA focalizados cubren esas responsabilidades con trazabilidad verificable.

## 411. Fase Pruebas - Cobertura aislada y ejecutable

### Cambios

- Los comandos de cobertura usan `vitest.unit.config.ts`, configuracion sin el plugin de navegador Storybook.
- El aislamiento evita que `@chromatic-com/storybook` interprete argumentos V8 y falle antes de ejecutar una prueba.
- Cobertura usa dos forks con paralelismo de archivos, el mismo maximo estable demostrado por el runner segmentado.
- Un contrato Node valida config dedicada, ausencia de imports Storybook y flags de paralelismo para ambos comandos de cobertura.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Intento inicial | Falla antes de pruebas: `CriticalPresetLoadError` de Storybook/Chromatic. |
| Filtro `--project unit` | Insuficiente: Vitest evalua el plugin Storybook antes de filtrar proyectos. |
| Config unitaria, 1 worker | Aislamiento correcto, pero excede 1200 s y el proceso se corta sin reporte. |
| Config unitaria, 2 workers | OK: 144 archivos, 1115 tests, 0 fallas; 1174.15 s Vitest / 1178.6 s total. |
| Cobertura | 83.52% lineas, 80.12% funciones, 79.09% ramas y 81.87% statements; supera 65/60/60/65. |
| Contrato del runner | OK: 6 pruebas Node. |
| TypeScript y ESLint focalizado | OK. |
| Build Storybook separado | OK: 2220 modulos; 9.11 s. |

### Oportunidad descartada

No se sube a cuatro workers: aunque el host expone 20 procesadores logicos, al decidir solo tenia 1.4 GiB de 15.7 GiB libres por procesos externos. Dos workers terminan dentro del presupuesto sin introducir una condicion de memoria fragil.

### Decision

Cobertura debe medir la suite unitaria y Storybook debe conservar su gate de navegador separado. Compartir un unico config hacia que opciones legitimas de V8 rompieran un preset no relacionado; el config dedicado convierte nuevamente el umbral en un gate reproducible y deja la cobertura global por encima del baseline historico cercano a 79%.

## 412. Fase Realtime - Un evento de pago, una reaccion

### Cambios

- `PaymentChanged` se publica en `payments` e `invoices` por compatibilidad backend; el shell deja de escuchar `payment.changed` en ambos canales.
- El frontend conserva la suscripcion semantica al canal `payments` y la suscripcion a cambios propios de factura en `invoices`.
- Una prueba del hook simula todos los canales y exige un solo toast y una sola ronda de invalidaciones por pago.
- Las pruebas cubren tambien eventos malformados, invalidacion de caja y limpieza completa de listeners/canales al desmontar.
- El manifiesto segmentado se actualiza de 138 a 139 archivos para mantener cobertura exacta sin omisiones.

### Verificacion

| Comando | Resultado |
| --- | --- |
| Prueba RED de `useBroadcastSync` | Falla: `feedback.success` recibia 2 llamadas por un pago. |
| `useBroadcastSync.test.tsx` + `echo.test.ts` | OK: 2 archivos, 6 tests. |
| TypeScript y ESLint focalizado | OK. |
| Contrato del manifiesto segmentado | OK: 139 archivos asignados exactamente una vez; 6 pruebas Node. |
| Cobertura focalizada del hook | 80.70% lineas, 92.85% funciones; antes 23.72% lineas en el reporte global. |

### Decision

El canal `invoices` se mantiene como compatibilidad del contrato backend, pero una instancia del shell no debe reaccionar dos veces al mismo evento. Escuchar pagos solo en `payments` evita toasts duplicados, tres invalidaciones redundantes adicionales y trabajo de red/cache innecesario por cada cobro o reversa.

## 413. Fase Reportes - Efectivo vivo sin N+1 de cajas

### Cambios

- El reporte ejecutivo carga hasta 50 cajas y obtiene los cobros en efectivo de todas las cajas abiertas con una sola consulta agrupada por `cash_session_id`.
- Se elimina el `SUM` individual que se ejecutaba dentro del `map` de cada caja abierta.
- Cajas cerradas conservan su snapshot `expected_amount`; cajas abiertas conservan apertura mas pagos posted en efectivo, excluyendo facturas anuladas.
- Una prueba con tres cajeros/cajas escucha SQL y prohíbe consultas `SUM` parametrizadas por cada sesion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| Prueba RED con 3 cajas abiertas | Falla: detecta 3 consultas `SUM`, una por caja. |
| Pruebas focalizadas de efectivo vivo y presupuesto | OK: 2 tests, 10 assertions. |
| `ExecutiveReportTest.php` completo | OK: 15 tests, 191 assertions. |
| Pint focalizado | OK. |
| PHPStan sobre `ExecutiveReportService` | OK. |

### Decision

El costo de mostrar cajas abiertas debe ser constante respecto al numero de sesiones incluidas. La agregacion reduce el camino de 1 + N consultas a una consulta de sesiones y una de efectivo agrupado, sin cambiar reglas contables ni snapshots de cajas cerradas.

## 414. Fase Eloquent - Carga diferida convertida en fallo temprano

### Cambios

- Eloquent bloquea lazy loading en desarrollo y pruebas; produccion conserva el comportamiento compatible para no convertir un hallazgo nuevo en una interrupcion operativa.
- Un contrato unitario verifica explicitamente ambos entornos.
- El gate completo encontro que el fixture de presupuesto de reportes cargaba servicios sin `category` ni `area`; el fixture ahora precarga ambas relaciones antes de medir consultas.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Contrato antes del cambio | RED: Eloquent permitia lazy loading fuera de produccion. |
| Primera suite Laravel completa | 917 passed, 12 skipped; 4 fallas de presupuesto reveladas por el fixture con relaciones diferidas. |
| Pruebas de presupuesto tras precarga | OK: 4 tests, 10 assertions. |
| Segunda suite Laravel completa | OK: 921 passed, 12 skipped justificados, 6979 assertions; 483.26 s. |
| Pint focalizado | OK. |

### Decision

El costo N+1 debe fallar cerca de su introduccion y no depender de que una prueba cuente consultas manualmente. El modo estricto queda fuera de produccion porque su funcion es detectar durante desarrollo; activarlo retroactivamente en el servidor hospitalario podria interrumpir una ruta no ejercitada antes de poder corregirla.

## 415. Fase Configuracion - Scheduler y respaldos seguros con cache

### Cambios

- Once lecturas `env()` ubicadas en rutas, respaldos y estado del sistema pasan a claves de `config/hospital.php` y `config/backups.php`.
- `.env.example` documenta binario de dump, ventanas operativas y las seis retenciones configurables.
- Se eliminan tres excepciones Larastan que ocultaban siete lecturas historicas; el analisis descubrio ademas cuatro lecturas nuevas que ya excedian el baseline.
- Un contrato recorre `app/` y `routes/` e impide reintroducir el helper `env()` fuera de `config/`.
- Los `getenv()` de comandos administrativos se conservan: son secretos o confirmaciones efimeras que deben leerse al ejecutar el comando, no incorporarse al cache de configuracion.

### Verificacion

| Comando | Resultado |
| --- | --- |
| PHPStan completo antes del cambio | RED: 5 errores por desajuste del baseline de `noEnvCallsOutsideOfConfig`. |
| Pruebas focalizadas | OK: 23 passed, 1 skipped justificado, 63 assertions. |
| `config:clear`, `config:cache`, `schedule:list` | OK: siete tareas registradas con horarios y retenciones esperados; cache limpiado al terminar. |
| PHPStan completo sin excepciones `env()` | OK: 0 errores. |
| Pint focalizado | OK. |

### Decision

Laravel no carga `.env` despues de cachear configuracion; por eso las tareas programadas y la deteccion de `mysqldump` deben consumir valores ya materializados por `config()`. El cambio conserva defaults y contratos operativos, elimina deuda del baseline y evita que un despliegue optimizado pierda horarios o el binario configurado.

## 416. Fase Pagos - Centavos no nulos sin compatibilidad muerta

### Cambios

- `RegisterPaymentAction` consume directamente `balance_due_cents` y `paid_amount_cents`, columnas enteras que la migracion rellena y convierte a `NOT NULL`.
- Se eliminan dos resolutores privados y sus conversiones decimales inalcanzables.
- El baseline PHPStan pierde cuatro supresiones: dos comparaciones siempre verdaderas y dos retornos inalcanzables.
- Un contrato impide que el alta de pagos vuelva a convertir saldos historicos desde decimal o a ocultar el contrato no nulo.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Contrato antes del cambio | RED: el action aun delegaba a resolutores con `Money::parseCents`. |
| Guardas monetarias + action + doble pago | OK: 19 tests, 189 assertions. |
| PHPStan focalizado | OK: 0 errores. |
| Pint focalizado | OK. |

### Decision

La migracion de centavos ya hizo obligatorias ambas columnas y los contratos SQL prohiben recomputarlas desde decimal. Mantener una ruta alternativa imposible agregaba complejidad en facturacion y obligaba a ocultar codigo muerto; la lectura directa alinea implementacion, esquema, tipos y pruebas sin cambiar calculos ni estados.

## 417. Fase Reportes - Prorrateo operativo enteramente en centavos

### Cambios

- El resumen de cajeros del reporte operativo suma `invoice_items.line_total_cents` y divide contra `invoices.total_cents` al filtrar por categoria o area.
- Se eliminan dos reconstrucciones con `Money::parseCents` desde snapshots decimales.
- La guarda monetaria incorpora explicitamente `OperationsReportService` y exige las columnas enteras en el prorrateo.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Contrato antes del cambio | RED: no encontraba `line_total_cents` y detectaba conversiones desde decimal. |
| Reporte operativo + guarda monetaria | OK: 8 tests, 108 assertions. |
| PHPStan focalizado | OK: 0 errores. |
| Pint focalizado | OK. |

### Decision

Los filtros de categoria y area distribuyen cada pago proporcionalmente entre items. Ejecutar ese calculo con los snapshots enteros obligatorios evita volver a interpretar strings decimales en memoria y mantiene la misma regla de redondeo `intdiv` ya cubierta para pagos parciales.

## 418. Fase Analisis Estatico - Baseline exacto y relaciones obligatorias

### Cambios

- `Invoice::voidedBy` y las relaciones de `Payment` declaran sus tipos reales; `invoice`, `cashSession` y `user` son obligatorias, mientras `voidedBy` permanece nullable.
- Reportes y recibos dejan de aplicar nullsafe a relaciones respaldadas por claves foraneas no nulas.
- `OperationsReportService` pasa de cinco errores actuales sin baseline a cero mediante tipos de modelo y eliminacion de condiciones imposibles.
- El baseline PHPStan se regenera desde cero: baja de 105 supresiones rastreadas a 51 errores reales y elimina 404 lineas residuales.
- `reportUnmatchedIgnoredErrors` queda activo para que una supresion obsoleta falle el gate en el mismo cambio que la vuelve innecesaria.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan de `OperationsReportService` sin baseline, antes | 5 errores: relaciones genericas y nullsafe incorrecto. |
| PHPStan del servicio sin baseline, despues | OK: 0 errores. |
| Baseline temporal completo desde cero | 51 errores actuales frente a 105 supresiones rastreadas. |
| PHPStan completo con baseline exacto y coincidencia estricta | OK: 0 errores. |
| Reportes operativos, recibos institucionales y caja | OK: 47 tests, 474 assertions. |
| Pint focalizado | OK. |

### Decision

Un baseline solo es util si expresa deuda actual. Permitir entradas sin correspondencia habia conservado mensajes de versiones y tipos antiguos, ocultando progreso y haciendo costoso revisar el archivo mas concentrado. Las relaciones se tipan en los modelos, fuente comun para todos los consumidores, y el gate estricto evita que esta deriva reaparezca.

## 419. Fase Reversas - Reconciliacion directa sobre centavos obligatorios

### Cambios

- `VoidPaymentAction` suma `amount_cents` sin un predicado `IS NOT NULL` imposible y toma `invoices.total_cents` directamente.
- Se elimina el resolutor decimal heredado y la coalescencia redundante del motivo ya validado por contrato.
- La guarda monetaria exige que las anulaciones no reintroduzcan conversiones decimales ni filtros de nulabilidad.
- El baseline estricto baja de 51 a 48 errores al retirar tres supresiones de codigo imposible.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Contrato antes del cambio | RED: detecta resolutor decimal, `whereNotNull` y ausencia de lectura directa. |
| Guarda monetaria + doble pago | OK: 16 tests, 201 assertions. |
| Reversas en caja y recibos | OK: 4 tests, 96 assertions. |
| PHPStan completo estricto | OK: 0 errores. |
| Pint focalizado | OK. |

### Decision

La anulacion recalcula el saldo dentro de una transaccion y debe usar la misma fuente entera obligatoria que el alta de pagos. Eliminar la compatibilidad inalcanzable reduce bifurcaciones en un flujo auditado sin cambiar estados, redondeo, movimientos de caja ni restricciones sobre sesiones cerradas.

## 420. Fase Contratos - Exportador OpenAPI sobre una coleccion iterable

### Cambios

- `OpenApiExporter` itera el arreglo devuelto por `RouteCollectionInterface::getRoutes()` en vez de asumir que la propia interfaz es `Traversable`.
- Se elimina la unica supresion `foreach.nonIterable`; el baseline estricto baja de 48 a 47 errores.
- El documento generado, autenticacion, filtros, tags y bloques de respuesta conservan su cobertura funcional.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar la supresion | RED: `foreach.nonIterable` en la coleccion de rutas. |
| `OpenApiExporterTest.php` | OK: 11 tests, 114 assertions. |
| PHPStan focalizado | OK: 0 errores. |
| PHPStan completo con baseline estricto | OK: 0 errores; 47 errores aplazados exactos. |
| Pint focalizado | OK. |

### Oportunidad descartada

No se hicieron obligatorias las relaciones `Service::category` dentro del calculador puro. Aunque `services.category_id` es `NOT NULL` en base de datos, cinco pruebas unitarias ejercitan deliberadamente reglas monetarias con modelos en memoria sin relaciones. Eliminar el nullsafe rompio 5 pruebas de 17; conservar dos supresiones documenta una limitacion de inferencia sin acoplar el calculador a persistencia.

### Decision

La interfaz de rutas garantiza el metodo que devuelve `Route[]`, no la iterabilidad del contenedor. Consumir ese contrato explicito evita depender de detalles de la implementacion concreta de Laravel y mantiene portable el exportador sin casts, anotaciones locales ni nuevas excepciones.

## 421. Fase Seguridad Frontend - Cache publica sin datos de sesion

### Cambios

- El service worker deja pasar sin intercepcion cualquier ruta `/api/` o `/sanctum/`; no puede guardar ni reproducir respuestas autenticadas.
- La cache se limita a assets publicos explicitamente permitidos: chunks bajo `/assets/`, iconos y manifiesto.
- Las navegaciones usan red con timeout y solo caen al shell publico `/`; la respuesta HTML obtenida durante la sesion no se persiste.
- La version de cache sube de `s-hospital-v1` a `s-hospital-v2`, eliminando almacenes anteriores durante `activate`.
- El precache deja de solicitar `/login` y `/dashboard`; ambas rutas devolvian el mismo shell y ampliaban trabajo sin aportar un fallback distinto.
- El manifiesto segmentado reconoce 140 archivos Vitest, uno mas por el contrato de seguridad.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Contrato de seguridad antes del cambio | RED: 2/2 fallas; faltaba exclusion Sanctum y API usaba `networkFirst`. |
| Contrato unitario despues | OK: 2 tests. |
| ESLint focalizado + contrato segmentado | OK: 6 pruebas Node; 140 archivos cubiertos exactamente una vez. |
| Build de produccion | OK: TypeScript + Vite, 3979 modulos; `dist/sw.js` contiene la politica endurecida. |
| E2E PWA focalizado con Chrome del sistema | OK: 2 tests de manifiesto y artefacto service worker; 6.0 s. |

### Decision

El modo offline del hospital significa operar sin internet, no sin el servidor LAN ni con datos financieros historicos en el navegador. El backend ya prohibe cachear JSON con PII; una Cache API manual puede ignorar esa intencion. Limitar el worker al shell y assets publicos conserva una pantalla de fallback sin cruzar datos entre cajeros, sesiones o pacientes.

## 422. Fase Catalogo - Filtros estables durante la busqueda diferida

### Cambios

- La escritura diferida de `q` deja de reconstruir la URL desde la instantanea capturada al iniciar el temporizador.
- Una referencia sincronizada conserva los parametros mas recientes y se actualiza de forma optimista antes de cada navegacion interna del catalogo.
- Cambiar categoria, estado, pagina o panel confirma en la misma URL el texto local pendiente; la sincronizacion inversa ya no puede vaciar la busqueda antes de completar el debounce.
- Limpiar filtros y aplicar parches de URL parten de la referencia mas reciente, evitando que dos controles cercanos restauren valores anteriores.
- Se elimina la supresion de `react-hooks/exhaustive-deps`; el efecto depende solo del texto porque sus colaboradores variables se leen mediante referencias estables.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Regresion antes del cambio | RED: al escribir `glucosa` y elegir `Laboratorio` durante el debounce, la URL perdia `category=7` o restablecia `q` a vacio segun el orden de confirmacion. |
| Regresion focalizada despues | OK: conserva simultaneamente `q=glucosa` y `category=7`. |
| Suite `CatalogView.test.tsx` | OK: 22 tests. |
| ESLint focalizado | OK: componente y prueba sin advertencias ni supresion del hook. |
| TypeScript estricto | OK: `tsc --noEmit`. |

### Decision

El texto local, el texto diferido y los parametros de URL son estados deliberadamente distintos durante 400 ms. Toda accion adicional del operador debe consolidarlos antes de navegar; leer la URL viva en el temporizador evita que una escritura tardia deshaga filtros ya confirmados sin eliminar el debounce que protege al servidor LAN.

## 423. Fase Analisis Estatico - Lista de migraciones sin reindexado redundante

### Cambios

- `SystemStatusController::migrationFileNames()` devuelve directamente la lista que `array_map()` crea y `sort()` mantiene con indices consecutivos.
- Se elimina la excepcion `arrayValues.list` asociada del baseline PHPStan.
- El baseline estricto baja de 47 a 46 errores contabilizados, distribuidos en 43 entradas exactas.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo la excepcion | RED: `arrayValues.list` en `SystemStatusController.php:435`. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline; baseline exacto de 46. |
| `SystemStatusTest.php` | OK: 26 tests, 181 assertions. |
| Pint focalizado | OK. |

### Decision

PHPStan ya conoce `$migrations` como `list<string>` y `sort()` conserva esa forma. El `array_values()` final no reparaba indices ni reforzaba el contrato; retirarlo simplifica la ruta de diagnostico y reduce una excepcion sin cambiar el JSON operativo.

## 424. Fase Autorizacion - Usuario estable al consultar detalle de factura

### Cambios

- `ShowInvoiceRequest::authorize()` resuelve al usuario autenticado una sola vez.
- El request exige explicitamente una instancia de `App\Models\User` antes de consultar permisos, alcance historico o propiedad de la factura.
- Las comprobaciones posteriores reutilizan esa instancia no nullable y eliminan el ultimo acceso nullsafe del request.
- Se retira una excepcion `nullsafe.neverNull`; el baseline PHPStan baja de 46 a 45 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo la excepcion | RED: `nullsafe.neverNull` en `ShowInvoiceRequest.php:27`. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| `InvoiceHistoryReprintVoidTest.php` | OK: 22 tests, 135 assertions. |
| Pint focalizado | OK. |

### Decision

La autorizacion no necesita resolver tres veces al principal de la solicitud. Validar una sola instancia hace explicita la rama anonima, evita que permiso, alcance y propietario dependan de lecturas separadas y alinea el contrato de ejecucion con el tipo que PHPStan ya inferia despues del primer control.

## 425. Fase Autorizacion - Principal unico en reportes de caja y PDF

### Cambios

- `ShowCashSessionReportRequest` resuelve una sola vez al usuario y reutiliza la misma instancia para permisos gerenciales, permiso de caja y propiedad de la sesion.
- `PdfExportRequest` aplica el mismo contrato tanto en `authorize()` como al restringir filtros de un reporte no gerencial.
- `authorizedReportFilters()` rechaza explicitamente una invocacion sin usuario antes de consultar sesiones o fijar `user_id`.
- Se retiran cinco excepciones `nullsafe.neverNull`; el baseline PHPStan baja de 45 a 40 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 5 errores `nullsafe.neverNull`, tres en PDF y dos en reporte de caja. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Regresion de reportes focalizada | OK: 5 tests, 56 assertions; cubre permisos, propiedad, cierre diario y rango normalizado por sesion. |
| Pint focalizado | OK. |

### Decision

Permisos y propiedad deben evaluarse sobre el mismo principal autenticado. La consolidacion elimina lecturas redundantes del resolver de usuario y hace imposible continuar hacia filtros o consultas de caja con un principal nulo, sin ampliar el alcance de cajeros ni alterar la capacidad gerencial.

## 426. Fase Observabilidad - Agregado de almacenamiento con fila garantizada

### Cambios

- `OperationalMetricsService::storage()` accede directamente a la fila devuelta por `COUNT(*)` y `COALESCE(SUM(...), 0)`.
- Se conserva el fallback de cada columna y el `catch` que degrada el sondeo ante un fallo real de base de datos.
- Se retiran dos excepciones `nullsafe.neverNull`; el baseline PHPStan baja de 40 a 38 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 2 errores `nullsafe.neverNull` en las columnas agregadas. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| `OperationalMetricsServiceTest.php` | OK: 17 tests, 72 assertions. |
| Pint focalizado | OK. |

### Decision

Una consulta SQL sin `GROUP BY` que selecciona agregados siempre produce una fila, incluso sin respaldos. `COUNT` y `COALESCE(SUM)` fijan ambos valores; la ausencia de fila no era un estado operativo posible, mientras que errores de conexion o esquema siguen cubiertos por la degradacion segura existente.

## 427. Fase Contratos De Reportes - Filtro de area declarado

### Cambios

- Los contratos de `CategoryReportService::report()` y `ServiceSalesReportService::report()` incluyen `area_id?: int` en la forma de filtros.
- La anotacion queda alineada con `DateRangeReportRequest`, el SQL que filtra snapshots de `invoice_items` y los otros servicios de reportes.
- Se retiran seis excepciones de offsets inexistentes; el baseline PHPStan baja de 38 a 32 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 6 errores (`empty.offset`, `offsetAccess.notFound` y `nullCoalesce.offset`) en los dos servicios. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Filtros integrados de reportes | OK: 1 test, 49 assertions sobre ingresos, categorias, servicios, areas y operaciones. |
| Pint focalizado | OK. |

### Decision

`area_id` no era una clave accidental: llega desde el Form Request, limita los snapshots historicos y se devuelve en la metadata. Corregir la forma declarada permite que PHPStan verifique ese recorrido y evita que futuras refactorizaciones eliminen silenciosamente un filtro soportado.

## 428. Fase Reportes Financieros - Filas agregadas fuera de modelos Eloquent

### Cambios

- Las proyecciones agregadas de pagos en `FinancialFactsService` pasan a Query Builder mediante `toBase()` antes de seleccionar `payment_count`, `collected_cents` y totales por metodo.
- Las filas SQL dejan de representarse falsamente como modelos `Payment` con propiedades dinamicas inexistentes.
- `forRange()` consume directamente las claves obligatorias declaradas por `paymentFacts()`.
- Se retiran siete excepciones (`property.notFound`, `nullsafe.neverNull` y `nullCoalesce.offset`); el baseline PHPStan baja de 32 a 25 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 7 errores sobre propiedades agregadas y claves obligatorias. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Hechos financieros + guardas SQL de centavos | OK: 14 tests, 242 assertions. |
| Pint focalizado | OK. |

### Decision

Una fila de `COUNT`/`SUM` no es una entidad `Payment` y no debe heredar su contrato de modelo. Cambiar solo la capa de hidratacion conserva joins, filtros y SQL, mejora la precision del analisis estatico y evita legitimar propiedades dinamicas en el dominio financiero.

## 429. Fase Conciliacion De Caja - Agregados sin modelos dinamicos

### Cambios

- Los totales por metodo y el resumen de facturas pendientes de `BuildCashReconciliationAction` pasan a Query Builder antes de hidratar filas agregadas.
- `payments_count`, `invoice_count` y `total_cents` dejan de interpretarse como propiedades dinamicas de `Payment` o `Invoice`.
- La fila agregada de pendientes se consume directamente, manteniendo fallback por columna.
- Se retiran cinco excepciones `property.notFound`/`nullsafe.neverNull`; el baseline PHPStan baja de 25 a 20 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 5 errores sobre filas agregadas de conciliacion. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Conciliacion operativa focalizada | OK: 2 tests, 28 assertions; incluye pagos por metodo y saldo parcial entre sesiones. |
| Guarda monetaria SQL | OK: 9 tests, 162 assertions. |
| Pint focalizado | OK. |

### Decision

La conciliacion necesita modelos Eloquent para construir alcances, pero sus resultados agrupados son filas SQL. Cambiar la hidratacion despues de definir filtros conserva el comportamiento y hace explicito el limite entre entidades persistidas y proyecciones financieras calculadas.

## 430. Fase Reportes Diario Y Mensual - Estados agregados como filas SQL

### Cambios

- Los totales diarios por metodo y por estado pasan a Query Builder antes de hidratar sus agrupaciones.
- El resumen mensual por estado aplica el mismo limite entre consulta Eloquent y proyeccion agregada.
- `count` y `total_cents` dejan de modelarse como propiedades dinamicas de `Invoice` o `Payment`.
- Se retiran tres excepciones `property.notFound`; el baseline PHPStan baja de 20 a 17 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 3 errores de propiedades agregadas en reportes diario y mensual. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Regresion diaria/mensual | OK: 3 tests, 58 assertions; incluye metodos, estados, dias y anulacion en mes posterior. |
| Pint focalizado | OK. |

### Decision

Los modelos siguen construyendo los alcances temporales y de estado, pero una fila agrupada no representa una factura ni un pago individual. `toBase()` en el punto de hidratacion expresa esa diferencia sin duplicar consultas ni modificar las fechas contables.

## 431. Fase Dashboard - Proyecciones agregadas como filas SQL

### Cambios

- Los totales diarios por metodo, servicios principales y resumen de cajeros pasan a Query Builder antes de hidratar sus resultados.
- Las columnas calculadas `total_cents`, `payment_count` y `collected_cents`, junto con los alias de usuario, dejan de interpretarse como propiedades dinamicas de `Payment` o `InvoiceItem`.
- Se retiran siete excepciones `property.notFound`/`argument.unresolvableType`; el baseline PHPStan baja de 17 a 10 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 7 errores sobre propiedades agregadas y el tipo generico de la coleccion. |
| PHPStan estricto despues | OK: 0 errores fuera del baseline. |
| Contrato JSON del dashboard | OK: 1 test, 8 assertions sobre metodos y resumen de cajero. |
| Presupuesto de reportes | OK: 4 tests, 10 assertions; incluye dashboard, reporte diario y consistencia financiera. |
| Guarda monetaria SQL | OK: 9 tests, 162 assertions. |
| Pint focalizado | OK. |

### Decision

El dashboard usa modelos para construir filtros y joins, pero sus agrupaciones representan proyecciones de lectura. Cambiar la hidratacion justo antes de `get()` conserva el SQL y el comportamiento, evita fabricar atributos de dominio y permite que PHPStan compruebe los callbacks sobre filas SQL reales.

## 432. Fase Recibos - Emisor validado como usuario

### Cambios

- `GenerateReceiptDataAction` valida que la relacion cargada `issuer` sea un `User` antes de usar su nombre como respaldo del cajero.
- Una factura con relacion corrupta ahora falla con una excepcion explicita y legible, en lugar de acceder a una propiedad sobre un modelo generico.
- La seleccion del ultimo pago publicado y la prioridad del cobrador sobre el emisor permanecen intactas.
- Se retira una excepcion `property.notFound`; el baseline PHPStan baja de 10 a 9 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo la excepcion | RED: 1 error al acceder a `name` sobre la relacion `issuer` inferida como `Model`. |
| PHPStan focalizado y completo despues | OK: 0 errores fuera del baseline. |
| Recibo con emisor y cobrador distintos | OK: 1 test, 7 assertions; el cajero impreso sigue siendo quien registro el pago. |
| Pint focalizado | OK. |

### Decision

El emisor es obligatorio para la trazabilidad de una factura. Expresar y comprobar esa invariante en el limite de generacion del recibo mejora el fallo ante datos inconsistentes y elimina la dependencia de una propiedad dinamica sin agregar consultas ni alterar el formato institucional.

## 433. Fase Anulaciones - Conteo de pagos como estado transaccional

### Cambios

- `VoidInvoiceAction` deja de agregar `posted_payments_count` como atributo dinamico de la factura.
- Despues de bloquear la factura, la accion cuenta los pagos publicados y conserva el resultado en un entero explicito.
- El mismo conteo alimenta la regla que bloquea la anulacion y la evidencia del intento fallido en auditoria.
- `hasPaymentState()` recibe el conteo como parte de su contrato, sin consultar propiedades sinteticas.
- Se retira la ultima excepcion `property.notFound`; el baseline PHPStan baja de 9 a 8 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo la excepcion | RED: 1 error al leer `posted_payments_count` como propiedad de `Invoice`. |
| PHPStan completo despues | OK: 0 errores fuera del baseline. |
| Anulaciones con estado de pago | OK: 3 tests, 25 assertions; bloquea pago vigente, permite tras reversa y revalida dentro de la transaccion. |
| Pint focalizado | OK. |

### Decision

El flujo de registro de pagos tambien bloquea la factura. Contar despues de adquirir ese bloqueo hace explicito el momento de consistencia: un pago ya confirmado se observa y uno concurrente debe esperar, volver a cargar la factura y rechazarla si ya fue anulada. El cambio elimina un atributo Eloquent temporal y conserva la auditoria con un valor escalar estable.

## 434. Fase Facturacion - Configuracion fiscal opcional explicita

### Cambios

- `CreateInvoiceAction` usa `firstOrNew()` para representar una configuracion fiscal ausente con un modelo en memoria no persistido.
- Los snapshots hospitalarios leen el objeto garantizado y conservan `null` cuando los campos no fueron configurados.
- Permanecen los defaults operativos: ISV 15%, plantilla institucional y papel media carta cuando tampoco se resuelve un perfil de impresion.
- Se agrega una regresion que crea una factura sin fila de configuracion y comprueba que el fallback no inserta una automaticamente.
- Se retiran tres excepciones `nullsafe.neverNull`; el baseline PHPStan baja de 8 a 5 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 3 errores en tasa, plantilla y ubicacion con acceso nullsafe. |
| PHPStan completo despues | OK: 0 errores fuera del baseline. |
| Creacion y defaults de factura | OK: 3 tests, 21 assertions; cubre configuracion normal, ausente y perfil de impresion. |
| Pint focalizado | OK. |

### Decision

La ausencia temporal de configuracion es un estado valido durante una instalacion nueva, pero no requiere propagar `null` como tipo de objeto. `firstOrNew()` conserva los valores ausentes y evita escrituras implicitas, mientras permite que todo el snapshot se construya sobre un contrato estable y verificable.

## 435. Fase Exportes Y Licencia - Identidad institucional opcional

### Cambios

- Los dos generadores Excel y `LicenseHelper` representan la ausencia de configuracion fiscal con `firstOrNew()`.
- Nombre institucional y RTN se leen desde un objeto garantizado, conservando los fallbacks `Hospital General San Isidro` y `N/A` para una instalacion aun no configurada.
- No se crea ni modifica ninguna fila de configuracion durante exportacion o validacion local.
- Se retiran tres excepciones `nullsafe.neverNull`; el baseline PHPStan baja de 5 a 2 errores contabilizados.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 3 errores en el acceso nullsafe al RTN. |
| PHPStan completo despues | OK: 0 errores fuera del baseline. |
| Licencia local y archivo firmado | OK: 8 tests, 25 assertions. |
| Exportacion XLSX con agregados reales | OK: 1 test, 11 assertions. |
| Pint focalizado | OK. |

### Decision

Estos consumidores solo necesitan una vista de lectura de la identidad institucional. Un modelo nuevo no persistido expresa mejor la ausencia que un objeto nullable, preserva los textos de respaldo y unifica el contrato ya comprobado en la creacion de facturas.

## 436. Fase Totales - Relaciones opcionales y baseline PHPStan cero

### Cambios

- `CalculateInvoiceTotalsAction` conserva categoria y area en variables antes de resolver sus nombres.
- La categoria ausente mantiene snapshot vacio; el area ausente sigue heredando el nombre de categoria.
- Se retiran las dos ultimas excepciones `nullsafe.neverNull`.
- Al quedar en cero, se elimina `phpstan-baseline.neon` y su inclusion desde la configuracion principal.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan tras retirar solo las excepciones | RED: 2 errores en los accesos nullsafe a nombres de categoria y area. |
| PHPStan con baseline vacio | OK: 0 errores. |
| PHPStan despues de eliminar baseline e include | OK: 0 errores. |
| Totales e eritropoyetina | OK: 17 tests, 73 assertions. |
| Snapshots historicos de catalogo | OK: 2 tests, 13 assertions. |
| Pint focalizado | OK. |

### Decision

Las relaciones son opcionales en los objetos de prueba y el area tambien lo es en el esquema. Las comprobaciones explicitas representan esos estados sin confundir al analizador. El proyecto ya no necesita excepciones de analisis estatico: cualquier hallazgo nuevo de PHPStan volvera a ser visible de inmediato.

## 437. Fase Exportes - Generador Excel legado eliminado

### Cambios

- Se elimina `ExcelReportService`, un generador de 507 lineas sin consumidores, registros de contenedor ni referencias en rutas.
- `ReportController` ya usa de forma exclusiva `PremiumExcelExportService`, que contiene el flujo vigente de filtros, lectura financiera, caja y auditoria.
- No se cambian endpoints, contratos ni dependencias de PhpSpreadsheet.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda de referencias posterior | OK: ninguna referencia a `ExcelReportService`. |
| PHPStan sin baseline | OK: 0 errores. |
| Exportaciones XLSX vigentes | OK: 3 tests, 51 assertions; cubre permisos, lectura financiera y ocultamiento de auditoria. |
| Diff check | OK. |

### Decision

Mantener dos implementaciones completas para el mismo artefacto ampliaba la superficie de mantenimiento y permitia que correcciones futuras llegaran al generador equivocado. Eliminar la clase inalcanzable reduce codigo de produccion sin alterar el servicio activo.

## 438. Fase Soporte Frontend - Registrador duplicado eliminado

### Cambios

- Se eliminan `clientIssueLogger.ts` y `errorCatalog.ts`, modulos sin importaciones de produccion.
- Se elimina el test exclusivo del catalogo inalcanzable.
- Permanece `clientIssueLog.ts`, que es el contrato usado por el cliente API, `AppErrorBoundary`, ayuda, configuracion y respaldos.
- El endpoint backend de errores del cliente no cambia.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda global previa | `clientIssueLogger` sin importaciones; `errorCatalog` solo era consumido por ese modulo y su test. |
| TypeScript estricto | OK. |
| ESLint completo | OK. |
| Registro local y limite global de errores | OK: 2 archivos, 7 tests. |
| Diff check | OK. |

### Decision

Habia dos funciones `logClientIssue` con politicas distintas de almacenamiento, mensajes y sanitizacion, pero solo una era alcanzable. Retirar la rama muerta evita que futuras correcciones de seguridad se apliquen al registrador equivocado y reduce la superficie de mantenimiento sin cambiar el flujo del operador.

## 439. Fase Areas - Controlador legado inalcanzable eliminado

### Cambios

- Se elimina `AreaPaidServiceController`, que no tenia ruta, importacion ni registro en el contenedor.
- El permiso `area_services.view` y el rol `usuario_area` ya estaban retirados de los seeders finales.
- El endpoint historico `/api/area-services/paid` permanece deliberadamente inexistente.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda global previa | Clase presente solo en su propio archivo; sin ruta ni consumidor frontend. |
| PHPStan sin baseline | OK: 0 errores. |
| Alcance legado retirado | OK: 1 test, 3 assertions; permiso y rol ausentes, endpoint 404. |
| Inventario de rutas por `area-services` | OK: ninguna ruta coincidente. |

### Decision

El propio contrato de la version final exige que este alcance no exista. Conservar un controlador completo y autorizacion a un permiso retirado solo dejaba una superficie latente que podia reactivarse por error. Su eliminacion alinea codigo y rutas con la prueba vigente.

## 440. Fase Idempotencia - Modelo historico sin consumidor eliminado

### Cambios

- Se elimina el modelo Eloquent `OperationIdempotencyKey`, que no tenia referencias fuera de su propio archivo.
- La tabla historica `operation_idempotency_keys`, su migracion y su poda permanecen para compatibilidad y retencion operativa.
- El middleware vigente continua usando `idempotency_keys` con payload cifrado y reservas por usuario/ruta.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda global posterior | OK: ninguna referencia a `OperationIdempotencyKey`. |
| PHPStan sin baseline | OK: 0 errores. |
| Idempotencia y poda | OK: 15 tests, 118 assertions; incluye replay, cifrado, conflictos, indices y retencion. |

### Decision

La tabla no puede eliminarse de una instalacion existente sin una migracion de retiro y una decision de retencion, pero el modelo nunca participaba en esos flujos. Retirar solo la envoltura inalcanzable reduce superficie PHP sin alterar datos, indices ni tareas programadas.

## 441. Fase Componentes Frontend - Piezas inalcanzables eliminadas

### Cambios

- Se eliminan `AppBreadcrumbs` e `InstitutionalStatus`, componentes sin importaciones, reexportaciones ni pruebas.
- Se conserva `BackupExplanationCard.tsx`: su nombre de archivo parecia candidato, pero su export `BackupEmptyState` si es consumido por `BackupsView`.
- No se cambia navegacion, shell, estados visibles ni contratos del design system activo.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Inventario de simbolos | Solo los dos componentes eliminados carecian de consumidores; el falso positivo de respaldos fue descartado. |
| TypeScript estricto | OK. |
| ESLint completo | OK. |
| Build Vite de produccion | OK: 3979 modulos transformados. |

### Decision

El build no reduce su tamano porque los modulos ya eran descartados por tree-shaking. La mejora es de claridad: desaparecen APIs visuales alternativas que podian recibir trabajo futuro sin llegar nunca a la interfaz real.

## 442. Fase Recibos Frontend - Esquemas no consumidos retirados

### Cambios

- `receiptSettings.schema.ts` conserva solo `receiptProfileSchema` y `ReceiptProfileForm`, los contratos usados por la pantalla activa.
- Se eliminan los esquemas y tipos institucionales/de serie que no tenian imports, formularios ni tests consumidores.
- No cambia la validacion del perfil normal de papel, copias, logo y sello.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda de simbolos | Solo `receiptProfileSchema` y `ReceiptProfileForm` tenian consumidores. |
| TypeScript estricto | OK. |
| ESLint completo | OK. |
| Pantalla de configuracion de recibos | OK: 1 archivo, 33 tests. |
| Build Vite | OK; chunk baja de 42.43 a 41.10 kB raw y de 12.16 a 11.87 kB gzip. |

### Decision

Los constructores Zod se ejecutaban al cargar el modulo aunque esos formularios ya no existian. Retirar sus contratos muertos reduce trabajo y bytes de la ruta administrativa, y evita mantener reglas frontend paralelas a validaciones backend que no tienen interfaz activa.

## 443. Fase Dashboard - Contrato de setup unificado

### Cambios

- `DashboardView` importa `SetupStatus` desde `SetupWizardDialog`, modulo que ya exportaba la misma forma.
- Se elimina `dashboardTypes.ts`.
- Desaparecen cuatro contratos visuales sin consumidor: estados/tarjeta de seccion, siguiente accion y contexto de metricas.
- El import es solo de tipo y no agrega dependencia JavaScript en ejecucion.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Busqueda de simbolos | `SetupStatus` era el unico export consumido de `dashboardTypes.ts`; ya existia duplicado en el asistente. |
| TypeScript estricto | OK. |
| ESLint completo | OK. |
| Dashboard y asistente de setup | OK: 2 archivos, 41 tests. |

### Decision

Dos definiciones identicas del estado de instalacion podian divergir ante un campo nuevo del backend. Mantener una sola forma junto al flujo que representa reduce deuda de tipos y deja al dashboard dependiente del mismo contrato que su dialogo operativo.

## 444. Fase TypeScript - Codigo no usado convertido en error

### Cambios

- Se habilitan `noUnusedLocals` y `noUnusedParameters` en el contrato TypeScript del frontend.
- Se retiran los imports por defecto de React que el runtime JSX moderno ya no necesita en `UserMenu` y `CommandPalette`.
- El quality gate permanente ahora rechaza imports, variables, parametros y declaraciones sin uso.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion inicial con ambas reglas | RED controlado: 2 imports de React sin uso. |
| TypeScript con reglas persistentes | OK: 0 errores. |
| ESLint completo | OK. |
| Build Vite de produccion | OK: 3979 modulos transformados. |

### Decision

La medicion estricta encontro solo dos residuos mecanicos, por lo que activar las reglas no exige excepciones ni una migracion gradual. El beneficio principal no es el tamano del bundle, donde el tree-shaking ya retiraba esos imports, sino prevenir nueva superficie muerta durante el desarrollo.

## 445. Fase PHPStan 6 - Contratos del usuario

### Cambios

- `User::serviceArea()` declara su retorno nativo y los modelos participantes de la relacion `BelongsTo`.
- Las sobrescrituras `hasPermissionTo()` y `checkPermissionTo()` documentan el mismo dominio aceptado por Spatie: nombre, id, contrato de permiso o enum respaldado, con guard opcional.
- Se conservan las firmas PHP sin estrechar parametros heredados, evitando romper compatibilidad con el trait de permisos.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan nivel 6 sobre `User` | OK: 0 errores. |
| Pint sobre `User` | OK. |
| Auth, roles y gestion de usuarios | OK: 77 tests, 350 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 213 a 208 hallazgos. |

### Decision

Los tipos agregados describen contratos reales del framework y del paquete de permisos; no son supresiones. Esto permite que el analizador siga el modelo relacionado y valide cada uso de permisos sin cambiar autorizacion ni comportamiento en ejecucion.

## 446. Fase PHPStan 6 - Relaciones de factura

### Cambios

- Las cuatro relaciones de coleccion de `Invoice` declaran su modelo relacionado y el modelo que las origina.
- Las relaciones con emisor, anulador, caja y secuencia fiscal declaran los dos parametros genericos de `BelongsTo`.
- No cambian filtros, orden, claves foraneas ni consultas SQL.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan nivel 6 sobre `Invoice` | OK: 0 errores. |
| Pint sobre `Invoice` | OK. |
| Creacion, cobro, recibos, historial, anulacion y reversa | OK: 112 tests, 852 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 208 a 200 hallazgos. |

### Decision

`Invoice` concentra relaciones usadas por casi todo el dominio financiero. Precisarlas permite detectar asociaciones equivocadas en servicios y controladores sin alterar el modelo persistido; las pruebas transaccionales confirman que el contrato agregado coincide con el comportamiento real.

## 447. Fase PHPStan 6 - Trazabilidad de partidas y pagos

### Cambios

- `InvoiceItem` tipa sus relaciones con factura, servicio y area de catalogo.
- `Payment` tipa sus relaciones con factura, sesion de caja, cajero y usuario anulador.
- Los siete contratos declaran tanto el modelo relacionado como el modelo propietario de la relacion.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| PHPStan nivel 6 sobre ambos modelos | OK: 0 errores. |
| Pint sobre ambos modelos | OK. |
| Registro/anulacion de pagos e integridad de partidas | OK: 9 tests, 38 assertions; 1 test MySQL omitido en SQLite por condicion explicita preexistente. |
| Inventario PHPStan nivel 6 global | Baja de 200 a 193 hallazgos. |

### Decision

Estas relaciones forman la trazabilidad monetaria desde una partida hasta el cobro y la caja. Tiparlas fortalece la comprobacion de consultas y servicios financieros sin tocar importes, estados, snapshots ni reglas de anulacion.

## 448. Fase PHPStan 6 - Contratos del catalogo

### Cambios

- `Service`, `Category`, `Area` y `ServiceArea` tipan sus relaciones con servicios, categorias, areas, historiales de precio y partidas facturadas.
- `Service` y `Category` enlazan `HasFactory` con sus factories concretas.
- `ServiceArea` pierde `HasFactory`: no existe factory para ese modelo ni habia consumidores de `ServiceArea::factory()`.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 10 contratos genericos incompletos. |
| PHPStan nivel 6 sobre los cuatro modelos | OK: 0 errores. |
| Pint sobre los cuatro modelos | OK. |
| Catalogo, cambios de precio y retiro del alcance legado | OK: 51 tests, 293 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 193 a 183 hallazgos. |

### Decision

El tipado conserva las relaciones que usa facturacion y permite seguir el historial de precios con modelos concretos. Retirar el trait inoperante de `ServiceArea` evita anunciar una API de factories que Laravel no podia resolver porque nunca tuvo implementacion.

## 449. Fase PHPStan 6 - Relaciones de recibos institucionales

### Cambios

- `InstitutionalReceipt` tipa sus relaciones con factura, pago, caja, serie, emisor, anulador, perfil y eventos de impresion.
- La serie, los eventos, los perfiles y sus asignaciones tipan las relaciones inversas y los usuarios auditores.
- Los 18 contratos declaran modelos relacionados y propietarios sin cambiar claves, filtros ni persistencia.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 18 genericos incompletos. |
| PHPStan nivel 6 sobre los cinco modelos | OK: 0 errores. |
| Pint sobre los cinco modelos | OK. |
| Emision, numeracion, configuracion, perfiles y pagos | OK: 53 tests, 361 assertions; 1 guard exclusivo de MySQL omitido explicitamente en SQLite. |
| Inventario PHPStan nivel 6 global | Baja de 183 a 165 hallazgos. |

### Decision

El recibo institucional es el documento principal del sistema y cruza facturacion, caja, usuarios e impresion. Precisar todas sus relaciones fortalece el analisis de esa trazabilidad completa sin modificar numeracion, snapshots, autorizacion ni reglas de anulacion.

## 450. Fase PHPStan 6 - Relaciones del agregado de caja

### Cambios

- `CashRegisterSession` tipa cajero, usuario de cierre, pagos y movimientos.
- `CashMovement` tipa sesion, pago asociado y usuario responsable.
- Se conservan claves explicitas, reglas de inmutabilidad y consultas de conciliacion.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 7 genericos incompletos. |
| PHPStan nivel 6 sobre ambos modelos | OK: 0 errores. |
| Pint sobre ambos modelos | OK. |
| Apertura, cobros, conciliacion, cierre e inmutabilidad | OK: 53 tests, 477 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 165 a 158 hallazgos. |

### Decision

La caja es el limite transaccional que enlaza usuario, pagos y movimientos. Sus relaciones explicitas permiten que el analizador detecte cruces de modelo incorrectos sin tocar importes, bloqueos, cierres ni auditoria historica.

## 451. Fase PHPStan 6 - Historial de precios tipado

### Cambios

- `ServicePriceHistory` declara el servicio afectado y el usuario responsable de cada cambio.
- Se conservan la clave `changed_by`, los casts monetarios y la fecha efectiva.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 2 genericos incompletos. |
| PHPStan nivel 6 sobre el modelo | OK: 0 errores. |
| Pint sobre el modelo | OK. |
| Cambio de precio, motivo y auditoria | OK: 7 tests, 26 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 158 a 156 hallazgos. |

### Decision

El historial preserva quien cambio cada precio y a que servicio pertenece. Tipar ambos extremos permite validar esa trazabilidad sin modificar importes, motivos ni reglas de auditoria.

## 452. Fase PHPStan 6 - Registros operativos tipados

### Cambios

- `AuditLog`, `ClientErrorLog` y `BackupLog` declaran sus relaciones con el usuario responsable.
- El accessor cifrado de `IdempotencyKey` declara que lee y acepta `string|null`.
- No cambian cifrado, sanitizacion, retencion, inmutabilidad ni visibilidad de datos internos.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 4 genericos incompletos. |
| PHPStan nivel 6 sobre los cuatro modelos | OK: 0 errores. |
| Pint sobre los cuatro modelos | OK. |
| Auditoria, errores, idempotencia y backups | OK: 52 tests, 292 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 156 a 152 hallazgos. |

### Decision

Estos registros sostienen recuperacion y evidencia forense. Precisar usuarios y el tipo del payload descifrado mejora la comprobacion estatica de operaciones sensibles sin ensanchar la informacion expuesta ni alterar el formato persistido.

## 453. Fase PHPStan 6 - Respuestas de exportacion tipadas

### Cambios

- `ReportController::pdfExport()` y `executivePdf()` declaran `Illuminate\Http\Response`.
- `executiveExcel()` declara `Symfony\Component\HttpFoundation\StreamedResponse`, igual que la exportacion XLSX general.
- No cambian contenido, cabeceras, filenames ni estrategia de streaming.

### Verificacion

| Evidencia | Resultado |
| --- | --- |
| Medicion PHPStan nivel 6 inicial del corte | RED controlado: 3 retornos ausentes. |
| PHPStan nivel 6 sobre el controlador | OK: 0 errores. |
| Pint sobre el controlador | OK. |
| Reportes, permisos, PDF y XLSX | OK: 73 tests, 976 assertions. |
| Inventario PHPStan nivel 6 global | Baja de 152 a 149 hallazgos. |

### Decision

Las descargas son una frontera HTTP publica y deben anunciar si entregan una respuesta materializada o transmitida. Los retornos concretos permiten verificar middleware y consumidores sin modificar bytes, seguridad ni memoria de las exportaciones.
