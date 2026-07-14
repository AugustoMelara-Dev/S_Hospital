# Matriz de Fallas de Pruebas del Frontend — S_Hospital

Esta matriz registra de forma detallada y clasificada los 93 fallos identificados en la suite de pruebas del frontend al cierre de las Fases 6 y 7, estableciendo los criterios de resolución para cada uno.

---

## Matriz de Clasificación de Fallas

| Módulo | Test Fallado / Suite | Cantidad | Error Principal | ¿Preexistente? | Componente Legacy Relacionado | Fase Propietaria | Solución Prevista | Estado | Criterio de Cierre |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `catalog/` | `ServiceSheet.test.tsx` (renderizado, reglas y envío) | 19 | Etiquetas y eventos heredados no representaban Drawer/Form reales. | Sí | `ServiceSheet.tsx` | Fase 9 Catálogo | Se conservaron Drawer y Form reales; se corrigieron asociaciones, hidratación y pruebas de reglas puras. | **CERRADO** | 21/21 y flujo Drawer real en Chromium. |
| `catalog/` | `CategorySheet.test.tsx` (guardado y validación) | 5 | Carrera de hidratación y consultas incompatibles con el marcado real. | Sí | `CategorySheet.tsx` | Fase 9 Catálogo | `useLayoutEffect` sincroniza el formulario y las pruebas consultan semántica real. | **CERRADO** | 5/5 con Drawer real. |
| `catalog/` | `CatalogView.test.tsx` / continuidad | 4 | Estado URL duplicado y cobertura de Dropdown/Drawer fuera del límite fiable de JSDOM. | Sí | `CatalogView`, `ServiceCatalogTable` | Fase 9 Catálogo | Overlay derivado de URL; Vitest cubre contrato y callbacks, Playwright cubre portales, teclado y navegación. | **CERRADO FOCAL** | Catálogo 53/53 y Playwright 2/2. |
| `invoices/` | `InvoiceHistoryView.test.tsx` / `InvoiceDetailSheet.test.tsx` | ~50 | Inconsistencias de aserciones entre los componentes Sheet y Modal, y controles de filtros en la URL. | Sí | `InvoiceHistoryFilters.tsx`, `InvoiceDetailSheet.tsx` | Fase de Facturación (Historial, detalle, anulación) | Reescribir las aserciones de pruebas adaptándolas a los componentes Ant Design y la manipulación de query params de react-router. | **EN INVENTARIO** | Limpieza de tests del historial e integración de detalle en el Drawer. |
| `App.test.tsx` | `App.test.tsx` (flujos de inicio y recuperación de sesión) | 7 | Tiempos de espera asíncronos excedidos (`testTimeout`) y advertencias de `act(...)` no controlado. | Sí | `App.tsx` / `AppRoutes.tsx` | Transversal | Ajustar tiempos de espera, envolver operaciones asíncronas en `await act()` y mockear timers si es necesario. | **EN INVENTARIO** | La suite completa de `App.test.tsx` pasa sin timeouts. |
| `reports/` | `ServiceRanking.test.tsx` (monto y estado vacío) | 2 | No encuentra el texto exacto de estado vacío o montos esperados en las celdas. | Sí | `ServiceRanking.tsx` (AG Grid / Empty state) | Fase de Reportes | Configurar el mensaje vacío del grid y adaptar el formateador de monedas en la columna. | **EN INVENTARIO** | Integración exitosa con la suite de reportes. |
| `invoices/` | `InvoiceConfirmation.test.tsx` (visibilidad de nombres largos) | 1 | Elemento no es visible (`toBeVisible` fallido). | Sí | `InvoiceConfirmation.tsx` (List de Ant Design) | Fase de Facturación | Ajustar la visibilidad de los elementos y las clases CSS de densidad para jsdom. | **EN INVENTARIO** | Test de confirmación de factura pasa. |

---

## Criterios Generales de Cierre

1. **Resolución de Regresión Funcional Real:** No se permite desactivar o saltar pruebas para silenciar fallos. Cada test debe reescribirse para validar el mismo comportamiento de negocio con el nuevo stack tecnológico (Ant Design, AG Grid, etc.).
2. **Timing y Mocks:** Todos los timers asíncronos y mocks obsoletos de la API deben ser actualizados a los nuevos contratos de `apiClient`.
3. **Markup y Roles:** Las aserciones basadas en markup HTML legacy (como clases de Tailwind específicas) deben ser actualizadas a roles ARIA accesibles compatibles con Ant Design.

## Revisión arquitectónica de Fase 8B (2026-07-13)

| Suite | Fallos iniciales | Causa | Resolución | Estado focal |
| --- | ---: | --- | --- | --- |
| `InvoiceHistoryView.test.tsx` | 18 | Consultas `alertdialog` heredadas y overlays reales | Consultas al `dialog` real de Ant Design | 43/43 |
| `NewInvoiceView.test.tsx` | 8 | Pruebas operaban etapas `aria-hidden` del asistente | Navegación real Paciente → Servicios → Cuenta | 26/26 |
| `ServiceSearch.test.tsx` | 3 | `requestAnimationFrame` no escribible impedía fake timers | Infraestructura DOM escribible en `src/test/setup.ts` | Verde |
| `NewInvoiceViewLayout.a11y.test.tsx` | 1 | `<a>` interactivo anidado en `Button` | Navegación SPA desde `Button` con `useNavigate` | axe focal verde |

La pasada conjunta registró 164/194 antes de estas correcciones. No se agregaron
ramas `MODE === 'test'`, mocks completos de Ant Design ni markup alternativo.
La repetición final aprobó **194/194 pruebas en 17 archivos**. Playwright aprobó
**5/5** recorridos funcionales en Chromium con los componentes productivos. La
matriz axe se detuvo en el primer estado (`grid con datos`) por infracciones
serias de contraste del shell institucional; quedan pendientes los estados
normal, formulario inválido, Modal, Drawer, Dropdown, DatePicker, grid vacío y
error de API. El gate transversal también sigue abierto por las 165 violaciones
globales de `check:ui-legacy` fuera de Invoices.

## Revisión focal de Catálogo (2026-07-13)

La suite partió de **34/53** y cerró en **53/53**. No se sustituyeron Drawer,
Modal, Dropdown ni AG Grid en runtime. Las limitaciones del portal completo en
JSDOM se dividieron de forma explícita: Vitest valida datos, contratos URL,
reglas, payloads y callbacks; Playwright valida Dropdown y Drawer reales,
Escape, foco, deep-link y navegación atrás. El recorrido Chromium aprobó **2/2**.

## Regresión global posterior al shell y Administración (2026-07-13)

La ejecución segmentada aprobó 197/208 pruebas del bloque no migrado y dejó 11 fallos reproducibles, todos fuera de Facturación, Catálogo y Administración:

| Suite | Fallos | Evidencia / propietario | Estado |
| --- | ---: | --- | --- |
| `InstitutionalReceiptSettingsView.test.tsx` | 1 | permanece en loading al consultar el perfil resuelto | Backlog Recibos |
| `ReportsAudit.test.tsx` | 1 | restauración del filtro `action` desde URL | Backlog Reportes |
| `ReportsExecutive.test.tsx` | 4 | historial de fechas, bloqueo de exportación, error LAN y progreso PDF | Backlog Reportes |
| `ExecutiveAlerts.test.tsx` | 1 | textos de riesgos operativos | Backlog Reportes |
| `PendingAgingPanel.test.tsx` | 3 | estado vacío, tabla accesible y fecha ausente | Backlog Reportes |
| `ServiceRanking.test.tsx` | 1 | texto de estado vacío con acento | Backlog Reportes |
| `App.test.tsx` | 8 | contratos antiguos de Settings/Catálogo/Backups/Auth y fallback lazy | Backlog transversal por módulo propietario |
| `lib/api/system.test.ts` | 1 | expectation corrupta usa `áction` en vez de `?action` | Backlog API tests |
| `modules/receipts/paperPolicy.test.ts` | 1 | busca CSS de impresión retirado de `styles.css` | Backlog Recibos/Impresión |

Administración cerró **84/84** y Playwright **1/1**. En total quedaron 21 fallos reproducibles en 9 archivos no migrados. El E2E release global no inicia sin `E2E_RELEASE_PASSWORD`/`E2E_SEED_PASSWORD`; el preflight falla deliberadamente para impedir una contraseña comprometida en el repositorio.

## Cierre del backlog de 21 fallos (2026-07-13)

| Área | Fallos antes | Resultado focal | Resolución |
| --- | ---: | ---: | --- |
| API system | 1 | 0 | se corrigió la expectativa corrupta `áction`; el contrato conserva `?action=` y tiene regresión contra mojibake |
| Política de papel | 1 | 0 | la geometría `@page` vive en `printing/styles/receipt-print.css`; se verifican cinco formatos, orientación y fallback |
| Ajustes de recibos | 1 | 0; 61/61 | hidratación controlada y componentes Ant reales, sin ramas de test |
| Reportes | 10 | 0; 95/95 | DatePicker/AG Grid/ECharts institucional y fixtures actualizados al contrato real |
| App | 8 | 0; 20/20 | expectativas del shell/rutas/providers actuales; portales completos permanecen en Playwright |

Fallos después: **0**. `npm run test:segmented` cubrió exactamente una vez los **145/145 archivos** y aprobó **1046/1046 tests** en **12/12 segmentos**, sin omitidos, duplicados, no cubiertos ni archivos sin reporte (1751.0 s).

## Continuidad operativa: Respaldos, Ayuda, Soporte y Acerca de (2026-07-13)

| Área | Vitest | Playwright mock | Estado |
| --- | ---: | ---: | --- |
| Respaldos | 55/55 | 1/1 | Ant Design e InstitutionalDataGrid directos; sin Compat |
| Ayuda, Soporte y Acerca de | 14/14 | 1/1 | Ant Design directo; navegación, búsqueda y diagnóstico seguro |

El E2E de páginas operativas valida consola limpia y ausencia de secretos visibles. Estos cambios son posteriores al reporte segmentado de 1046 tests; por ello conservan estado **QA TRANSVERSAL PENDIENTE** hasta la siguiente ejecución completa versionada.
