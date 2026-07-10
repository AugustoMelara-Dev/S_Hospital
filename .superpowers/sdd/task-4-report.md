# Task 4 — Entrada operativa clínica

## Estado

Completada. Login, cambio obligatorio de contraseña, estados globales e Inicio fueron recompuestos con jerarquía clínica, acciones reales, permisos sin huecos y operación offline LAN preservada.

Commit: `feat(dashboard): create clinical operational entry points` (este reporte forma parte del mismo commit; el hash se registra al finalizar la tarea).

## Archivos

### Creados

- `frontend/src/design-system/patterns/RouteState.tsx`
- `frontend/src/design-system/patterns/RouteState.test.tsx`
- `frontend/src/features/auth/PasswordChangeView.test.tsx`
- `frontend/src/features/dashboard/components/OperationalQueue.tsx`
- `frontend/src/features/dashboard/components/TodayLedger.tsx`

### Modificados

- `frontend/src/features/auth/LoginView.tsx`
- `frontend/src/features/auth/LoginView.test.tsx`
- `frontend/src/features/auth/PasswordChangeView.tsx`
- `frontend/src/features/dashboard/DashboardView.tsx`
- `frontend/src/features/dashboard/DashboardView.test.tsx`
- `frontend/src/components/AppErrorBoundary.tsx`
- `frontend/src/components/AppErrorBoundary.test.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/AppRoutes.lazy.test.ts`

`LoginView.a11y.test.tsx` se ejecutó sin requerir modificaciones.

## Evidencia TDD RED/GREEN

1. `RouteState`:
   - RED: `npm run test -- src/design-system/patterns/RouteState.test.tsx` terminó exit 1 porque Vite no podía resolver `./RouteState`.
   - GREEN inicial: 8/8; error con `role=alert`, loading con `role=status`, detalle progresivo, acción y enlace real.
   - RED/GREEN de auto-revisión: una acción sin `href` ni handler se renderizaba como botón deshabilitado; el test falló primero y pasó tras omitirla.
2. Login:
   - RED: 2/13 fallaron porque no existía aviso Caps Lock y la identidad hospitalaria aparecía tres veces.
   - GREEN: 16/16 entre pruebas funcionales y a11y; countdown 60/900 s y bloqueo de submit preservados.
3. Cambio de contraseña:
   - RED: 2/4 fallaron por requisitos sin tildes/Card contenedora y mismatch sin tilde.
   - GREEN: 4/4; requisitos previos, mismatch, submit válido y axe.
4. Dashboard:
   - RED inicial: 2/15 fallaron porque faltaban `Continuar operación` y el ledger; `StatGrid` seguía presente.
   - GREEN: 15/15 con `TodayLedger`, `OperationalQueue`, CTA única, setup/caja/pendientes priorizados y módulos recompuestos por permiso.
   - RED/GREEN de auto-revisión: el rol no gerencial aún veía la columna `Total` y `L 115.00` en recientes; el test falló primero y pasó al condicionar esa columna.
5. Error global y 404:
   - RED: 2/4 fallaron porque ambos conservaban composición legacy/Card.
   - GREEN: 4/4 usando `RouteState`, con logging, recarga, Ayuda e Inicio preservados.

## Gates finales frescos

- Tests dirigidos exactos del brief:
  - Exit 0; 7 archivos pasaron; 48 tests pasaron; 0 fallaron.
  - Wall time: 12.5 s; duración Vitest: 9.42 s.
- Axe:
  - Incluido en `RouteState.test.tsx`, `LoginView.a11y.test.tsx` y `PasswordChangeView.test.tsx`.
  - Sin violaciones.
- Typecheck:
  - `npm run typecheck`
  - Exit 0; `tsc --noEmit`; 18.5 s.
- Lint:
  - `npm run lint -- --quiet`
  - Exit 0; 0 errores y 0 warnings; 18.6 s.
- Whitespace:
  - `git diff --check`
  - Exit 0; sin salida.

## Auto-revisión

- Login expone una sola identidad, formulario primero en móvil, labels persistentes, autocomplete, mostrar/ocultar y aviso Caps Lock descrito para tecnología asistiva.
- PasswordChange no usa Card, presenta requisitos antes de los tres campos y conserva RHF/Zod como fuente de validación.
- Dashboard tiene una CTA dominante; las acciones secundarias son enlaces reales.
- Sin permiso gerencial no se solicita el reporte, no se renderiza ledger, cifras ni columna Total, y no queda espacio reservado.
- Sin permiso de facturas no se solicita ni renderiza actividad reciente.
- `RouteState` no crea botones sin handler ni enlaces sin `href`; denied no inventa rutas para pedir permisos.
- Loading usa geometría con `motion-reduce:animate-none`; controles y enlaces operativos mantienen targets mínimos de 44 px.
- Clases `min-w-0`, padding fluido, columnas con `minmax(0, ...)` y ausencia de anchos rígidos evitan overflow conceptual a 320/768/1366 px.
- No se agregaron dependencias, assets remotos, contratos API nuevos, lorem, TODO ni servicios de internet.
- Strings nuevas usan UTF-8 y tildes correctas.

## Warnings y preocupaciones

- Tests, axe, typecheck, lint y diff-check: cero warnings finales.
- `@testing-library/user-event` no está instalado; se usó `fireEvent` existente sin agregar una dependencia por conveniencia.
- No se ejecutó suite total ni navegador, por instrucción. La revisión responsive fue conceptual mediante clases y assertions DOM/a11y; queda pendiente verificación visual manual en 320/768/1366 px dentro de una fase autorizada.

## Correcciones posteriores al review

Se atendieron los seis hallazgos del review sin cambiar contratos backend, permisos ni rutas operativas.

### RED

- `RouteState.test.tsx`: 12 tests ejecutados; 3 fallaron porque `headingLevel` se ignoraba, dos estados del mismo tipo duplicaban el ID y la acción conservaba `min-h-10`.
- `AppRoutes.lazy.test.ts`: 3 tests ejecutados; el caso 404 real falló porque `NotFoundView` no estaba exportado y React recibió un componente `undefined`.
- `DashboardView.test.tsx`: 20 tests ejecutados; 6 fallaron por las razones esperadas:
  - el error del reporte seguía usando h1 y llamando `onStatus`;
  - el ledger anunciaba ceros durante loading/error;
  - el error de facturas recientes se convertía en vacío y no tenía retry;
  - setup no dominaba la CTA ni abría el wizard;
  - sin permiso fiscal faltaba explicación y seguía visible la CTA operativa;
  - `Ver historial completo` bajaba a 36 px desde `sm`.

### GREEN

- `RouteState` acepta `headingLevel` 1/2/3 con default 1, usa `useId` para `aria-labelledby` únicos y fuerza acciones de 44 px.
- Los dos errores contextuales del Dashboard usan h2, manteniendo `Continuar operación` como único h1.
- El error del resumen solo se presenta inline; no se propaga a `onStatus` ni genera toast duplicado.
- Ledger diferencia loading, dato desconocido y cero real mediante valores/notas explícitos.
- `recentInvoicesError` es independiente de `recentInvoices=[]`; el error contextual conserva detalle seguro y retry real.
- `needs_setup` elimina Nueva factura/Abrir caja. Con permiso fiscal, `Completar configuración` abre el `SetupWizardDialog` existente para Hospital, Numeración y Catálogo; sin permiso, explica que debe intervenir un administrador y no ofrece edición.
- Se eliminó el enlace fijo `/settings/fiscal` del setup incompleto.
- `Ver historial completo` conserva `min-h-11` también desde `sm`.
- El 404 se renderiza realmente dentro de `MemoryRouter` y verifica el enlace canónico `/dashboard`.

### Gates frescos posteriores al review

- Tests dirigidos: exit 0; 7 archivos pasaron; 56 tests pasaron; 0 fallaron; 12.7 s wall time.
- A11y: incluido en los tests dirigidos; axe sin violaciones.
- `npm run typecheck`: exit 0; 19.9 s.
- `npm run lint -- --quiet`: exit 0; 0 errores y 0 warnings; 20.8 s.
- `git diff --check`: exit 0; sin salida.
- Suite total y navegador visual no ejecutados, según instrucción.

## Segunda corrección posterior al review

Se cerraron los hallazgos de permisos reales, setup universal, wizard responsive, wildcard integrado y cache degradado.

### RED

- `useHospitalSession.test.tsx`: 1/6 falló porque `catalog.manage` no derivaba `canManageCatalog`; `canEditFiscalSettings` ya se derivaba correctamente de `settings.fiscal.update`.
- `SetupWizardDialog.test.tsx`: 3/3 fallaron por stepper en fila rígida con separadores, botones sin `min-h-11` y uso de pulse/spin/bounce/transition-width.
- `DashboardView.test.tsx`: 7/25 fallaron por:
  - cache del reporte presentado sin marca de antigüedad;
  - setup-status omitido para cajeros sin permisos fiscales/gerenciales;
  - permiso view-only tratado como permiso de escritura;
  - ausencia de rutas específicas para solo fiscal o solo catálogo;
  - wizard no derivado de ambas capacidades;
  - `Facturación disponible` coexistiendo con setup incompleto.
- `AppRoutes.lazy.test.ts`: 1/4 falló porque AppRoutes no entregaba las dos capacidades de escritura al Dashboard.
- Test dirigido de `App.test.tsx`: falló porque App no propagaba `session.canManageCatalog`.
- El nuevo montaje wildcard de `AppRoutes` completo pasó desde su primera ejecución: el comportamiento ya era correcto; el hallazgo era una deficiencia del test aislado anterior.

### GREEN

- `useHospitalSession` deriva y expone `canManageCatalog` sin mezclarlo con `catalog.view`; también cuenta como permiso operativo real.
- App y AppRoutes propagan `canEditFiscalSettings` y `canManageCatalog` hasta Dashboard.
- Dashboard consulta `/api/system/setup-status` para cualquier usuario que llegue a Inicio, incluido cajero sin permisos fiscales o gerenciales.
- La acción setup se deriva de pasos y capacidades:
  - fiscal + catálogo pendientes y ambas capacidades: wizard;
  - solo fiscal pendiente con edición: `/settings/fiscal`;
  - solo catálogo pendiente con gestión: `/catalog`;
  - sin capacidad suficiente o view-only: explicación sin CTA.
- La queue no agrega `Facturación disponible` mientras `needs_setup` es verdadero.
- SetupWizard usa grid responsive de 2 columnas y 4 desde `sm`, sin separadores rígidos; sus seis botones usan `min-h-11`; se eliminaron pulse/spin/bounce y transition-width.
- El wildcard se prueba montando `AppRoutes` completo en `MemoryRouter` con `/ruta/desconocida`, verificando heading y enlace `/dashboard`.
- Con error y datos cacheados, las tres notas financieras dicen `Último dato conocido`; los valores dejan de presentarse como actuales.
- El primer gate amplio detectó tres expectativas legacy en `App.test.tsx` para títulos previos a Task 4. Se alinearon con `Iniciar sesión` y `Continuar operación`; no requirió cambios de producción.

### Gates frescos de la segunda corrección

- Tests dirigidos: exit 0; 10 archivos pasaron; 91 tests pasaron; 0 fallaron; 22.6 s wall time.
- Axe: incluido en el gate dirigido; sin violaciones.
- `npm run typecheck`: exit 0; 19.1 s.
- `npm run lint -- --quiet`: exit 0; 0 errores y 0 warnings; 18.8 s.
- Búsqueda de motion/layout prohibido en SetupWizard: 0 coincidencias.
- `git diff --check`: sin errores de whitespace; se repite aislado antes del amend.
- Git emitió reiteradamente `frontend/src/App.tsx: CRLF will be replaced by LF the next time Git touches it` durante inspecciones de diff/staging. No es un error funcional, de typecheck ni de lint.
- Suite total y navegador visual no ejecutados, según instrucción.

## Tercera corrección posterior al review

Se cerraron los hallazgos restantes de capability efectiva, recuperación del administrador, estados de `setup-status`, datos cacheados y targets táctiles del wizard.

### RED

- Gate focal de 3 archivos: 39 tests ejecutados; 11 fallaron por los motivos esperados.
- `DashboardView.test.tsx` expuso que:
  - escritura sin lectura todavía habilitaba rutas fiscal/catálogo o el wizard;
  - `admin_exists: false` no dominaba el flujo ni derivaba a un técnico autorizado;
  - un error con cache agregaba `Cobros pendientes` como si fuera un dato actual;
  - `null` de setup habilitaba acciones mientras cargaba y tras un error.
- `SetupWizardDialog.test.tsx` falló por Inputs menores de 44 px y textos visibles sin acentuación.
- `dialog.a11y.test.tsx` falló porque el cierre global bajaba a 36 px desde `sm`.

### GREEN

- Dashboard exige capability efectiva de lectura + escritura para fiscal y catálogo; el wizard requiere ambos pares completos.
- `admin_exists: false` bloquea wizard y acciones operativas, y solicita que un técnico autorizado cree o restaure al administrador.
- `setup-status` tiene estados explícitos `loading`, `error` y `ready`; loading/error bloquean la CTA operativa y el error ofrece retry seguro.
- La queue omite `Cobros pendientes` cuando el reporte falló, aunque React Query conserve datos cacheados; el ledger mantiene la etiqueta `Último dato conocido`.
- Los ocho Inputs y los seis botones del wizard mantienen al menos 44 px; el cierre global del diálogo conserva 44 × 44 px en todos los breakpoints.
- Se corrigieron las tildes visibles de mínimo, catálogo, límite, atrás, podrá, categoría, operación y numeración, además del fallback accesible de diálogo.

### Gates frescos de la tercera corrección

- Tests dirigidos ampliados: exit 0; 11 archivos pasaron; 102 tests pasaron; 0 fallaron; 23.8 s wall time.
- Axe: incluido en el gate dirigido; sin violaciones.
- `npm run typecheck`: exit 0; 22.3 s.
- `npm run lint`: exit 0; 0 errores; 21.2 s.
- `git diff --check`: exit 0; sin salida.
- Suite total y navegador visual no ejecutados, según instrucción.
