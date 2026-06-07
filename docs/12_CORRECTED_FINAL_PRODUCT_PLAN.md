# 12 Corrected Final Product Plan

Fecha: 2026-05-17

## Resumen ejecutivo

El sistema esta tecnicamente avanzado: backend, auth, roles, catalogo, facturacion, caja, pagos, recibos, historial, reportes, backups y validaciones ya existen.

La UX/UI sigue bloqueada como producto institucional. El problema no es solo compilar: el producto debe sentirse como sistema hospitalario profesional de caja. Una sola experiencia larga o pantallas con controles manuales inconsistentes quedan prohibidas para cierre final.

La revision con seis roles queda en estado **BLOQUEADO**. No se debe declarar Fase 12 terminada hasta cerrar los bloqueos de seguridad, AppShell, POS/caja, arquitectura visual, reportes y QA.

## Diagnostico actual

- AppShell, sidebar, topbar y rutas existen, pero la topbar no muestra fecha/hora local ni estado servidor/LAN de forma visible.
- En pantallas pequenas el sidebar puede ocupar una pantalla completa antes del contenido operativo.
- Muchos errores viven solo en `onStatus`/footer y no aparecen inline donde ocurren.
- La UI mezcla componentes base con HTML manual y clases globales por modulo.
- POS ya evita lista completa de 122 servicios, pero el flujo emitir/cobrar sigue partido y sin confirmacion critica.
- Caja permite cierre directo sin dialogo de arqueo/confirmacion reforzada.
- Reportes todavia no cubren anulaciones, reimpresiones, backups, filtros completos ni exportacion autorizada.
- QA E2E esta basado en mocks para validacion controlada; falta gate real separado contra Laravel/API y consola limpia.
- Seguridad encontro un bloqueo: pagos pueden operar sobre facturas ajenas por ID si el usuario conoce el identificador.

## Suposiciones explicitas

- Produccion sigue siendo offline LAN, sin SaaS obligatorio.
- Backend sigue siendo la fuente de verdad para precios, impuestos, reglas fiscales, pagos, caja, anulacion, reimpresion y backups.
- Las mejoras grandes se trabajan por ramas `codex/*` y PR.
- No se empuja directo a `main` salvo hotfix explicito.
- Cada fase debe ser pequena, verificable y commiteable.
- Las features nuevas o riesgosas quedan apagadas por defecto o protegidas por permisos/allowlist cuando aplique.

## Preguntas bloqueantes

No hay preguntas que impidan planificar. Hay una decision de negocio que debe resolverse durante 12B:

- Si `Emitir sin cobrar` es permitido, debe quedar como accion secundaria explicita y auditada.
- Si no es permitido para caja, el flujo principal debe ser `Cobrar y emitir` con caja abierta obligatoria.

Mientras no se decida, el supuesto seguro es: **el camino principal del POS exige caja abierta y cobra/emite con confirmacion; emitir pendiente queda secundario y visible solo si permiso/regla lo permite**.

## Arquitectura propuesta

### Frontend

- Mantener React Router y `AppShell`.
- Extraer auth/caja/permisos desde `App.tsx` hacia providers/hooks:
  - `AuthProvider`
  - `CashSessionProvider`
  - `usePermissions`
- Consolidar componentes reutilizables antes de redisenar pantallas:
  - `DataTable`
  - `MetricCard`
  - `FilterBar`
  - `FormField`
  - `ConfirmDialog`
  - `Toast/InlineAlert`
  - `SegmentedControl` o tabs
  - `TableState` para loading/empty/error
- Reducir CSS global a tokens, layout general y estilos de impresion institucional. Las pantallas deben usar componentes, no clases artesanales por modulo.
- Mantener reglas de impresion para media carta, carta y A5 como formatos institucionales vigentes.

### Backend

- Agregar guard/policy central para alcance operativo de factura:
  - Cajero: solo factura propia del dia para cobrar/listar pagos, salvo permiso superior.
  - Supervisor/admin: acceso ampliado por permiso explicito.
- Separar permisos de reportes:
  - `reports.managerial.view` para reportes gerenciales.
  - `reports.cash_session.view` para caja propia o reporte limitado.
  - `reports.export` para exportacion.
- Reportes avanzados se calculan en backend. El frontend no suma hechos financieros como autoridad.

## Fases corregidas

### 12A0 Seguridad de pagos y permisos de reportes

Alcance:

- Bloquear pago/listado de pagos sobre facturas ajenas por ID.
- Centralizar autorizacion de acceso operativo a factura.
- Separar o endurecer permisos de reportes gerenciales.
- Documentar matriz final en `docs/DECISIONS.md`.

Archivos esperados:

- `backend/app/Policies` o servicio/trait de autorizacion.
- `backend/app/Http/Controllers/PaymentController.php`
- `backend/app/Actions/Payments/RegisterPaymentAction.php`
- `backend/app/Http/Requests/Reports/*`
- `backend/database/seeders/RolesAndPermissionsSeeder.php`
- `backend/tests/Feature/CashPaymentsReceiptTest.php`
- `backend/tests/Feature/ReportsTest.php`
- `docs/DECISIONS.md`

Migraciones:

- No esperadas salvo que se creen permisos nuevos con migracion/seed controlado.

Pruebas:

- Cajero A no puede cobrar factura de Cajero B.
- Cajero A no puede listar pagos de factura ajena.
- Cajero no accede reportes gerenciales aunque tenga permiso de caja propia.
- Admin/supervisor autorizado conserva acceso segun matriz.

Riesgos:

- Romper flujos existentes de historial/pago si se duplica logica de autorizacion.

Criterios de aceptacion:

- P0 de seguridad cerrado con pruebas.
- Backend sigue decidiendo integridad de factura/caja/pago.
- Matriz de permisos documentada.

Commit sugerido:

- `fix(payments): enforce invoice access scope`

### 12A AppShell y design system consistente

Alcance:

- Topbar con usuario, rol, caja, fecha/hora local y estado servidor/LAN visible.
- Layout responsive que no entierre contenido en tablet/movil.
- Sistema de alertas inline/toast para errores operativos.
- Componentes UI reutilizables minimos.
- Reducir CSS artesanal por modulo.

Archivos esperados:

- `frontend/src/layout/AppShell.tsx`
- `frontend/src/components/ui/*`
- `frontend/src/hooks/useClock.ts`
- `frontend/src/hooks/useServerStatus.ts`
- `frontend/src/styles.css`
- `frontend/src/App.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/App.test.tsx`

Migraciones:

- Ninguna.

Pruebas:

- Render de shell con sidebar/topbar.
- Permisos ocultan navegacion no autorizada.
- Estado servidor/LAN visible.
- Error inline visible en modulo, no solo footer.
- Build frontend.

Riesgos:

- Cambios visuales amplios pueden romper pantallas existentes si no se hace por componentes.

Criterios de aceptacion:

- App no se percibe como pagina interminable.
- Todas las pantallas principales comparten componentes base.
- Confirmaciones y errores tienen ubicacion visible.

Commit sugerido:

- `feat(ui): harden app shell and design system`

### 12B POS y caja profesional

Alcance:

- Flujo principal de POS: buscar/filtrar/escanear, carrito fijo, confirmar, cobrar/emitir, recibo.
- ConfirmDialog antes de emitir, cobrar y cerrar caja.
- CTA claro para abrir caja desde POS cuando no hay caja abierta.
- `Cobrar y emitir` como camino principal; `Emitir pendiente` secundario si se permite.
- Cierre de caja con esperado, contado, diferencia, movimientos y confirmacion reforzada.

Archivos esperados:

- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/cash/CashBoxView.tsx`
- `frontend/src/features/receipts/ReceiptPreview.tsx`
- `frontend/src/components/ui/confirm-dialog.tsx`
- `frontend/src/components/ui/inline-alert.tsx`
- `frontend/src/App.test.tsx` o tests de feature.
- Tests backend existentes de caja/pagos.

Migraciones:

- Ninguna esperada.

Pruebas:

- Paciente requerido enfoca campo y muestra error inline.
- Buscar por nombre/categoria/identificador no muestra lista interminable.
- Confirmar y cancelar emision no crean factura al cancelar.
- Sin caja abierta, POS muestra accion directa a caja.
- Registrar pago genera recibo.
- Cerrar caja exige confirmacion y nota si hay diferencia.

Riesgos:

- Confundir factura pendiente vs cobrada si la UI no separa intenciones.

Criterios de aceptacion:

- Cajero no recorre 122 servicios.
- Acciones criticas tienen confirmacion profesional.
- Caja, pago y recibo se sienten como flujo unico.

Commit sugerido:

- `feat(billing): guide pos billing and cash confirmation`

### 12C Catalogo, identificadores y tablas administrativas

Alcance:

- Catalogo con `DataTable`, filtros, paginacion, busqueda, estado e identificador.
- Administrar categorias, servicios, precios, activo/inactivo e identificadores tecnicos de servicio.
- Mantener regla Eritropoyetina.
- Validar UI de inactivo/identificador inexistente con error claro.

Archivos esperados:

- `frontend/src/features/catalog/CatalogView.tsx`
- `frontend/src/components/ui/data-table.tsx`
- `frontend/src/components/ui/filter-bar.tsx`
- `backend/app/Http/Controllers/ServiceController.php`
- `backend/tests/Feature/ServiceCatalogTest.php`

Migraciones:

- Solo si falta soporte de identificador. En el estado actual ya existen los campos tecnicos requeridos.

Pruebas:

- Identificador existente agrega servicio activo.
- Identificador inexistente muestra error claro.
- Servicio inactivo no se factura.
- Precio se toma de backend al emitir.
- Edicion de servicio no cambia snapshots historicos.

Riesgos:

- Convertir catalogo en CRUD decorativo sin mejorar operacion POS.

Criterios de aceptacion:

- Catalogo se siente administrativo profesional.
- Tabla pagina 10/15/25.
- Formularios y errores usan componentes compartidos.

Commit sugerido:

- `feat(catalog): polish service codes and admin tables`

### 12D Reportes gerenciales avanzados

Alcance:

- Dashboard gerencial con KPIs de rango.
- Filtros por fecha, cajero, categoria, metodo, estado y caja.
- Ingresos por metodo, categoria, servicios top, caja por cajero.
- Facturas anuladas con motivo/usuario/fecha.
- Reimpresiones con usuario/factura/fecha.
- Backups ejecutados/fallidos/ultima verificacion.
- Exportacion CSV con permiso `reports.export`.
- Tablas con ordenamiento/paginacion o DataTable equivalente.

Archivos esperados:

- `backend/app/Http/Controllers/ReportController.php`
- `backend/app/Actions/Reports/*`
- `backend/app/Http/Requests/Reports/*`
- `backend/tests/Feature/ReportsTest.php`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/components/ui/data-table.tsx`
- `frontend/src/lib/api.ts`

Migraciones:

- No esperadas salvo indices nuevos para rendimiento.

Pruebas:

- Backend calcula KPIs y no trae todo al frontend para sumar.
- Filtros aplican consistentemente en ingresos/categorias/servicios.
- Export CSV exige permiso.
- Anulaciones/reimpresiones/backups aparecen en reportes.
- Graficos/tablas renderizan con estados vacios.

Riesgos:

- `reports.view` amplio puede exponer data gerencial a cajeros.
- Reportes sin indices pueden degradar LAN local con datos reales.

Criterios de aceptacion:

- Reportes sirven para administracion real, no validacion basica.
- No hay totales financieros autoritativos calculados solo en frontend.

Commit sugerido:

- `feat(reports): add managerial analytics and exports`

### 12E QA visual, consola limpia y entrega institucional

Alcance:

- Separar gates:
  - E2E en ambiente controlado de validacion.
  - Smoke real contra Laravel/API.
- Browser smoke con consola limpia.
- Validar rutas: dashboard, POS, caja, catalogo, historial, reportes, backups, fiscal.
- Validar estados: loading, empty, error, permission denied, mobile/tablet, textos largos.
- Actualizar worklogs y QA con evidencia honesta.

Archivos esperados:

- `frontend/e2e/production-readiness.spec.ts`
- `frontend/playwright.config.ts`
- `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`
- `qa/RELEASE_READINESS.md`
- `docs/LOCAL_VALIDATION_SCRIPT.md`
- `worklogs/*`

Migraciones:

- Ninguna.

Pruebas:

- `php artisan test --colors=never`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `php artisan config:cache`
- E2E en ambiente controlado sin console errors.
- Smoke real `/up`, `/login`, `/verify-email` y rutas principales.

Riesgos:

- E2E en ambiente controlado puede dar falsa confianza si no se separa del smoke real.

Criterios de aceptacion:

- Cero errores de consola en flujo principal.
- Flujo completo probado: login, dashboard, nueva factura, busqueda/identificador, paciente requerido, confirmar, cobrar, recibo, imprimir solo recibo, historial, reimprimir, anular si aplica, reportes, exportar, backups.
- Subagentes no bloquean cierre.

Commit sugerido:

- `test(ux): add final product smoke gates`

## Plan de commits

1. `fix(payments): enforce invoice access scope`
2. `feat(ui): harden app shell and design system`
3. `feat(billing): guide pos billing and cash confirmation`
4. `feat(catalog): polish service codes and admin tables`
5. `feat(reports): add managerial analytics and exports`
6. `test(ux): add final product smoke gates`

## Quality gate por fase

Minimo por fase:

```bash
cd backend
php artisan test --colors=never
php artisan config:cache
```

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

Cierre final:

```bash
cd frontend
npm run e2e
```

Smoke deploy/local:

```bash
curl http://localhost/up
curl http://localhost/login
curl http://localhost/verify-email
```

## Decision de revision del plan

Decision actual: **BLOQUEADO**.

Bloqueantes que deben resolverse antes de declarar Fase 12 aprobada:

- P0 pagos sobre facturas ajenas por ID.
- P0 reportes avanzados incompletos.
- P1 AppShell/topbar/responsive/error placement.
- P1 POS/caja sin confirmaciones criticas.
- P1 CSS/componentes manuales dominan pantallas.
- P1 QA sin consola limpia ni smoke real separado.

## Checklist de entrada a implementacion

- Trabajar en rama `codex/*`.
- No mezclar fases en un commit gigante.
- Empezar por 12A0 seguridad.
- Ejecutar revision con maximo seis subagentes por ciclo.
- No cerrar fase si cualquier subagente devuelve BLOQUEADO.
- Documentar decisiones importantes en `docs/DECISIONS.md`.
