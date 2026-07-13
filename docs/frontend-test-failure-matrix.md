# Matriz de Fallas de Pruebas del Frontend — S_Hospital

Esta matriz registra de forma detallada y clasificada los 93 fallos identificados en la suite de pruebas del frontend al cierre de las Fases 6 y 7, estableciendo los criterios de resolución para cada uno.

---

## Matriz de Clasificación de Fallas

| Módulo | Test Fallado / Suite | Cantidad | Error Principal | ¿Preexistente? | Componente Legacy Relacionado | Fase Propietaria | Solución Prevista | Estado | Criterio de Cierre |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `catalog/` | `ServiceSheet.test.tsx` (múltiples tests de renderizado y envío) | 19 | Error al buscar etiquetas asociadas o al hacer clic en botones de acción. | Sí | `ServiceSheet.tsx` (Drawer de Ant Design / destroyOnHidden) | Fase de Catálogo (Fase 8/9) | Alinear etiquetas, deshabilitar `destroyOnHidden` en entorno de prueba o mockear el Drawer para renderizado síncrono inline. | **EN INVENTARIO** | Paso de la suite completa sin fallos de renderizado. |
| `catalog/` | `CategorySheet.test.tsx` (guardado y validación de categorías) | 5 | El botón de guardar o confirmación no es interactivo o no se encuentra en el DOM. | Sí | `CategorySheet.tsx` (Drawer / Form de Ant Design) | Fase de Catálogo (Fase 8/9) | Ajustar consultas de testing-library (`getByRole` o `findByRole`) al marcado real de Ant Design. | **EN INVENTARIO** | Suite pasa al 100%. |
| `catalog/` | `CatalogView.test.tsx` (requiere confirmación al deactivar/activar) | 4 | No se encuentra el elemento `alertdialog` tras activar la acción. | Sí | `ConfirmDialog` / `ServiceCatalogTable` (Portales de Modal/Dropdown en jsdom) | Fase de Catálogo (Fase 8/9) | Mockear el Dropdown o renderizar botones alternativos accesibles siempre presentes en el DOM para entornos de prueba. | **EN INVENTARIO** | Los tests de activación/desactivación pasan con AG Grid. |
| `invoices/` | `InvoiceHistoryView.test.tsx` / `InvoiceDetailSheet.test.tsx` | ~50 | Inconsistencias de aserciones entre los componentes Sheet y Modal, y controles de filtros en la URL. | Sí | `InvoiceHistoryFilters.tsx`, `InvoiceDetailSheet.tsx` | Fase de Facturación (Historial, detalle, anulación) | Reescribir las aserciones de pruebas adaptándolas a los componentes Ant Design y la manipulación de query params de react-router. | **EN INVENTARIO** | Limpieza de tests del historial e integración de detalle en el Drawer. |
| `App.test.tsx` | `App.test.tsx` (flujos de inicio y recuperación de sesión) | 7 | Tiempos de espera asíncronos excedidos (`testTimeout`) y advertencias de `act(...)` no controlado. | Sí | `App.tsx` / `AppRoutes.tsx` | Transversal | Ajustar tiempos de espera, envolver operaciones asíncronas en `await act()` y mockear timers si es necesario. | **EN INVENTARIO** | La suite completa de `App.test.tsx` pasa sin timeouts. |
| `reports/` | `ServiceRanking.test.tsx` (monto y estado vacío) | 2 | No encuentra el texto exacto de estado vacío o montos esperados en las celdas. | Sí | `ServiceRanking.tsx` (AG Grid / Empty state) | Fase de Reportes | Configurar el mensaje vacío del grid y adaptar el formateador de monedas en la columna. | **EN INVENTARIO** | Integración exitosa con la suite de reportes. |
| `invoices/` | `InvoiceConfirmation.test.tsx` (visibilidad de nombres largos) | 1 | Elemento no es visible (`toBeVisible` fallido). | Sí | `InvoiceConfirmation.tsx` (List de Ant Design) | Fase de Facturación | Ajustar la visibilidad de los elementos y las clases CSS de densidad para jsdom. | **EN INVENTARIO** | Test de confirmación de factura pasa. |

---

## Criterios Generales de Cierre

1. **Resolución de Regresión Funcional Real:** No se permite desactivar o saltar pruebas para silenciar fallos. Cada test debe reescribirse para validar el mismo comportamiento de negocio con el nuevo stack tecnológico (Ant Design, AG Grid, etc.).
2. **Timing y Mocks:** Todos los timers asíncronos y mocks obsoletos de la API deben ser actualizados a los nuevos contratos de `apiClient`.
3. **Markup y Roles:** Las aserciones basadas en markup HTML legacy (como clases de Tailwind específicas) deben ser actualizadas a roles ARIA accesibles compatibles con Ant Design.
