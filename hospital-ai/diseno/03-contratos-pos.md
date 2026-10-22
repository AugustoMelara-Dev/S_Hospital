# Contrato de pantalla — POS / Nueva factura (`/billing/new`)

Fuente: `NewInvoiceView.tsx:41-651`, `NewInvoiceViewLayout.tsx:66-354`, `state/reducer.ts`, `state/posMath.ts`, `components/*`, `hooks/*`.
Guard: `PermissionGate` con `invoices.create` + `catalog.view` + `cash.view` + `payments.create` + `receipts.view` (modo `all`), `appNavigation.ts:61-76`.

## POS-1 · Propósito y jerarquía

Una sola estación para: identificar paciente → buscar/agregar servicios → revisar cuenta → emitir → cobrar → entregar recibo. En escritorio ≥1280 px la cuenta es columna sticky a la derecha (`NewInvoiceViewLayout.tsx:69,248-259`); por debajo, barra inferior fija + drawer (`:262-267`).

Regiones con `aria-label`: Paciente (`:214`), Servicios (`:224`), Cuenta actual (`:250`), Acciones de facturación (`:163`).

## POS-2 · Estados obligatorios

| Estado | Comportamiento actual | Evidencia | Contrato Tanda 2 |
|---|---|---|---|
| Carga inicial de servicios/caja | spinner/skeletons vía `loadingServices`; `status` "Cargando servicios..." | `NewInvoiceView.tsx:167-199`; `ServiceSearch.tsx:311` | mantener, sin saltos de layout |
| Vacío de búsqueda | "Sin servicios encontrados" + "Revise la búsqueda o quite filtros..." y botón Limpiar | `ServiceSearch.tsx:316-321,283-295` | mostrar causa y recuperación |
| Error de carga | alerta + `Reintentar` (`onRetryLoad`) + foco vuelve a búsqueda | `NewInvoiceViewLayout.tsx:196-198`, `NewInvoiceView.tsx:227-236` | conservar carrito/paciente ante error |
| Caja cerrada | alerta "Debe abrir la caja antes de emitir facturas" con "Abrir Caja" o "Ir a caja" | `NewInvoiceViewLayout.tsx:177-194` | no bloquear la preparación del borrador; bloquear solo emisión |
| Datos largos | paginación "cargar más" de servicios (24 por página) | `NewInvoiceView.tsx:29,208-224` | teclado: mantener foco al agregar; no resetear scroll |
| Éxito de emisión | diálogo de éxito con número, total, cobro/recibo | `InvoiceSuccess.tsx` | anunciar con `role="status"`/foco controlado |
| Cobro registrado + recibo listo | diálogo de éxito con "Ver recibo/Imprimir/Guardar PDF" | `NewInvoiceView.tsx:458-475` | no re-cobrar; PDF como acción |
| `receipt_recovery` (pago registrado, recibo pendiente) | aviso persistente "Genere el recibo institucional desde Historial..." en éxito | `NewInvoiceView.tsx:477-490,558-569`; `modules/billing/application/paymentOutcome.ts` | **conservar**; recuperación idempotente, cierre bloqueado |
| Sin permiso de cobro/recibo | emite y avisa pendiente de cobro | `NewInvoiceView.tsx:348-370` | mensaje operativo claro |
| Validación fallida | paciente: error de campo + foco; carrito vacío: alerta | `useNewInvoiceValidation.ts:24-62` | nunca perder datos |

## POS-3 · Teclado y foco (contrato preciso)

- `Ctrl+N` → foco a paciente; `Ctrl+B` → foco a búsqueda; `Ctrl+Enter` → emitir si `canEmit`, si no validar (`useNewInvoiceShortcuts.ts:40-67`; catálogo `shortcuts.ts:28-56`).
- `F6` "foco en escaneo" está anunciado pero **no implementado** (HS-UX-03); mientras siga anunciado, debe implementarse.
- `Escape` con borrador no vacío abre confirmación de limpieza; nunca limpia directo; se ignora dentro de inputs y con overlays abiertos (`useNewInvoiceShortcuts.ts:48-56`).
- `Enter` en paciente valida y salta a búsqueda (`NewInvoiceView.tsx:275-283`); `Enter` en la búsqueda agrega el primer resultado visible o arma la auto-selección del primer resultado cuando llegue (`ServiceSearch.tsx:191-203`); conservar esta semántica de escaneo por pistola y no robar el foco del campo.
- EPO visible con texto explícito: "Precio L 25.00; gratis solo con receta de diálisis autorizada." (`ServiceSearch.tsx:371-375`); no reformular la regla.
- Filas de servicio con `aria-label` "Agregar ..., N en la cuenta" (`ServiceSearch.tsx:344`); activables con Enter y clic (`:348-352`).
- Limpiar borrador devuelve foco a paciente (`NewInvoiceView.tsx:99-103`).
- Orden de tabulación esperado: Paciente → filtros (área/categoría/búsqueda) → resultados → cuenta (cantidades, quitar, EPO) → acción principal (Emitir y cobrar / Emitir factura) → acciones secundarias (Historial, Limpiar borrador). El botón principal es el último del flujo de la cuenta, no el primero.
- En móvil el drawer de cuenta debe atrapar foco y devolverlo al disparador al cerrar (`BillingAccountDrawer` / `closeAccount` `NewInvoiceViewLayout.tsx:128-133`).

## POS-4 · Validación, confirmación y recuperación

- Emisión exige: caja abierta + paciente + ≥1 servicio (`NewInvoiceView.tsx:105-114`); razones visibles como `disabledReasons` en el carrito (`NewInvoiceViewLayout.tsx:148`).
- Confirmación de emisión muestra paciente, ítems y precios congelados del carrito (`InvoiceConfirmation`), más `cashSessionId` (`:269-279`). Confirmar antes de cobrar es requisito de negocio (PROMPT_MAESTRO §7G).
- EPO: la marca de receta de diálisis solo aparece con `patients.mark_dialysis_prescription`; sin permiso los ítems se envían con `dialysisPrescription: false` (`NewInvoiceView.tsx:150-155`). No inventar descuentos ni exenciones nuevas.
- Error de emisión: si el backend devuelve `validationErrors.patient_name`, se muestra junto al campo y se enfoca el paciente; otros errores van a alerta general conservando carrito (`:376-391`).
- Error de pago: se mantiene el modal abierto con el mensaje y los montos escritos (`:501-509`).
- PDF/recibo: `openBlobInNewTab` cae a descarga si el navegador bloquea la ventana (`lib/download.ts:12-23`); conservar y documentar este comportamiento como recuperación.

## POS-5 · Doble submit e idempotencia (no romper)

- Refs en vuelo: `emitConfirmationInFlightRef`, `submitInvoiceInFlightRef`, `submitPaymentInFlightRef`, `receiptGenerationIdempotencyKeyRef` (`NewInvoiceView.tsx:57-65`).
- Claves idempotentes por payload: emisión (`:333-339`), pago (`:437-443`), recibo cero (`:531-538`); se resetean al completar (`:340,444,538`) y al cambiar paciente/carrito/EPO (`:89-91`).
- Confirmación bloqueada 300 ms en el layout (`NewInvoiceViewLayout.tsx:68,119-127`).
- El botón "Emitir y cobrar" se deshabilita con `state.submitting` (`:147`); el modal de pago con `submitting=state.paying` (`:298`). Nunca bloquear indefinidamente: el `finally` siempre libera los refs.

## POS-6 · Diferenciación de estados sin depender del color

- Advertencia "Factura pendiente" vs error "Revise antes de continuar" vs éxito "Servicio agregado" son alertas tituladas (`NewInvoiceViewLayout.tsx:196-207`).
- Saldo pendiente se refuerza con texto ("Quedo pendiente de cobro") además de tipografía; el carrito muestra subtotal/ISV/total en `<dl>` (`InvoiceCart.tsx:162+`).
- El estado de caja se comunica con texto en alerta y en el shell, no solo por badge de color.

## POS-7 · Mensajes al operador (tono y contenido)

- Acciones: "Factura emitida 000-... Cobro abierto.", "Pago registrado. Recibo institucional ... listo para ver o imprimir." (`:360,469`).
- Recuperación: "Factura emitida, pero no se pudo emitir el recibo institucional: ... Genere el recibo institucional desde Historial antes de entregar comprobante." (`:560`).
- Nunca mostrar JSON, stack ni códigos internos; usar `userSafeErrorMessage`.

## POS-8 · Criterios de aceptación Tanda 2

1. Un `h1` "Nueva factura"; regiones etiquetadas; sin overflow a 320/390/768/1024/1366/1920 px.
2. Flujo completo por teclado: paciente → búsqueda → agregar → cuenta → emitir → cobrar → recibo, sin usar mouse.
3. Doble `Ctrl+Enter` o doble clic no produce dos facturas/pagos (idempotencia conservada).
4. Error recuperable no borra paciente, carrito ni montos.
5. `receipt_recovery` visible con ruta de recuperación desde Historial y sin re-cobro.
6. Foco visible en todos los controles; retorno de foco correcto al cerrar drawer/diálogos.

## POS-9 · Pendiente de inspección manual

- Anchura real de la columna de cuenta a 1366 px con 20 ítems y nombres largos de servicios.
- Comportamiento con lector de pantalla en la lista virtualizada/paginada de servicios.
- Pistola de códigos: foco real y `Enter` en campo de búsqueda (sin navegador no verificable).
