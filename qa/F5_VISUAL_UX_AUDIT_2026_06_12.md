# F5 Visual UX Audit - 2026-06-12

## Estado

Veredicto visual actual: **Aprobado con observaciones fuertes**.

El sistema ya se percibe institucional, sobrio y consistente despues de F3/F4. La navegacion principal, el lenguaje de caja y el recibo institucional tienen una base adecuada para operacion hospitalaria. Sin embargo, la auditoria visual encontro riesgos reales antes de entregar a usuarios finales: throttling visible en navegacion intensiva, pantallas capturadas en loading por `429`, toasts apilados en mobile y controles con nombre accesible dudoso.

No se implementaron cambios de producto en esta subfase. La unica modificacion versionable es evidencia QA: script de auditoria, reporte JSON y capturas before.

## Base auditada

- Rama: `codex/f5-visual-ux-audit`
- Base esperada de main: `ded0fa0b`
- Stash protegido: `stash@{0}: On main: PRE-F3 dirty baseline and ambiguous hunks 2026-06-11`
- URL auditada: `http://127.0.0.1:5173`
- Usuario local: `admin.validacion`
- Script: `node qa\visual-smoke\f5-visual-ux-audit.mjs`
- Reporte JSON: `qa/screenshots/before/f5-visual-ux-audit-report.json`

## Inventario de pantallas auditadas

Pantallas principales:

- Login
- Inicio / dashboard
- Nueva factura
- Caja
- Catalogo de servicios
- Historial de facturas
- Reportes
- Respaldos
- Configuracion fiscal/hospitalaria
- Usuarios
- Ayuda
- Acerca de
- Ruta 404

Flujos criticos capturados:

- Abrir caja
- Nueva factura con servicio agregado
- Emitir y cobrar
- Vista previa de recibo de pago
- Historial filtrado por paciente creado en smoke
- Reimpresion con vista previa de recibo

Estados y variantes capturadas:

- Desktop light: 18 capturas
- Desktop dark: 8 capturas
- Laptop light: 8 capturas
- Tablet light: 7 capturas
- Mobile light: 5 capturas

## Evidencia generada

Capturas principales:

- `qa/screenshots/before/f5-desktop-light-login.png`
- `qa/screenshots/before/f5-desktop-light-dashboard.png`
- `qa/screenshots/before/f5-desktop-light-new-invoice-with-service.png`
- `qa/screenshots/before/f5-desktop-light-receipt-payment-preview.png`
- `qa/screenshots/before/f5-desktop-light-receipt-reprint-preview.png`
- `qa/screenshots/before/f5-desktop-light-cashbox.png`
- `qa/screenshots/before/f5-desktop-light-catalog.png`
- `qa/screenshots/before/f5-desktop-light-invoice-history.png`
- `qa/screenshots/before/f5-desktop-light-reports.png`
- `qa/screenshots/before/f5-desktop-light-backups.png`
- `qa/screenshots/before/f5-desktop-light-settings-fiscal.png`
- `qa/screenshots/before/f5-desktop-light-users.png`
- `qa/screenshots/before/f5-desktop-light-not-found.png`
- `qa/screenshots/before/f5-desktop-dark-dashboard.png`
- `qa/screenshots/before/f5-desktop-dark-new-invoice.png`
- `qa/screenshots/before/f5-tablet-light-dashboard.png`
- `qa/screenshots/before/f5-mobile-light-dashboard.png`
- `qa/screenshots/before/f5-mobile-light-new-invoice.png`

El reporte JSON lista las 46 capturas generadas.

Evidencia suplementaria conservada de la primera corrida con timeout:

- `qa/screenshots/before/f5-desktop-dark-about.png`
- `qa/screenshots/before/f5-desktop-dark-help.png`
- `qa/screenshots/before/f5-desktop-dark-not-found.png`
- `qa/screenshots/before/f5-desktop-dark-reports.png`
- `qa/screenshots/before/f5-desktop-dark-users.png`

Estas capturas no forman parte del conteo JSON final porque la primera corrida se detuvo antes de escribir reporte. Se conservan para auditoria visual de modo oscuro y no se usan como evidencia de smoke pass/fail.

## Hallazgos criticos

### F5-C1 - Throttling visible rompe la percepcion de estabilidad

Evidencia:

- `f5-visual-ux-audit-report.json` registro 62 entradas de consola, todas asociadas a `429 Too Many Requests` o a `Failed to load resource`.
- Endpoints afectados durante navegacion/captura: `/api/cash-sessions/current`, `/api/settings/fiscal`, `/api/fiscal-sequences`, `/api/admin/users`, `/api/backups`, `/api/system/status`, `/api/reports/dashboard`.
- Capturas afectadas:
  - `f5-desktop-light-settings-fiscal.png`
  - `f5-desktop-light-users.png`
  - `f5-mobile-light-dashboard.png`
  - `f5-mobile-light-new-invoice.png`
  - varias pantallas de laptop/tablet con carga parcial.

Impacto:

- Un operador puede ver estados falsamente degradados, carga permanente o caja cerrada aunque haya caja abierta.
- Soporte podria interpretar el sistema como caido cuando el bloqueo es un throttle de navegacion normal o recarga intensiva.

Recomendacion:

- Revisar throttle por endpoint para lecturas de estado compartido y bootstrap UI.
- Diferenciar throttles de escritura sensible versus lecturas operativas frecuentes.
- Mantener proteccion LAN, pero sin castigar navegacion legitima entre pantallas.
- Agregar prueba backend de middleware/rate limits para endpoints de lectura critica.

### F5-C2 - Estados de carga pueden quedar como pantalla final en flujos administrativos

Evidencia:

- `f5-desktop-light-catalog.png`: tabla con skeletons y "0 servicios en el catalogo" aunque la base contiene servicios.
- `f5-desktop-light-invoice-history.png`: "Cargando facturas..." como estado capturado.
- `f5-desktop-light-reports.png`: "Consultando..." y toasts duplicados.
- `f5-desktop-light-users.png`: "Cargando usuarios..." con error de demasiados intentos.

Impacto:

- La UI no distingue suficientemente "cargando", "bloqueado temporalmente" y "sin datos reales".
- En caja/historial, esto puede retrasar reimpresiones o validaciones.

Recomendacion:

- Normalizar `LoadingState`, `ErrorState` y `EmptyState` con mensajes operativos por modulo.
- Mostrar accion clara: "Reintentar", "Espere 60 segundos", o "Volver a inicio".
- No mostrar contadores "0" mientras la consulta sigue en loading o fallo.

## Hallazgos medios

### F5-M1 - Toasts largos se apilan y tapan contenido operativo

Evidencia:

- `f5-mobile-light-dashboard.png`
- `f5-desktop-light-receipt-payment-preview.png`
- `f5-desktop-light-reports.png`

Impacto:

- En mobile/tablet, los toasts cubren encabezado y contenido primario.
- En recibo, mensajes simultaneos compiten con acciones de imprimir/nueva factura.

Recomendacion:

- Limitar cantidad visible de toasts.
- Usar duracion/colapso para mensajes repetidos.
- Convertir errores persistentes de backend a banners inline por pantalla.

### F5-M2 - Accesibilidad: controles sin nombre accesible claro

Evidencia automatica:

- `invoice-history`: select de estado sin `id`/`htmlFor` o nombre detectable por auditoria DOM.
- `users`: input sin nombre detectable cuando la consulta queda bloqueada.

Impacto:

- Navegacion con lector de pantalla o teclado puede ser menos clara.

Recomendacion:

- Revisar `Select`, filtros de historial y buscador de usuarios.
- Asegurar `label`, `aria-label` o `aria-labelledby` consistente en primitives.
- Agregar pruebas Testing Library para nombre accesible de filtros principales.

### F5-M3 - Dashboard y reportes usan espacios vacios que parecen incompletos

Evidencia:

- `f5-desktop-light-dashboard.png`
- `f5-desktop-dark-dashboard.png`
- `f5-desktop-light-reports.png`

Impacto:

- En pantallas gerenciales, un area grande vacia o skeleton largo puede parecer falla.

Recomendacion:

- Definir empty states reales para graficas sin datos.
- Mostrar "Sin movimientos en este periodo" con accion de cambiar fecha o actualizar.

### F5-M4 - Responsive mobile existe pero no esta optimizado para caja real

Evidencia:

- `f5-mobile-light-new-invoice.png`
- `f5-mobile-light-dashboard.png`

Impacto:

- El flujo se apila correctamente, pero carrito/totales quedan abajo y los toasts pueden ocultar estado.
- En celular es aceptable como consulta, no como modo principal de caja.

Recomendacion:

- Priorizar tablet/laptop para caja.
- En mobile, fijar CTA/totales de forma controlada o declarar modo consulta/soporte si no se optimiza.

## Hallazgos menores

- El diseno visual base es consistente, pero algunos textos carecen de tildes visibles por encoding en capturas/reportes de tooling. Revisar solo si aparece en UI real, no por salida de consola.
- El recibo institucional es claro, pero los toasts superpuestos durante pago reducen foco operativo.
- El modo oscuro tiene buen contraste general, aunque los graficos vacios/skeletons en dark necesitan empty states mas explicitos.
- La ruta 404 es sobria y no rompe shell, pero podria ofrecer accion visible a Inicio.

## Propuesta de sistema visual institucional

### Colores

- Base clara: fondo gris muy suave, tarjetas blancas, texto principal casi negro.
- Acento institucional: verde/teal sobrio solo para acciones seguras y estado de red/caja.
- Advertencia: ambar para caja cerrada, configuracion pendiente y acciones no destructivas.
- Error/destructivo: rojo/rose solo para bloqueo, anulacion o fallas reales.
- Dark mode: mantener azul grafito actual, evitando bajar contraste de textos secundarios.

### Tipografia

- Mantener sans-serif del sistema por rendimiento offline y legibilidad.
- Encabezados compactos, no hero marketing.
- Numeros financieros con peso alto y alineacion clara.

### Espaciado y layout

- Mantener sidebar + topbar.
- Formularios criticos en paneles de una tarea por bloque.
- En dashboard/reportes, reemplazar grandes skeletons por empty states con causa y siguiente accion.

### Botones

- Primario: accion principal unica por flujo.
- Secundario: navegacion o alternativa.
- Destructivo: anulacion/cierre riesgoso.
- Disabled: siempre con texto auxiliar visible que explique condicion.

### Formularios

- Labels visibles obligatorios.
- Ayuda breve bajo campos fiscales/caja.
- Errores inline por campo y resumen arriba cuando afecte emision/cobro.

### Tablas

- Encabezados sticky solo si la tabla crece.
- Empty state real, no skeleton permanente.
- Filtros con labels programaticos.
- Acciones de fila con nombres accesibles especificos.

### Badges

- Caja abierta/cerrada y factura pagada/parcial/anulada deben usar texto + color.
- No depender solo del color.

### Modales

- Confirmaciones de factura/pago/anulacion con foco inicial claro.
- Recibo: acciones visibles y toasts no deben tapar preview.

### Toasts

- Maximo 1-2 simultaneos visibles.
- Errores repetidos deben agruparse.
- Bloqueos de 60s deben volverse banner inline si afectan pantalla actual.

### Navegacion

- Mantener fuente unica `appNavigation`.
- En mobile/tablet, confirmar cierre del drawer al navegar y foco en `main`.

### Estados

- Loading: skeleton solo mientras hay request activo.
- Empty: "Sin datos para este periodo" o equivalente.
- Error: causa humana + accion.
- 429: mensaje de espera con reintento controlado.

### Recibos e impresion

- Mantener CSS aislado por `body[data-printing-receipt="true"]`.
- No agregar QR, codigos de barra ni datos tecnicos.
- Validacion fisica de impresora sigue pendiente fuera del smoke.

## Plan de correccion por lotes

### Lote 1 - Lecturas operativas y rate limits

Archivos probables:

- `backend/routes/api.php`
- middleware/rate-limit config si existe
- tests Feature de throttle
- hooks de estado compartido si duplican polling

Cambios:

- Separar throttle de lecturas frecuentes y escrituras.
- Proteger endpoints sensibles sin bloquear navegacion normal.
- Agregar pruebas de middleware para endpoints UI bootstrap.

Riesgo:

- Bajo-medio: toca backend operativo, requiere tests completos.

Criterio:

- F5 smoke sin `429` en navegacion normal.

Pruebas:

- `php artisan test --filter=ThrottleByUserTest`
- `php artisan test --filter=BroadcastingWiringTest`
- smoke F5.

### Lote 2 - Estados loading/empty/error institucionales

Archivos probables:

- `frontend/src/components/ui/states.tsx`
- `frontend/src/features/dashboard/DashboardView.tsx`
- `frontend/src/features/catalog/CatalogView.tsx`
- `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/features/admin/UsersView.tsx`

Cambios:

- Empty states por modulo.
- Error states con reintento.
- No mostrar "0" como dato final si hay query fallida.

Riesgo:

- Medio: afecta muchas pantallas, pero solo presentacion.

Criterio:

- Capturas muestran estado entendible y accionable.

Pruebas:

- Tests de componentes por pantalla.
- smoke F5 before/after.

### Lote 3 - Toasts y mensajes persistentes

Archivos probables:

- `frontend/src/components/ui/toaster.tsx`
- llamadas `onStatus`
- componentes de error por feature

Cambios:

- Limitar toasts visibles.
- Agrupar duplicados.
- Convertir errores de request repetidos a banner inline.

Riesgo:

- Bajo-medio.

Criterio:

- Mobile no queda tapado por mensajes simultaneos.

Pruebas:

- Testing Library para toaster.
- captura mobile dashboard/new invoice.

### Lote 4 - Accesibilidad de filtros y formularios

Archivos probables:

- `frontend/src/components/ui/select.tsx`
- `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- `frontend/src/features/admin/UsersView.tsx`
- tests a11y existentes

Cambios:

- Labels/aria para selects y inputs.
- Focus visible en filtros y acciones de tabla.

Riesgo:

- Bajo.

Criterio:

- Auditoria DOM sin controles sin nombre en pantallas criticas.

Pruebas:

- `vitest-axe`
- Testing Library `getByRole(..., { name })`.

### Lote 5 - Responsive operativo

Archivos probables:

- `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- `frontend/src/features/invoices/components/InvoiceCart.tsx`
- `frontend/src/layout/Topbar.tsx`
- `frontend/src/styles.css`

Cambios:

- Mejorar prioridad visual de caja/totales en tablet.
- Evitar que toasts cubran cabecera y alertas.

Riesgo:

- Medio: visual, requiere screenshots.

Criterio:

- Tablet/laptop operables; mobile al menos consulta clara.

Pruebas:

- smoke F5 viewport tablet/mobile.

### Lote 6 - Recibo e impresion

Archivos probables:

- `frontend/src/features/receipts/ReceiptPreview.tsx`
- `frontend/src/styles.css`
- docs de validacion fisica

Cambios:

- Pulido de preview si los toasts invaden.
- No cambiar reglas fiscales ni datos del recibo.

Riesgo:

- Medio por impacto de impresion.

Criterio:

- Preview clara y CSS print aislado.

Pruebas:

- `ReceiptPreview.a11y.test.tsx`
- capturas recibo pago/reimpresion.

## Plan de commits recomendado

1. `test(qa): add F5 visual UX audit baseline`
2. `fix(rate-limit): separate operational reads from write throttles`
3. `refactor(ui): normalize institutional loading empty and error states`
4. `fix(a11y): label invoice and admin filters`
5. `fix(ui): constrain operational toast stacking`
6. `test(qa): add F5 visual after evidence`

## F5.1 - Remediacion controlada

Estado: **corregido y validado con evidencia after**.

### Causa raiz de 429

El bloqueo visible no venia de una sola pantalla. La causa principal era el middleware autenticado global `throttle:60,1`, que usa bucket por IP. En una instalacion LAN, varias lecturas seguras de shell, caja, configuracion, dashboard, usuarios, respaldos y estado compartian el mismo limite. La navegacion intensiva del smoke reprodujo lo que puede pasar con varios clientes en la misma red local: lecturas operativas normales terminaban bloqueadas como `429`.

Factores secundarios:

- TanStack Query reintentaba errores `429` una vez por defecto.
- Los callbacks `onStatus` convertian mensajes de progreso como "Cargando..." y "Consultando..." en toasts visibles, provocando apilamiento en mobile y reportes.
- El auditor DOM marcaba como control sin nombre un `select` oculto generado por Radix, aunque el `combobox` visible ya tenia nombre accesible.

### Correcciones aplicadas

- Las rutas autenticadas operativas usan `throttle.user:240,1` para lecturas seguras, evitando que usuarios distintos en la misma LAN compartan el bucket por IP.
- Las escrituras sensibles mantienen throttles explicitos por usuario: caja, pagos, reimpresion, respaldos, usuarios, configuracion fiscal y secuencias.
- El cliente ya no reintenta `401`, `403`, `419`, `422` ni `429`; mantiene un reintento para fallos transitorios desconocidos.
- Los toasts operativos se deduplican por mensaje, limitan la cantidad visible a 2 y dejan de mostrar mensajes de progreso que ya aparecen en la barra de estado.
- Usuarios muestra error recuperable con accion `Reintentar` cuando la lectura falla.
- Historial tiene filtro de estado con nombre accesible y error recuperable con accion `Reintentar`.
- El auditor F5 ignora controles ocultos/no interactivos para evitar falsos positivos de primitives.

### Evidencia after

- Script: `node qa\visual-smoke\f5-visual-ux-audit.mjs`
- Reporte JSON after: `qa/screenshots/after/f5-visual-ux-audit-report.json`
- Capturas after: `qa/screenshots/after/f5-*`

Resultado del reporte after:

- Capturas: 46
- `consoleIssueCount`: 0
- `overflowFindings`: []
- `unnamedControlFindings`: []

Capturas clave after:

- `qa/screenshots/after/f5-desktop-light-dashboard.png`
- `qa/screenshots/after/f5-desktop-light-new-invoice-with-service.png`
- `qa/screenshots/after/f5-desktop-light-receipt-payment-preview.png`
- `qa/screenshots/after/f5-desktop-light-invoice-history.png`
- `qa/screenshots/after/f5-desktop-light-users.png`
- `qa/screenshots/after/f5-desktop-light-backups.png`
- `qa/screenshots/after/f5-desktop-dark-dashboard.png`
- `qa/screenshots/after/f5-tablet-light-dashboard.png`
- `qa/screenshots/after/f5-mobile-light-dashboard.png`

### Pruebas agregadas o ajustadas

- `ThrottleByUserTest` cubre lecturas operativas por usuario y escrituras con throttle explicito.
- `query-client.test.ts` cubre que `429` no se reintente.
- `UsersView.test.tsx` cubre error recuperable y nombres accesibles de controles.
- `InvoiceHistoryView.test.tsx` cubre nombre accesible del filtro de estado.

### Pendientes

- La optimizacion profunda de tablas, dashboard gerencial y responsive mobile completo queda fuera de F5.1 para evitar rediseño amplio.
- La validacion fisica de impresora termica sigue correspondiendo a un frente posterior de impresion/operacion, no a robustez visual.

## Criterios de aceptacion F5

- Capturas before/after reales.
- Sin `429` en navegacion normal del smoke.
- Sin pantallas finales atrapadas en skeleton/loading.
- Estados empty/error comprensibles para personal no tecnico.
- Nueva factura, caja, recibo e historial sin regresion.
- Light/dark verificados.
- Responsive tablet/laptop verificado.
- Tests frontend/backend y smoke F4/F5 pasando.
