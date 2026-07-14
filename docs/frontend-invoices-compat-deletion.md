# Eliminación de Compat en Facturación

Estado: completada en el código de runtime. `flowAntCompat.tsx` y
`historyAntCompat.tsx` están eliminados y no existen imports ni consumidores en
`src/features/invoices`.

## Inventario cerrado

| Export anterior | Consumidores auditados | Sustitución definitiva | Estado |
| --- | --- | --- | --- |
| `Alert` | `InvoiceCart`, `ServiceSearch`, `NewInvoiceViewLayout`, `PaymentModal` | `Alert` de Ant Design con `type`, `title` y `description` | Eliminado |
| `Badge` | flujo de nueva factura | `Tag` de Ant Design o `StatusTag` institucional | Eliminado |
| `Button` | flujo completo | `Button` de Ant Design; navegación SPA mediante `useNavigate` | Eliminado |
| `Input`, `Textarea`, `Checkbox` | flujo e historial | Controles Ant Design directos | Eliminado |
| `Label` | formularios | `<label>` HTML asociado explícitamente | Eliminado |
| `Dialog`, `ConfirmDialog` | confirmación, pago, recibo, anulación, reverso y reimpresión | `Modal` de Ant Design real | Eliminado |
| `Sheet` | detalle histórico | `Drawer` de Ant Design real | Eliminado |
| `DataTable`, `DataTableColumn` | historial | `InstitutionalDataGrid<T>` e `InstitutionalColumn<T>` sobre AG Grid | Eliminado |
| `ActionMenu` | acciones por factura | `Dropdown` y `MenuProps` de Ant Design | Eliminado |
| `StatusBadge` | filas y detalle | `StatusTag` institucional | Eliminado |
| estados loading/error/empty | historial y detalle | `Skeleton`, `Alert` y `Empty` de Ant Design | Eliminado |

`PaymentModal.tsx` también dejó de declarar wrappers locales que imitaban
`Dialog`, `variant`, `Label`, `MoneyText` y `Separator`. No sobrevive ningún
adaptador excepcional dentro de Facturación.

## Arquitectura de pruebas

- Runtime: AG Grid, DatePicker, Modal, Drawer y Dropdown son las únicas
  implementaciones.
- Vitest: `src/test/setup.ts` reemplaza solamente el renderer de terceros
  `ag-grid-react`; el adaptador `InstitutionalDataGrid` real, sus columnas,
  visibilidad y callbacks siguen ejecutándose.
- DatePicker: se abre y selecciona una fecha con `userEvent` usando Ant Design
  real; no existe `<input type="date">` alternativo.
- Modal/Drawer/Dropdown: Vitest cubre contenido, reglas, datos y callbacks sin
  mocks completos de Ant Design.
- Playwright: portal, foco, restauración de foco, Escape, teclado, AG Grid y
  DatePicker tienen cobertura funcional real (5/5 recorridos Chromium). La
  consola quedó limpia en esos recorridos tras registrar `LocaleModule` y
  `CellStyleModule` de AG Grid.
- Axe: la ejecución del estado `grid con datos` encontró infracciones serias de
  contraste en el shell institucional y detuvo la matriz. No se silenciaron ni
  excluyeron reglas; la certificación transversal permanece pendiente.

## Auditoría de cambios funcionales solicitada

| Archivo | Problema | Solución e impacto productivo | Cobertura y permanencia |
| --- | --- | --- | --- |
| `InvoiceHistoryView.tsx` | El Drawer se ocultaba al abrir anulación/reverso y el cierre podía reabrir el deep-link por una carrera con la URL. | El detalle permanece montado detrás del Modal; cancelar conserva factura y datos. La URL se elimina antes de reiniciar la identidad solicitada. | Vitest de continuidad; foco/Escape en Playwright. Debe permanecer. |
| `PatientStep.tsx` | API `Space.direction` obsoleta; validación/foco debían conservarse. | `Space.orientation` sin bifurcación de test. | Tests de validación. Debe permanecer. |
| `InvoiceConfirmation.tsx` | Mock total de Modal y `List` obsoleta ocultaban el portal real. | Modal Ant real, lista HTML semántica y footer real. | Vitest de datos/callbacks; portal/foco/Escape en Playwright. Debe permanecer. |
| `InvoiceSuccess.tsx` | Assertions de clases confundían contrato funcional con styling. | Se conservan acciones y estados; tests consultan roles y disponibilidad. | Vitest funcional. Debe permanecer. |
| `InvoiceHistoryFilters.tsx` | DatePicker se sustituía por input nativo en tests. | DatePicker único con transformación `YYYY-MM-DD`. | Vitest con `userEvent`; popup real en Playwright. Debe permanecer. |
| `InvoiceHistoryView.continuity.test.tsx` | Assertions de clases y supuesto de que el Drawer desaparecía durante confirmaciones. | Comprueba contrato del grid y continuidad de detalle/URL al cancelar. | 14 pruebas reales. Debe permanecer. |
| `historyAntCompat.tsx` | Design system paralelo y tabla distinta en test. | Eliminado; AG Grid institucional es el único motor. | Búsqueda global sin consumidores. No debe volver. |
| `flowAntCompat.tsx` | APIs que imitaban ShadCN. | Eliminado; Ant Design/HTML directo. | Búsqueda global sin consumidores. No debe volver. |

El estado de fase sigue siendo **FASE 8B IMPLEMENTADA — QA TRANSVERSAL
PENDIENTE** hasta completar la matriz de navegador y dejar verde el gate legacy
global y corregir las infracciones de contraste antes de completar la matriz axe.
