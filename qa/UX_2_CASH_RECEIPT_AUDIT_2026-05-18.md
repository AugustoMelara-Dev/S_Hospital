# UX-2 Caja, cierre y recibo - Auditoria 2026-05-18

Decision: **UX-2 APROBADA** para flujo local/browser de caja y recibo.

Estado de release recomendado: **PRODUCTION_CANDIDATE**. No declarar `PRODUCTION_READY` hasta validar impresora institucional fisica, segundo cliente LAN real y configuracion final del servidor.

## Alcance

Frente validado: caja, apertura, cierre, resumen por metodo, efectivo esperado, recibo institucional A5/carta/media carta/80mm/58mm, preview, impresion explicita y reimpresion explicita desde historial.

No se tocaron migraciones, reglas fiscales, CORS/Sanctum, permisos backend, reportes/admin/backups/fiscal fuera de navegacion minima de smoke, ni UX-3/UX-4/UX-5.

## Medicion antes

URL: `http://127.0.0.1:8000`.

Usuario usado: `admin.validacion` / admin.

Estado antes: caja admin #1 abierta con apertura L.500.00, 58 pagos, total pagos L.2794.50 y efectivo esperado L.3294.50.

Caja usada durante medicion antes:

- Se cerro caja #1 con contado L.3294.50 para medir estado cerrado.
- Se abrio caja #3 con L.0.00 y se cerro con L.0.00.
- Se abrio caja #4 con L.100.00.
- Se intento abrir caja duplicada por API y backend respondio 422 con `El cajero ya tiene una caja abierta.`
- Se emitio y cobro factura `000-001-01-00000088`, paciente `UX2 Caja 1779167395713`.
- Se cerro caja #4 con contado igual al efectivo esperado.
- Se abrio caja #5 con L.50.00 y se cerro con L.40.00 mas nota por diferencia.

Hallazgos antes:

- El formulario de apertura aceptaba L.0.00, pero prellenaba L.500.00, lo que empujaba a registrar efectivo no contado.
- El cierre mostraba diferencia antes de ingresar monto contado.
- Habia dos entradas de monto contado en la misma pantalla: una en el resumen y otra en el formulario de cierre.
- El error por monto contado vacio aparecia, pero el estado visual ya insinuaba una diferencia.
- El resumen por metodo no mostraba `Otros` y explicaba poco que tarjeta/transferencia no entran al efectivo esperado.
- El recibo A5/carta/media carta/80mm/58mm, preview y reimpresion auditada funcionaban.
- Cambiar preview 80mm/58mm desde historial no llamaba `/reprint`; solo el boton `Reimprimir` lo hacia.
- Print CSS estaba condicionado por `body[data-printing-receipt="true"]`.
- Consola/red: sin 401/419/CORS/500. Hubo un 422 esperado en el intento deliberado de caja duplicada y warnings de descripcion accesible en dialogos de recibo/historial.

Decision antes: **REQUIERE CAMBIOS**.

## Cambios realizados

- `frontend/src/features/cash/components/OpenSessionForm.tsx`
  - Apertura ahora inicia en L.0.00.
  - Copy aclara que puede abrir con L.0.00.

- `frontend/src/features/cash/components/SessionSummary.tsx`
  - Se elimino el segundo campo editable de monto contado.
  - El resumen ahora muestra apertura, efectivo esperado, cobros en efectivo y estado de contado/diferencia.
  - La diferencia queda pendiente hasta que exista monto contado valido.
  - Se explica que tarjeta y transferencia no aumentan efectivo esperado.

- `frontend/src/features/cash/CashBoxView.tsx`
  - La diferencia solo se calcula con monto contado valido.
  - Cierre vacio muestra error cerca de `Monto Contado`.
  - Foco va a `closing_amount` al entrar a caja abierta y al fallar cierre vacio.
  - Resumen por metodo incluye `Otros` y explicacion de conciliacion.

- `frontend/src/features/invoices/InvoiceHistoryView.tsx`
  - El dialogo de recibo en historial ahora tiene descripcion accesible.

- `frontend/src/App.test.tsx`
  - Cobertura para apertura default L.0.00.
  - Cobertura para no mostrar diferencia antes del monto contado y mantener un solo campo de contado.

- `qa/visual-smoke/phase-12-visual-smoke.mjs`
  - `ensureCashOpen` ahora confirma caja abierta con `/api/cash-sessions/current`, no por texto ambiguo en pantalla.
  - Se agrego polling para evitar falsos blockers por confirmar demasiado pronto.

## Medicion despues

Usuario usado: `admin.validacion` / admin.

Estado antes de la pasada posterior: sin caja abierta del admin.

Caja usada durante medicion posterior:

- Caja #6: apertura L.0.00, cierre L.0.00.
- Caja #7: apertura L.100.00, factura/cobro y cierre igual.
- Caja #8: apertura L.50.00, cierre L.40.00 con nota por diferencia.
- Visual smoke final dejo caja #9 abierta para `admin.validacion` con apertura L.500.00.

Factura usada:

- Medicion manual posterior: `000-001-01-00000089`, paciente `UX2 Post 1779167846550`, pagada.
- Visual smoke final: `000-001-01-00000091`, paciente `Paciente Smoke 1779168137529`, pagada, caja #9.

Resultados UX despues:

- Si no hay caja abierta, la pantalla muestra guia y accion directa.
- Apertura enfoca `opening_amount` y default es L.0.00.
- L.0.00 se puede abrir y cerrar correctamente.
- Caja duplicada responde con 422 esperado y mensaje seguro.
- Cierre con monto contado vacio ya no muestra diferencia; muestra `Falta ingresar el monto contado...` junto al campo y enfoca `closing_amount`.
- Solo hay un campo editable de monto contado.
- Efectivo esperado se muestra como apertura + pagos en efectivo.
- Tarjeta, transferencia y otros quedan separados del efectivo esperado.
- Cierre igual muestra confirmacion clara.
- Cierre con diferencia muestra dialogo con monto apertura, total esperado, contado, diferencia y nota obligatoria.
- Despues de cobrar, recibo aparece como siguiente paso natural.
- No hay impresion automatica; imprimir es accion explicita.
- Preview 80mm y 58mm funciona.
- Cambiar ancho del preview no llama `/reprint`.
- Reimprimir desde historial requiere boton explicito y registra `/api/invoices/{id}/reprint`.
- CSS de impresion sigue condicionado a `body[data-printing-receipt="true"]`.
- Consola/red manual: sin 401/419/CORS/500. Solo 422 esperado por apertura duplicada deliberada.
- Visual smoke final: `consoleIssueCount: 0`, `blockerCount: 0`, `findings: []`.
- Scroll innecesario: no observado en desktop 1366x768 para flujo principal de caja/recibo.
- Foco inicial en modales: pago enfoco `payment-amount`; caja abierta enfoco `closing_amount`; apertura enfoco `opening_amount`.

## Recibo, preview y reimpresion

Recibo manual posterior:

- Factura: `000-001-01-00000089`.
- Incluyo hospital, factura, fecha, paciente, cajero, estado, CAI/rango si configurado, servicios, subtotal, impuesto, total, pagos y saldo/estado.
- Preview 80mm: `receipt-80mm`.
- Preview 58mm: `receipt-58mm`.
- Cambio de preview desde historial: 0 llamadas a `/reprint`.
- Reimpresion explicita: 1 llamada a `/reprint`.

Impresora fisica: **PENDIENTE_HARDWARE_VALIDATION**. No habia impresora fisica A5/carta/media carta/80mm/58mm disponible en esta pasada.

## Gates

- `php artisan test --colors=never`: **passed**, 136 tests, 777 assertions.
- `vendor/bin/pint --test`: **passed**.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run test`: **passed**, 28 tests.
- `npm.cmd run build`: **passed** con warning conocido de chunk > 500 kB.
- `npm.cmd run e2e`: **passed**, 2 tests.
- `VISUAL_SMOKE_BASE_URL=http://127.0.0.1:8000 node qa/visual-smoke/phase-12-visual-smoke.mjs`: **passed**.

## Smoke visual

Reporte:

- `qa/screenshots/phase-12-visual-smoke/visual-smoke-report.json`
- `blockerCount`: 0.
- `consoleIssueCount`: 0.
- `findings`: [].
- Ultima factura del smoke visual: `000-001-01-00000091`.

## Estado final

Resultado final: **UX-2 APROBADA** para caja/recibo en entorno local de navegador.

Pendientes fuera de UX-2:

- Validacion fisica de impresora institucional A5/carta/media carta/80mm/58mm.
- Validacion desde segundo cliente LAN real.
- UX-3/UX-4/UX-5.

Commit sugerido:

`fix(cash): clarify close-session and receipt workflow`
