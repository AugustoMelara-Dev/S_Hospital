# Contrato de pantalla — Historial, detalle y acciones de factura (`/invoices`)

Fuente: `InvoiceHistoryView.tsx:65-1286`, `history/InvoiceHistoryTable.tsx:59-331`, `history/InvoiceDetailDrawer.tsx:39-232`, `history/InvoiceHistoryFilters.tsx`, `hooks/useInvoices.ts`, `lib/queryInvalidation.ts`, `modules/invoices/application/invoiceActionPolicy.ts:37-88`.
Guard: `invoices.view` (`appNavigation.ts:108-122`).

## HIST-1 · Propósito

Consultar facturas con filtros y paginación; abrir detalle; y ejecutar solo las acciones autorizadas por política: cobrar, ver/descargar/generar recibo institucional, reimprimir con motivo, reversar pagos y anular. Estado del deep link: `?invoice=<id>` abre el drawer de detalle (`:147-170`).

## HIST-2 · Búsqueda, filtros y tabla

- Filtros: fechas, estado, paciente, número de factura; más criterios de conciliación por caja (`reconciliation_cash_session_id` + `balance_state=pending` o `receipt_state=missing`) que muestran una alerta explicativa (`:795-804,1206-1232`).
- Filtros viven en la URL (compartible/recargable) y se reflejan en `useInvoices(filters)` (`:69,134,172-193`).
- Tabla escritorio: columnas Factura, Fecha, Paciente, Total, Pagado, Saldo, Estado, Recibo, Acciones; personalización de columnas con menú (`InvoiceHistoryTable.tsx:92-115`).
- Móvil (<768 px): lista de tarjetas con `dl` Total/Pagado/Saldo/Estado/Recibo (`:145-184`).
- Paginación explícita con Anterior/Siguiente y páginas; estado deshabilitado con `aria-disabled` y `tabIndex=-1` (`InvoiceHistoryView.tsx:1083-1101`).

## HIST-3 · Estados obligatorios

| Estado | Comportamiento actual | Evidencia | Contrato Tanda 2 |
|---|---|---|---|
| Carga | skeleton + "Cargando facturas..." con `role="status"` | `:816-821` | conservar |
| Vacío | `Empty` "No hay facturas"/"No se encontraron facturas con los filtros" + botón limpiar filtros | `:814-815` | conservar causa + acción |
| Error de carga sin cache | alerta destructiva "No se pudo cargar el historial" + Reintentar | `:806-808` | conservar |
| Error de refresco con cache | alerta no destructiva "No se pudo actualizar el historial" + Reintentar; datos previos visibles | `:810-812` | no vaciar la tabla por un fallo de red |
| Detalle: carga/error | skeleton dentro del drawer; alerta con el error sin cerrar | `InvoiceDetailDrawer.tsx:105-114` | permitir reintento explícito |
| Datos largos | paginación 10/página; tabla con scroll; mobile list | `:857-864` | sin truncar números de factura; `break-all` móvil (`InvoiceHistoryTable.tsx:157`) |
| Éxito de acción | los diálogos se cierran y la fila/detalle se sincronizan con la respuesta | `:554-566,602-614` | feedback persistente en pantalla (no solo toast) |

## HIST-4 · Acciones autorizadas (política única)

`invoiceActionPolicy.ts:41-81` decide:
- **Cobrar**: `payments.create` + (propia de hoy o `invoices.operate_any`) + estado `issued|partial`.
- **Ver recibo**: `receipts.view` + permiso de operación + recibo institucional emitido, o fallback de comprobante histórico si `paid|partial` sin recibo y sin generación posible.
- **Descargar**: solo con recibo institucional emitido.
- **Generar PDF**: `payments.create` (como `canIssueInstitutionalReceipt`) + operación + `paid` + sin recibo.
- **Reimprimir**: `receipts.reprint` + (`receipts.reprint_any` o propia de hoy) + recibo reimprimible.
- **Reversar pago**: `invoices.reverse` + operación + `paid|partial`.
- **Anular**: `invoices.void` + operación + `issued`.
- Factura `void`: sin acciones (`:41-43`).
- La UI nunca sustituye autorización de servidor; es el mismo contrato repetido en drawer (`InvoiceDetailDrawer.tsx:55-93`) y fila (`InvoiceHistoryTable.tsx:195-296`).

## HIST-5 · Anulación y reversa (validación/confirmación/recuperación)

- Motivo obligatorio ≥5 caracteres con contador textual, `aria-invalid`, ayuda y error `role="alert"` (`InvoiceHistoryView.tsx:1003-1026,1051-1074`).
- Confirmación bloquea el botón hasta cumplir el mínimo (`:992,1040`).
- Copy advierte consecuencias: anulación "no se puede deshacer"; reversa "Reversa los pagos registrados, crea movimientos compensatorios y deja auditoría" (`:1019-1021,1067-1069`).
- Error del servidor: mensaje seguro en estado, el diálogo permanece; los refs se liberan en `finally` (`:567-577,615-625`).
- Foco: `LocalConfirmDialog` guarda y restaura el foco al disparador (`:1134-1149`).

## HIST-6 · Reimpresión (semántica exacta, no falsificar primera impresión)

- El botón "Reimprimir" en vista de recibo solo aparece tras eventos de impresión; la primera impresión se etiqueta "Imprimir recibo" (`:958` en `InvoiceHistoryView.tsx` combinado con `hasInstitutionalPrintEvents` `:1184-1186`).
- Motivo humano obligatorio en el diálogo de reimpresión (mínimo 5, ayuda "Explique por que se entrega otra copia...") `:963-981`.
- Reimpresión institucional: abre PDF y registra `print-events` con motivo e idempotencia (`:649-677`).
- Reimpresión legacy: `apiClient.reprintInvoice` con ancho + motivo (`:679-704`).
- Contador: la UI incrementa `print_events_count`/`reprint_count` al imprimir desde venta (`useIssuedReceiptActions.ts:31-41`). No prometer control de impresión física de un PDF ya descargado: el evento registra solicitud/entrega digital, no papel (HS-PRINT-DELIVERY, hs-receipts).
- Nunca llamar reimpresión a la primera solicitud; conservar la etiqueta exacta.

## HIST-7 · Cobro desde historial

- `PaymentModal` reutilizado; monto precargado con `balance_due`; si no hay caja abierta, error "Abra caja antes de registrar el cobro." sin perder datos (`:493-529`).
- Idempotencia por `{invoiceId, payload}` y reset tras éxito (`:509-516`).
- Tras cobrar intenta generar/abrir recibo institucional de forma idempotente (`:363-409`); si falla, el error queda visible y la deuda sigue recuperable desde el historial.

## HIST-8 · Diferenciación de estados (factura emitida / pagada / anulada / recibo pendiente)

- Badge textual: Pagada / Emitida / Parcial / Anulada (`InvoiceHistoryTable.tsx:303-306`, `InvoiceDetailDrawer.tsx:129-131`) — color + texto.
- Columna "Recibo" textual: número + "PDF emitido" vs "Recibo pendiente" vs "Anulada" vs "Pendiente de pago" (`InvoiceHistoryTable.tsx:308-330`).
- Saldo con `text-warning` **y** `font-semibold` (`:98,170,190`); no es el único indicador (la etiqueta "Saldo" y el valor están presentes).
- Pago anulado en detalle: `line-through` + badge "Pago anulado" + `aria-label` "Monto anulado ..." (`InvoiceDetailDrawer.tsx:183-202`).
- Alertas de conciliación explican el criterio activo por caja (`InvoiceHistoryView.tsx:795-804`).
- Contrato Tanda 2: cada estado debe conservar texto/hueco semántico además del color; prohibido depender de un solo tono.

## HIST-9 · Teclado/foco

- Fila: botón de número de factura con `data-invoice-detail-trigger` y `aria-label` "Ver detalle de la factura ..." (`InvoiceHistoryTable.tsx:93,157`).
- Drawer: cierra y devuelve foco al disparador de la fila correspondiente o a la sección (`InvoiceHistoryView.tsx:240-255`; `InvoiceDetailDrawer.tsx:98`).
- Acciones: menú `DropdownMenu` con `aria-label` por factura (`:296`), botones con icono + texto.
- `F8` reimprimir última factura está anunciado (`shortcuts.ts:68-71`) pero no implementado (HS-UX-03).
- Contrato: todo control debe ser alcanzable por Tab, activable con Enter/Espacio, y el foco nunca debe quedar detrás de un overlay.

## HIST-10 · Criterios de aceptación Tanda 2

1. Un `h1` "Historial de facturas"; la tabla/lista conserva relaciones encabezado-celda en escritorio y `dl` en móvil.
2. Sin overflow a 320/390/768/1024/1366/1920 px; número de factura nunca truncado.
3. "Recibo pendiente" es visible como texto en tabla, móvil y detalle.
4. Anular/reversar/reimprimir exigen motivo y no duplican operación con doble clic.
5. Error de refresco conserva datos; error de carga ofrece reintento.
6. Deep link `?invoice=` abre el detalle correcto y es restaurable.

## HIST-11 · Pendiente de inspección manual

- Anchura real de columnas con 8 columnas visibles a 1366 px y montos largos.
- Comportamiento de tabla con 50+ filas y menú de acciones abierto (posición del menú).
- Contraste de "Recibo pendiente" en ambos temas.
