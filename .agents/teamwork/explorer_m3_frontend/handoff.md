# Handoff Report: Explorer M3 Frontend (Receipts & Operation History)

**Date**: 2026-09-28T09:54:00Z  
**Agent**: Explorer M3 Frontend  
**Working Directory**: `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_m3_frontend`  
**Recipient**: Parent Agent (`afa577c2-4f95-4c65-bb23-5b3900e061e4`)  
**Type**: Hard Handoff (Investigation & Verification Complete)

---

## 1. Observation

1. **Directorio y archivos del módulo**:
   - `frontend/src/features/recibos/`: 12 archivos verificados (`RecibosView.tsx`, `RecibosFilters.tsx`, `RecibosTable.tsx`, `RecibosDetailPanel.tsx`, `recibosModel.ts`, `recibosUi.ts`, más 6 archivos de test asociados).
   - Componentes de soporte en `frontend/src/features/invoices/history/`: `InvoiceHistoryActionDialogs.tsx`, `InvoiceHistoryReceiptDialog.tsx`, `InvoicePagination.tsx`, `useInvoiceHistoryQuery.ts`, `useInvoiceHistoryActions.ts`, `useInvoiceHistoryReceipts.ts`.

2. **Estructura y filtros en `RecibosView.tsx` y `RecibosFilters.tsx`**:
   - `RecibosFilters.tsx:71-80`: Detección heurística de número de documento vs paciente con `/^[0-9][0-9-]*$/`.
   - `RecibosFilters.tsx:65-68`: Validación de rango temporal (`date_from > date_to`) con mensaje accesible de alerta `role="alert"`.
   - `RecibosFilters.tsx:150-162`: Selector de estado con opciones `issued`, `partial`, `paid`, `void`.
   - `RecibosFilters.tsx:164-188`: Selector de sesión de caja física condicionado por el permiso `cash.view`.

3. **Paginación en `useInvoiceHistoryQuery.ts` y `InvoicePagination.tsx`**:
   - `useInvoiceHistoryQuery.ts:41-45`: Paginación delegada al backend mediante TanStack Query (`GET /api/invoices?page=X&per_page=10`) con `PaginatedMeta` (`current_page`, `per_page`, `total`).
   - `useInvoiceHistoryQuery.ts:79-84`: `changePage(page)` actualiza parámetros en URL y preserva el parámetro del panel de detalle (`withPreservedDetail`).
   - `InvoicePagination.tsx:13-86`: Control con ventana de páginas `[1, current - 1, current, current + 1, totalPages]`, botones Anterior/Siguiente con `aria-disabled` y estilos con tokens `--ui-navy` y hairline `--ui-line`.
   - `RecibosView.tsx:270`: Muestra el rango visible localizado mediante `resultRangeLabel(meta)` (e.g. `1–10 de 42`).

4. **Detalle de cuenta en `RecibosDetailPanel.tsx`**:
   - `RecibosDetailPanel.tsx:363-414`: Tabla de conceptos con descripción, categoría, badge `Sin cobro por receta` si aplica regla EPO, cantidad con `QuantityText`, precio unitario con `MoneyText`, ajuste por regla con `LineAdjustmentCell` e importe de línea.
   - `RecibosDetailPanel.tsx:438-444`: Si la línea participó en una regla pero el backend histórico no entregó centavos de ajuste, muestra explícitamente `Dato histórico no disponible` (`LINE_ADJUSTMENT_UNAVAILABLE`) y nunca inventa `L 0.00`.
   - `RecibosDetailPanel.tsx:251-266`: Desglose contable en dos listas hermanas: Total, Pagado, Saldo; Subtotal, ISV, Descuento.
   - `RecibosDetailPanel.tsx:273-302`: Lista de pagos con método, fecha, sesión de caja, referencia y tachado si el pago fue anulado.
   - `RecibosDetailPanel.tsx:305-338`: Registro con fecha, usuario, caja, número de comprobante, contadores de reimpresión (`institutional_receipt.reprint_count`) y eventos de impresión (`print_events_count`).
   - `RecibosDetailPanel.tsx:97-160`: Botones contextuales al pie para imprimir, descargar PDF, generar comprobante, cobrar saldo, anular y reversar.

5. **Reimpresión auditada en `InvoiceHistoryActionDialogs.tsx` y `useInvoiceHistoryReceipts.ts`**:
   - `InvoiceHistoryActionDialogs.tsx:224-251`: Diálogo de reimpresión con `requireReasonTextarea`, `requireReasonMinLength={5}`, `requireReasonMaxLength={500}`.
   - `InvoiceHistoryActionDialogs.tsx:183-190`: Botón de confirmación deshabilitado si `reasonLength < 5` o `reasonLength > 500` o en progreso de envío.
   - `useInvoiceHistoryReceipts.ts:391-396`: Envío con clave de idempotencia (`payloadScopedIdempotencyKey`) hacia `registerInstitutionalReceiptPrintEvent` o `reprintInvoice`.
   - `RecibosDetailPanel.tsx:323-325`: El conteo de reimpresiones previas se muestra en la sección de registro del panel de detalle.

6. **Anulación y reversa en `invoiceActionPolicy.ts` y `InvoiceHistoryActionDialogs.tsx`**:
   - `invoiceActionPolicy.ts:77-81`: `void` requiere `invoices.void` Y (`invoices.operate_any` O `isOwnInvoiceFromToday`) Y estado `issued`. `reverse` requiere `invoices.reverse` Y (`invoices.operate_any` O `isOwnInvoiceFromToday`) Y estado `paid` o `partial`.
   - `InvoiceHistoryActionDialogs.tsx:282-378`: Diálogos con `DANGER_BUTTON` y validación de motivo mínimo de 5 caracteres.

7. **Resultados de herramientas ejecutadas**:
   - `npm run typecheck`: Exited with code 0 (`tsc --noEmit`).
   - `node scripts/check-no-legacy-ui.mjs --mode=strict`: Exited with code 0 (`[QUALITY GATE PASSED] modo=strict; 397 archivos; 0 violaciones`).
   - `npx vitest run src/features/recibos/`: Exited with code 0 (`6 test files passed, 47 tests passed, 0 failed`).
   - `npx vitest run src/features/invoices/history/`: Exited with code 0 (`2 test files passed, 11 tests passed, 0 failed`).

---

## 2. Logic Chain

1. **Cumplimiento de R3 y Mandato §5**:
   - Basado en Obs 2, la búsqueda soporta paciente, número, período y estado tal como exige R3 ("Búsqueda por paciente, número correlativo, fecha y estado").
   - Basado en Obs 3, la paginación es 100% server-side con 10 items por página, sincronización con URL y guardas accesibles, cumpliendo R3 ("Paginación robusta").
   - Basado en Obs 4, el panel lateral expone el desglose completo de líneas, unit price, ajuste EPO, desglose contable, pagos y metadatos de auditoría, cumpliendo R3 ("visualización del detalle de la cuenta") y el principio de no inventar datos históricos ni exponer marketing ("Sin cobro por receta").
   - Basado en Obs 4 y 5, el cobro de saldo está disponible vía `PaymentModal` y la reimpresión exige motivo obligatorio de 5 a 500 caracteres e idempotencia, cumpliendo R3 ("cobro de saldos cuando aplique y reimpresión auditada con motivo obligatorio").
   - Basado en Obs 6, la política `invoiceActionPolicy` segrega anulación de facturas impagas y reversa de pagos con motivos obligatorios, cumpliendo R3 ("Anulaciones y reversiones controladas por permisos y registradas en auditoría").
2. **Conformidad de Tokens y Calidad de Código**:
   - Basado en Obs 7, el código pasa la verificación estricta de TypeScript (`typecheck`), la verificación estricta de tokens canónicos sin colores legados (`check-no-legacy-ui.mjs`) y 58 pruebas automáticas pasan sin ninguna falla.

---

## 3. Caveats

1. **Conteo en el modal de reimpresión**: Si bien el panel de detalle lateral muestra explícitamente el contador duradero de reimpresiones (`institutional_receipt.reprint_count`), el texto dentro del diálogo modal de confirmación no interpola el número ordinal (ej. "Reimpresión #2"). No obstante, el evento se audita en backend de forma duradera y el frontend valida y refleja el estado sin alterar la lógica de negocio.
2. **Alcance de investigación**: La investigación se centró exclusivamente en el código frontend (`src/features/recibos/` y dependencias directas en `src/features/invoices/history/`). No se modificó código de producción (respetando la restricción de solo lectura).

---

## 4. Conclusion

El frontend de **Recibos e Historial de Operaciones (M3)** cumple rigurosamente con todas las especificaciones de R3 y Mandato §5:
- La búsqueda unificada, filtros temporales y de estado operan de manera ergonómica e integrada.
- La paginación en servidor está perfectamente integrada con URL y TanStack Query.
- El panel de detalle de cuenta refleja la fidelidad contable y las reglas de negocio (incluida la regla EPO sin marketing y el tratamiento de datos históricos no disponibles).
- Los flujos de reimpresión auditada y de anulación/reversa protegen la integridad de los datos mediante permisos, motivos obligatorios y claves de idempotencia.
- Se aprueban al 100% el chequeo estático de tipos, la auditoría estricta de tokens y todas las suites de pruebas unitarias.

El frontend de M3 está listo para la integración y las pruebas de laboratorio conjuntas con backend y E2E.

---

## 5. Verification Method

Para verificar independientemente estos hallazgos, ejecutar los siguientes comandos en el directorio `frontend/`:

1. **Chequeo de tipos TypeScript**:
   ```bash
   cd c:\Projects\S_Hospital_AI\frontend
   npm run typecheck
   ```
   *Criterio de éxito*: Salida limpia con código de salida 0.

2. **Guardia estricta de tokens visuales**:
   ```bash
   node scripts/check-no-legacy-ui.mjs --mode=strict
   ```
   *Criterio de éxito*: `[QUALITY GATE PASSED] modo=strict; 397 archivos; 0 violaciones.`

3. **Pruebas unitarias de Recibos**:
   ```bash
   npx vitest run src/features/recibos/
   ```
   *Criterio de éxito*: 6 archivos de prueba pasados, 47 tests pasados, 0 fallos.

4. **Pruebas unitarias de soporte de Historial**:
   ```bash
   npx vitest run src/features/invoices/history/
   ```
   *Criterio de éxito*: 2 archivos de prueba pasados, 11 tests pasados, 0 fallos.

5. **Inspección de archivos clave**:
   - `frontend/src/features/recibos/RecibosView.tsx`
   - `frontend/src/features/recibos/RecibosFilters.tsx`
   - `frontend/src/features/recibos/RecibosTable.tsx`
   - `frontend/src/features/recibos/RecibosDetailPanel.tsx`
   - `frontend/src/features/invoices/history/InvoiceHistoryActionDialogs.tsx`
