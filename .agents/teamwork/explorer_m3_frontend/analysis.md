# Análisis Técnico: Frontend de Recibos e Historial de Operaciones (M3 / R3)

**Fecha**: 2026-09-28  
**Investigador**: Explorer M3 Frontend  
**Módulo objetivo**: `frontend/src/features/recibos/` y subsistemas dependientes en `frontend/src/features/invoices/history/`  
**Referencias normativas**: `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§5), `ORIGINAL_REQUEST.md` (R3), `PROJECT.md` (Features 10, 11, 12).

---

## 1. Resumen Ejecutivo

El módulo de **Recibos e Historial de Operaciones** (`frontend/src/features/recibos/`) implementa de forma completa, robusta y accesible los requisitos del hito M3 y las especificaciones del Mandato §5 y R3:
- **Estructura unificada de trabajo**: Cabecera informativa con resumen de resultados y chips de filtros activos; barra de filtros compacta integrada (`RecibosFilters.tsx`); tabla de datos con ordenamiento local accesible y tarjetas táctiles para móvil (`RecibosTable.tsx`); paginación 100% server-side conectada a URL (`InvoicePagination.tsx`); y panel lateral detallado (`RecibosDetailPanel.tsx`) que sincroniza su estado mediante deep link `?operacion=<id>`.
- **Búsqueda y filtros**: Búsqueda unificada por nombre de paciente o número de documento con detección heurística de correlativo, rango de fechas en control agrupado con validación temporal, selector de estado de pago y selector de caja autorizada (condicionada a permisos).
- **Detalle de cuenta continuo**: Desglose íntegro de conceptos, cantidades, precios unitarios, ajustes por regla (respetando la regla EPO sin marketing ni códigos de backend y con manejo explícito de datos históricos no disponibles), totales contables (Total, Pagado, Saldo, Subtotal, ISV, Descuento), historial de pagos asociados y metadatos de auditoría del comprobante institucional.
- **Reimpresión auditada**: Flujo con diálogo modal que exige motivo humano obligatorio (5 a 500 caracteres), contador dinámico de caracteres, botón inhabilitado fuera de rango e idempotencia por payload vía `idempotency-key`.
- **Anulaciones y reversiones**: Controladas estrictamente por permisos (`invoices.void`, `invoices.reverse`, `invoices.operate_any`, `isOwnInvoiceFromToday`), diferenciando facturas impagas (`void`) de facturas pagadas/parciales (`reverse`), con motivo obligatorio (≥ 5 caracteres) y registro en auditoría.
- **Calidad y cumplimiento**: Pasa `npm run typecheck` (0 errores), `node scripts/check-no-legacy-ui.mjs --mode=strict` (0 violaciones en 397 archivos) y todas las suites de pruebas unitarias (`47/47 tests passed` en `recibos`, `11/11 tests passed` en `history`).

---

## 2. Inventario de Archivos del Módulo

| Archivo | Rol | Líneas |
|---|---|---|
| `RecibosView.tsx` | Vista principal del módulo. Conecta TanStack Query, parámetros de URL, estado de permisos y modales. | 395 |
| `RecibosFilters.tsx` | Barra integrada de búsqueda (paciente/número), período, estado y caja autorizada. | 213 |
| `RecibosTable.tsx` | Tabla principal de operaciones, ordenamiento local de página visible, tarjetas móviles (`< md`). | 636 |
| `RecibosDetailPanel.tsx` | Panel lateral de detalle: cuenta, líneas contables, desglose monetario, pagos, registro y acciones. | 487 |
| `recibosModel.ts` | Modelo de presentación y adaptadores de mostrador (documentView, paymentStateView, lineAdjustmentView, etc.). | 362 |
| `recibosUi.ts` | Tokens y clases de utilidad de densidad visual (32px filtros, 38px controles, 44px móvil, active scale). | 87 |
| `RecibosView.test.tsx` | Suite de integración de la vista (estados vacíos, errores, permisos, deep links, apertura de detalle). | 250 |
| `RecibosView.reprint.test.tsx` | Suite de pruebas de primera impresión y reimpresión auditada (motivo obligatorio, idempotencia). | 160 |
| `RecibosFilters.test.tsx` | Suite de pruebas de filtros (búsqueda por nombre/documento, validación de fechas, caja). | 117 |
| `RecibosTable.test.tsx` | Suite de pruebas de tabla (documentView, ordenamiento accesible, tarjetas móviles, touch targets). | 259 |
| `RecibosDetailPanel.test.tsx` | Suite de pruebas de panel de detalle (líneas, precios, regla EPO, ajuste histórico no disponible). | 222 |
| `recibosModel.test.ts` | Suite unitaria del modelo de datos de recibos (etiquetas de estado, ajustes, chips de filtros). | 250 |

Adicionalmente, el módulo consume componentes compartidos y probados de `frontend/src/features/invoices/history/`:
- `InvoiceHistoryActionDialogs.tsx` (modales de reimpresión, anulación y reversa).
- `InvoiceHistoryReceiptDialog.tsx` (previsualización del comprobante institucional en iframe o vista legacy).
- `InvoicePagination.tsx` (componente accesible de paginación).
- `useInvoiceHistoryQuery.ts`, `useInvoiceHistoryDetail.ts`, `useInvoiceHistoryActions.ts`, `useInvoiceHistoryReceipts.ts` (hooks especializados).

---

## 3. Análisis Detallado por Componente

### 3.1 Estructura y Filtros (`RecibosView.tsx`, `RecibosFilters.tsx`)

#### Estructura del Layout
`RecibosView.tsx` estructura la pantalla en tres capas claras:
1. **Encabezado institucional (`AdminPageHeader`)**: Título "Recibos", descripción concisa y chips de estado en vivo (`AdminChip` con `aria-live="polite"`): conteo de operaciones encontradas (`X operaciones` o `Buscando…`) y etiquetas descriptivas de los filtros activos generadas por `activeFilterChips(filters)`.
2. **Espacio de trabajo dividido (`2xl:grid-cols-[minmax(0,1fr)_420px]`)**:
   - Sección izquierda: Panel contenedor (`AdminPanel`) con la barra de filtros en la cabecera, avisos de error (`refreshError`, `loadError` con botón de reintento), esqueletos accesibles de carga (`role="status"`), estados vacíos diferenciados (`showEmptyWithoutFilters` vs `isEmpty`), tabla de operaciones (`RecibosTable`) y barra de paginación inferior.
   - Sección derecha: `<RecibosDetailPanel />` anclado con `xl:sticky xl:top-4 xl:max-h-[calc(100dvh-6rem)]`, activado cuando `query.detailInvoiceId > 0`.
3. **Capa de diálogos y modales**:
   - `InvoiceHistoryReceiptDialog`: Modal para visualizar comprobante generado o histórico.
   - `InvoiceHistoryActionDialogs`: Modal para confirmación de reimpresión auditada, anulación y reversa.
   - `PaymentModal`: Modal para cobro de saldos pendientes directo desde el historial.

#### Barra de Búsqueda y Filtros (`RecibosFilters.tsx`)
- **Campo de consulta dual**: Input tipo `search` ("Paciente o número") con icono `SearchIcon`. La función `looksLikeDocumentNumber(raw)` analiza si la entrada cumple `/^[0-9][0-9-]*$/`. Si es un número/guión, se envía como `invoice_number`; de lo contrario, como `patient`.
- **Envío controlado**: La búsqueda no dispara consultas mientras se teclea (evita saturación en la red LAN). Se confirma exclusivamente mediante el botón "Buscar" (`TOOLBAR_PRIMARY_BUTTON`) o la tecla `Enter`.
- **Período agrupado**: Agrupa "Desde" y "Hasta" dentro de un marco visual único (`RANGE_FRAME_CLASS`) con hairline y foco compartido (`data-ui-focus-frame`). Incluye validación de rango: si `date_from > date_to`, bloquea el envío y muestra un mensaje de alerta accesible (`role="alert"`).
- **Filtro de estado**: Selector (`COMPACT_SELECT_CLASS`) con opciones: Todos los estados, `issued` ("Emitida · pendiente de cobro"), `partial` ("Pago parcial"), `paid` ("Pagada") y `void` ("Anulada").
- **Filtro de caja física**: Condicionado por permiso `cash.view` (`canFilterByCash`). Si está autorizado, consulta las sesiones con `useQuery` y permite filtrar por sesión de caja específica mostrando número de caja, operador y estado (abierta/cerrada).
- **Acción Limpiar**: Botón secundario (`TOOLBAR_SECONDARY_BUTTON`) deshabilitado si no hay filtros activos ni cambios en borrador.

---

### 3.2 Paginación y Estado de URL (`useInvoiceHistoryQuery.ts`, `InvoicePagination.tsx`)

- **Paginación 100% en Servidor**: El hook `useInvoiceHistoryQuery` utiliza `useInvoices(filters)` (TanStack Query) pasando `page` y `per_page: 10` como parámetros en el query key. El backend Laravel resuelve la paginación con `PaginatedMeta` (`current_page`, `per_page`, `total`).
- **Sincronización bidireccional con URL**: Los filtros y la página se serializan en los query parameters del navegador mediante `searchParamsFromFilters`.
- **Preservación del Detalle**: Al navegar de página o filtrar, la función `withPreservedDetail` asegura que el parámetro de detalle de la operación activa (`?operacion=<id>`) no se pierda.
- **Rango visible**: Se presenta el texto localizado `resultRangeLabel(meta)` (por ejemplo, `1–10 de 42` o `Sin operaciones`), informando al usuario sobre su posición en el historial sin redundancias.
- **Control de Paginación Accesible (`InvoicePagination.tsx`)**:
  - Ventana inteligente de páginas: `[1, current - 1, current, current + 1, totalPages]`.
  - Botones "Anterior" y "Siguiente" con guardas de límite.
  - Atributos ARIA: `aria-label="Paginación de facturas"`, `aria-current="page"` para la página activa, `aria-disabled` para botones inhabilitados.
  - Identidad visual limpia: Botón activo con fondo azul `--ui-navy` y texto blanco; botones secundarios con `--ui-surface` y borde hairline `--ui-line`.

---

### 3.3 Detalle de Cuenta Contable (`RecibosDetailPanel.tsx`)

El panel de detalle implementa un diseño vertical fluido sin empaquetar la información en tarjetas aisladas:
1. **Cabecera de Operación**:
   - Micro-etiqueta "Operación", título `<h2>` con correlativo de la factura, botón de cierre (`XIcon`) con retorno de foco.
   - Nombre del paciente destacado.
   - Chip de documento emitido (`documentView`) y sello de estado financiero (`StatusStamp`).
2. **Alerta de Anulación**:
   - Si `invoice.status === 'void'`, expone un banner `AdminCallout tone="error"` indicando textualmente "Operación anulada · Motivo: <void_reason>".
3. **Sección "Cuenta"**:
   - Tabla de conceptos (`AdminTable<InvoiceItem>`):
     - **Concepto**: Nombre del servicio, categoría y badge institucional si aplica regla especial (`<FreeMedicationBadge label="Sin cobro por receta" />`).
     - **Cantidad**: Unidades formateadas mediante `QuantityText`.
     - **Precio unitario**: Moneda formateada mediante `MoneyText`.
     - **Ajuste por regla**: Resuelto por `lineAdjustmentView(item)`. Si existe deducción, muestra `− L. 25.00` en azul de acción. Si el documento es histórico y el servidor no persistió el ajuste, muestra explícitamente `Dato histórico no disponible`. Nunca inventa `L. 0.00`.
     - **Importe de línea**: Total neto de la línea.
   - Resumen monetario de la cuenta:
     - Bloque principal: Total (`strong`), Pagado, Saldo (`strong` si `saldo > 0`).
     - Bloque secundario: Subtotal, ISV, Descuento.
4. **Sección "Pagos"**:
   - Si existen pagos, lista método (Efectivo, Tarjeta, Transferencia, Otro), estado del pago (Pago registrado / Pago anulado), fecha/hora en español, sesión de caja y referencia. En caso de pago anulado, el importe aparece tachado (`line-through`) y se muestra el motivo de anulación.
   - Si no hay pagos: Mensaje claro "Esta operación no tiene pagos registrados."
5. **Sección "Documento y Registro"**:
   - Fecha de emisión, usuario emisor, caja asociada.
   - Número de comprobante institucional, estado del comprobante.
   - Contadores de auditoría: "Reimpresiones registradas" (`institutional_receipt.reprint_count`) e "Impresiones registradas" (`print_events_count`).
   - Aviso informativo de capacidad de plantilla y ejemplares configurados (`printInfoText`).
6. **Pie de Acciones Contextuales**:
   - Muestra únicamente las acciones permitidas por `invoiceActionPolicy`:
     - "Ver / imprimir recibo" (`PRIMARY_BUTTON`)
     - "Descargar PDF" (`SECONDARY_BUTTON`)
     - "Generar PDF" (`SECONDARY_BUTTON` para facturas pagadas sin comprobante)
     - "Reimprimir con motivo" (`SECONDARY_BUTTON`)
     - "Cobrar saldo" (`SECONDARY_BUTTON` para saldos pendientes)
     - "Anular" (`DANGER_BUTTON` para facturas impagas)
     - "Reversar" (`DANGER_BUTTON` para facturas con pagos)

---

### 3.4 Flujo de Reimpresión Auditada (`InvoiceHistoryActionDialogs.tsx`, `useInvoiceHistoryReceipts.ts`)

- **Regla de Auditoría**: La reimpresión no es una simple llamada a imprimir en el navegador; genera un evento en el backend (`POST /api/institutional-receipts/{id}/print-events` o `POST /api/invoices/{id}/reprint`).
- **Validación del Motivo**:
  - Diálogo `HistoryAdminDialog` con `requireReasonTextarea`.
  - Validación de longitud: mínimo 5 caracteres, máximo 500 caracteres (`requireReasonMinLength={5}`, `requireReasonMaxLength={500}`).
  - Contador interactivo en vivo: `{reasonLength}/{requireReasonMaxLength} caracteres.`
  - El botón de confirmación permanece estrictamente deshabilitado (`disabled={confirmDisabled || reasonTooShort || reasonTooLong}`) mientras el motivo tenga menos de 5 o más de 500 caracteres, o mientras la petición esté en curso.
- **Prevención de Doble Envío e Idempotencia**:
  - `payloadScopedIdempotencyKey` genera una clave única basada en el ID de factura/recibo, el motivo y el ancho.
  - Bloqueo en cliente mediante ref (`registeringReprintRef.current`).
- **Diferenciación entre Primera Impresión y Reimpresión**:
  - La primera impresión de un recibo institucional recién generado no exige motivo humano (registra el evento inicial de emisión).
  - Toda impresión posterior (cuando `has_print_events: true` o `print_events_count > 0` o `reprint_count > 0`) exige obligatoriamente motivo humano interactivo.

---

### 3.5 Anulaciones, Reversiones y Políticas de Permisos (`invoiceActionPolicy.ts`, `useInvoiceHistoryActions.ts`)

- **Matriz de Permisos (`invoiceActionPolicy`)**:
  - `void` (Anulación de factura): Requiere permiso `invoices.void` Y (`invoices.operate_any` O `isOwnInvoiceFromToday`) Y estado de factura estrictamente `issued` (impaga).
  - `reverse` (Reversa de factura y pagos): Requiere permiso `invoices.reverse` Y (`invoices.operate_any` O `isOwnInvoiceFromToday`) Y estado `paid` o `partial`.
  - `collectPayment` (Cobro de saldo): Requiere `payments.create` Y (`invoices.operate_any` O `isOwnInvoiceFromToday`) Y estado `issued` o `partial`.
  - `reprint` (Reimpresión): Requiere `receipts.reprint` Y (`receipts.reprint_any` O `isOwnInvoiceFromToday`) Y presencia de comprobante.
  - Factura anulada (`invoice.status === 'void'`): La política retorna inmediatamente `NO_ACTIONS`, bloqueando cualquier acción operativa adicional.
- **Diálogos de Confirmación Peligrosa**:
  - Diálogos dedicados con `DANGER_BUTTON` ("Anular Factura", "Reversar Factura").
  - Motivo de anulación/reversa obligatorio con validación mínima de 5 caracteres.
  - Las acciones ejecutan invalidación controlada del cache (`invalidateBillingQueries`) y refrescan la auditoría.

---

### 3.6 Adaptabilidad Móvil y Experiencia Táctil (`RecibosTable.tsx`, `RecibosUi.ts`)

- **Doble Presentación**:
  - En pantallas medianas y de escritorio (`md` en adelante): Tabla HTML estándar (`AdminTable`) con scroll horizontal protegido (`minTableWidth="44rem"`), evitando compresión antiestética de columnas o cifras truncadas.
  - En pantallas móviles (`< md`): Lista de tarjetas apiladas (`RecibosMobileCard`). Cada tarjeta condensa correlativo, documento, paciente, fecha, total, comprobante y estado sin requerir desplazamiento horizontal.
- **Sincronización de Orden**: El selector de orden en móvil (`#recibos-mobile-sort`) y las cabeceras ordenables de la tabla de escritorio comparten el mismo estado de ordenamiento `sort`, garantizando consistencia absoluta en 390 px y en 1440 px.
- **Ergonomía Táctil**:
  - Botones móviles con altura mínima de 44 px (`min-h-11`, `ICON_BUTTON_TOUCH` con `size-11` = 44×44 px), cumpliendo las pautas WCAG para objetivos táctiles.
  - Efecto táctil presionado: `enabled:active:scale-[0.96]`, deshabilitado ante `motion-reduce:active:scale-100`.

---

## 4. Verificación Estática y Pruebas Automatizadas

Se ejecutaron los tres comandos de verificación obligatorios en el entorno del frontend:

### 4.1 Comprobación de Tipos TypeScript (`npm run typecheck`)
```bash
> s-hospital-frontend@0.1.0 typecheck
> tsc --noEmit
```
**Resultado**: Exitoso (código de salida 0). Cero errores de tipado en todo el proyecto frontend.

### 4.2 Guardia de Diseño Limpio (`node scripts/check-no-legacy-ui.mjs --mode=strict`)
```bash
[QUALITY GATE PASSED] modo=strict; 397 archivos; 0 violaciones.
Módulos estrictos: src/App.tsx, src/components/ui/, src/components/AppErrorBoundary.tsx, src/components/PermissionGate.tsx, src/design-system/components/, src/design-system/admin/, src/design-system/patterns/, src/design-system/providers/, src/hooks/use-mobile.ts, src/hooks/useTheme.ts, src/navigation/adminNavigation.ts, src/shell/admin/, src/features/resumen/, src/features/cobrar/, src/features/recibos/, src/features/caja/, src/features/reportes/, src/features/administracion/, src/features/admin/, src/features/auth/, src/features/backups/, src/features/cash/, src/features/catalog/, src/features/receipts/, src/features/receipt-settings/, src/features/settings/, src/features/invoices/components/, src/features/invoices/history/, src/features/invoices/hooks/, src/features/invoices/state/, src/features/reports/components/, src/modules/accounting/, src/modules/billing/
```
**Resultado**: Exitoso (código de salida 0). 0 violaciones de tokens legados o clases cromáticas no autorizadas (emerald, purple, violet, indigo) en 397 archivos auditados.

### 4.3 Pruebas Unitarias de Recibos (`npx vitest run src/features/recibos/`)
```text
 ✓  src/features/recibos/RecibosFilters.test.tsx (7 tests)
 ✓  src/features/recibos/RecibosTable.test.tsx (12 tests)
 ✓  src/features/recibos/RecibosView.test.tsx (8 tests)
 ✓  src/features/recibos/RecibosView.reprint.test.tsx (2 tests)
 ✓  src/features/recibos/RecibosDetailPanel.test.tsx (6 tests)
 ✓  src/features/recibos/recibosModel.test.ts (12 tests)

 Test Files  6 passed (6)
      Tests  47 passed (47)
   Duration  7.23s
```
**Resultado**: Exitoso (código de salida 0). 47 pruebas pasando al 100%.

### 4.4 Pruebas de Soporte Historial (`npx vitest run src/features/invoices/history/`)
```text
 ✓  src/features/invoices/history/invoiceHistoryReceiptRules.test.ts (7 tests)
 ✓  src/features/invoices/history/InvoicePagination.test.tsx (4 tests)

 Test Files  2 passed (2)
      Tests  11 passed (11)
```
**Resultado**: Exitoso (código de salida 0). 11 pruebas pasando al 100%.

---

## 5. Análisis de Brechas (Gap Analysis) frente a R3 y Mandato §5

| Requisito R3 / Mandato §5 | Estado Actual | Evidencia en Código | Brecha / Observación |
|---|---|---|---|
| **Búsqueda por paciente, número, fecha y estado** | Cumplido al 100% | `RecibosFilters.tsx:71-80, 114-162` | Ninguna. Soporta paciente, número correlativo, rango con validación temporal, estados fiscales y sesión de caja física. |
| **Paginación robusta en servidor** | Cumplido al 100% | `useInvoiceHistoryQuery.ts:41-85`, `InvoicePagination.tsx:13-86` | Ninguna. Paginación de 10 elementos sincronizada con TanStack Query y query params en URL. |
| **Detalle de la cuenta y desglose** | Cumplido al 100% | `RecibosDetailPanel.tsx:231-303` | Ninguna. Muestra conceptos, cantidad, precio, regla EPO ("Sin cobro por receta"), ajuste histórico no inventado, total, saldo, pagos y auditoría. |
| **Cobro de saldos cuando aplique** | Cumplido al 100% | `RecibosView.tsx:359-391`, `useInvoiceHistoryActions.ts:91-136` | Ninguna. Integra `PaymentModal` validando sesión de caja abierta y actualizando el saldo en vivo. |
| **Reimpresión auditada con motivo obligatorio (5-500)** | Cumplido al 100% | `InvoiceHistoryActionDialogs.tsx:224-251`, `useInvoiceHistoryReceipts.ts:366-449` | Ninguna en funcionalidad básica. *Observación menor*: El conteo actual de reimpresiones previas se muestra claramente en el panel de detalle lateral (`RecibosDetailPanel.tsx:323-325`), pero dentro del cuerpo textual del modal de confirmación no se interpola explícitamente "Reimpresión #N" (aunque el modal indica que la reimpresión quedará auditada). |
| **Anulaciones y reversiones controladas por permisos** | Cumplido al 100% | `invoiceActionPolicy.ts:40-82`, `InvoiceHistoryActionDialogs.tsx:282-378` | Ninguna. Permisos diferenciados (`invoices.void` para issued vs `invoices.reverse` para paid/partial), con motivo ≥ 5 caracteres y registro en auditoría. |
| **Adaptabilidad responsive sin recortar datos** | Cumplido al 100% | `RecibosTable.tsx:264-339, 361-444` | Ninguna. Scroll horizontal con ancho mínimo de 44rem en escritorio y tarjetas apiladas completas con touch targets de 44px en pantallas < md. |
| **Identidad visual Azul y Blanco (#2563EB)** | Cumplido al 100% | `recibosUi.ts`, `tokens.css`, `check-no-legacy-ui.mjs` | Ninguna. Cero clases de colores legados (púrpura/verde/índigo), cifras en `tabular-nums` con moneda unida (`L. 15.00`), micro-interacción `scale(0.96)`. |

---

## 6. Conclusión y Recomendaciones

La implementación del frontend de Recibos e Historial de Operaciones (`src/features/recibos/`) se encuentra en un estado **maduro, completo y completamente conforme** con la campaña Azul y Blanco, el Mandato §5 y los requisitos de R3.

No se requieren reescrituras estructurales ni intervenciones mayores para el hito M3 en el frontend. El frontend está listo para la integración y las pruebas de laboratorio conjuntas con backend y E2E.
