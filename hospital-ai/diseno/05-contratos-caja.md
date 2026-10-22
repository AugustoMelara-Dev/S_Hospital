# Contrato de pantalla — Caja (`/cashbox` y diálogo Caja rápida)

Fuente: `CashBoxView.tsx:62-637`, `components/OpenSessionForm.tsx`, `components/CashClosingPanel.tsx`, `components/CashDenominationCounter.tsx`, `components/CloseSessionDialog.tsx`, `components/CashMovementsTable.tsx`, `components/CashMethodSummary.tsx`, `modules/accounting/components/AccountingControlPanel.tsx`.
Guard: `cash.view` (`appNavigation.ts:78-92`). Capacidades: `cash.open`, `cash.close`, `cash.close_any`, `invoices.create`, `reports.cash_session.view` (`useHospitalSession.ts:30-45`).

## CAJA-1 · Propósito

Abrir turno con fondo inicial, monitorear la sesión (métodos, movimientos, saldo pendiente, recibos pendientes), arquear el efectivo físico y cerrar con diferencia y notas auditadas. La sesión se auto-refresca cada 10 s y al recuperar foco (`CashBoxView.tsx:103-110`); movimientos cada 15 s (`:137`).

## CAJA-2 · Estados obligatorios

| Estado | Comportamiento actual | Evidencia | Contrato Tanda 2 |
|---|---|---|---|
| Carga | "Cargando estado de caja..." `role="status"` | `:58,444-446` | conservar |
| Sin caja | formulario de apertura (si `cash.open`) o alerta "modo consulta" | `:579-586` | mantener ambas rutas claras |
| Caja abierta propia | métricas + vistas | `:477-578` | — |
| Caja abierta de otro cajero | alerta "Caja abierta en supervisión"; sin botón "Nueva factura" | `:448-452`, `:385-387` | no permitir facturar desde caja ajena |
| Caja abierta sin `invoices.create` | alerta "modo consulta" | `:450-452` | — |
| Error de sesión | alerta destructiva + Reintentar | `:432-442` | conservar |
| Movimientos: carga/error/vacío | spinner / error + Reintentar / `Empty` "Sin movimientos" | `:549-570` | conservar |
| Movimientos sin permiso | alerta "Movimientos no disponibles" | `:575-577` | explicar permiso faltante |
| Datos largos | tabla de movimientos con búsqueda y paginación móvil | `CashMovementsTable.tsx:35+` | conservar búsqueda y no romper montos |
| Cierre exitoso | panel de resumen del cierre (`CashCloseSummaryPanel`) | `:458-475` | conservar resumen con diferencia |

## CAJA-3 · Apertura (validación, confirmación, doble submit)

- Formulario `OpenSessionForm` con monto inicial (puede ser L 0.00) (`OpenSessionForm.tsx:22`).
- Confirmación deliberada en diálogo con el monto y copy "Esta apertura quedará auditada" (`CashBoxView.tsx:611-621`).
- Doble submit: `openingSessionInFlightRef` + `openSessionMutation.isPending` + bloqueo del diálogo (`:87,241,266-277,322`).
- Idempotencia por payload de apertura (`:145-156`).
- Error: alerta "No se pudo abrir caja" conservando el valor escrito (`:172-176`).

## CAJA-4 · Vistas internas (ToggleGroup "Resumen | Movimientos | Arqueo | Cierre")

- `aria-label="Vista activa de caja"` (`:479-493`); el estado de vista es local (no URL). Contrato: conservar la vista al refrescar datos, pero es aceptable perderla al recargar la página.
- **Resumen**: métodos de pago (`CashMethodSummary`), pagos, pendientes.
- **Arqueo**: contador de denominaciones HNL L1-L500 + "Monedas y otros" (no inventar monedas; `docs/ux/2026-07-15-operational-ux-research-decisions.md:46-56`) y panel contable con la diferencia calculada contra `expected_cash_amount` (autoridad del servidor, `CashBoxView.tsx:219-230`).
- **Cierre**: `CashClosingPanel` con monto contado editable o derivado del conteo, notas y bloqueos.

## CAJA-5 · Cierre: bloqueos y recuperación (regla financiera preservada)

Antes de confirmar, la UI refresca la sesión y bloquea si:
- hay facturas pendientes/parciales: "No se puede cerrar caja con N factura(s) pendientes o parciales por L ..." (`:310-313`);
- hay recibos institucionales pendientes: "No se puede cerrar caja con N recibo institucional pendiente. Genere el recibo antes de cerrar." (`:314-317`);
- falla el refresco: "No se pudo actualizar caja antes de cerrar..." (`:298-303`);
- monto contado vacío o inválido: error local + foco al campo (`:286-297`);
- sin permiso `cash.close`: "Este usuario no tiene permiso para cerrar caja." (`:282-285`).
- El diálogo final de cierre muestra desglose/notas/diferencia y `isSubmitting` (`:589-609`).
- Doble submit: `closingSessionInFlightRef` + `closeSessionMutation.isPending` (`:322-326`), idempotencia por `{id, payload}` (`:182-193`).
- El conteo físico por denominaciones genera `closing_breakdown` solo si hay conteo (`:330-332`), y se limpia al cambiar de sesión (`:243-258`).

## CAJA-6 · Diferenciación sin color

- Estado de caja: badge + texto ("Caja abierta desde ...", "No hay una caja abierta actualmente") en `role="status"` (`:396-405`).
- "Pagos bloqueados" es alerta con título y descripción (`:454-456`).
- Métricas "Recibos pendientes" muestran número + detalle "bloquean cierre" (`:421-425`).
- Diferencia: `hasCashDifference` cambia copy y el panel de arqueo comunica signo y monto; no confiar solo en rojo/verde.

## CAJA-7 · Teclado/foco

- Al entrar a la vista Cierre con caja abierta, el foco va al monto contado (`:260-264`).
- Errores de validación devuelven el foco al campo contado (`:289,295`).
- Controles de denominaciones: inputs numéricos etiquetados; "Continuar" desde arqueo cambia a Cierre (`CashDenominationCounter`).
- `F2` "abrir caja" anunciado (`shortcuts.ts:57-61`) sin handler (HS-UX-03).
- Diálogos Radix atrapan foco; cierre con `Esc` no debe disparar el cierre de sesión.

## CAJA-8 · Caja rápida (diálogo del shell)

- `App.tsx:155-176`: diálogo con el mismo `CashBoxView` en modo `compact`; título "Caja activa"/"Abrir caja".
- Contrato: misma semántica de confirmación y bloqueos; no duplicar lógica; el diálogo no debe permitir facturar por sí mismo.
- Pendiente de contrato específico: tamaño/scroll del diálogo a 1366x768 con desglose de denominaciones visible (`styles.css:88-90` define `quick-cash-dialog`).

## CAJA-9 · Criterios de aceptación Tanda 2

1. Un `h1` "Caja"; métricas en `<dl>`; sin overflow en la matriz de viewports.
2. Bloqueos de cierre visibles y accionables: enlace a Historial para resolver pendientes o recibos.
3. Apertura y cierre no se duplican con doble clic/Enter repetido.
4. Conteo por denominaciones produce un breakdown que el backend acepta; la UI no recalcula la verdad financiera.
5. Errores conservan montos y notas escritas.
6. Caja de otro cajero no ofrece "Nueva factura" y explica supervisión.

## CAJA-10 · Pendiente de inspección manual

- Densidad real del contador de 9 denominaciones + campo "otros" a 1366x768.
- Legibilidad de la tabla de movimientos con referencias largas y en móvil.
- Flujo físico de arqueo con teclado numérico externo (requisito de hardware, `SYSTEM_REQUIREMENTS.md:81`).
