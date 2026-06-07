# Auditoria UX operativa - 2026-05-18

Decision final de este tramo: **UX-1 APROBADA**.

Estado de release recomendado: **PRODUCTION_CANDIDATE**. No declarar `PRODUCTION_READY` hasta validar cliente LAN fisico, impresora institucional fisica y configuracion final del servidor.

## Alcance de esta pasada

Tramo aprobado: **Fase UX-0 + UX-1 solamente**.

No se implemento UX-2, UX-3, UX-4 ni UX-5. No se cambiaron reglas fiscales, migraciones, permisos, CORS/Sanctum ni backend profundo.

Archivos de producto tocados:

- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/invoices/components/PatientStep.tsx`
- `frontend/src/features/invoices/components/InvoiceCart.tsx`
- `frontend/src/features/invoices/components/InvoiceConfirmation.tsx`
- `frontend/src/features/invoices/components/PaymentModal.tsx`
- `frontend/src/features/invoices/components/InvoiceSuccess.tsx`

Archivos de validacion tocados:

- `frontend/src/App.test.tsx`
- `frontend/e2e/production-readiness.spec.ts`
- `frontend/e2e/real-smoke.spec.ts`
- `qa/visual-smoke/phase-12-visual-smoke.mjs`

## UX-0 - Medicion antes

URL usada: `http://127.0.0.1:8000/billing/new`.

Usuario/rol inicial: `cajero.validacion / cajero`.

Estado de caja: `Caja #2 abierta`.

Servicio usado: `Acido Urico`.

Codigo visible: `LAB-ACIDO-URICO`.

Resultado:

- Foco inicial: `patient-name`.
- Desde paciente, la medicion con navegador integrado no movio foco con `Tab` de forma confiable; el flujo se completo usando localizadores para continuar la inspeccion.
- Enter en busqueda agrego `Acido Urico` cuando el resultado estaba disponible.
- `Ctrl+Enter` abrio el dialogo de confirmacion.
- El dialogo decia `Confirmar factura` y el CTA decia `Confirmar emision`, sin dejar suficientemente claro que despues abriria cobro.
- Al emitir, se genero `000-001-01-00000081`.
- El modal de pago enfoco `payment-amount`.
- Cerrar/abandonar pago podia dejar factura emitida sin una pantalla persistente de siguiente paso suficientemente obvia.
- El intento de cobro con `cajero.validacion` termino con `No tiene permiso para esta accion`; por eso la medicion completa de recibo se repitio con `admin.validacion`.
- Clics observados para avanzar en la medicion antes: 2 clics manuales criticos (`Confirmar emision`, `Confirmar cobro`) cuando Enter no completo la interaccion en esa corrida.
- Scroll: no hubo scroll operativo de pagina relevante; `window.scrollY` se mantuvo en 0 o muy bajo por ajuste del navegador.
- Consola: sin `console.error` ni `pageerror` en la corrida observada.
- Red: sin 401/419/CORS/500 inesperados en la observacion; el bloqueo fue permiso backend de pago para el usuario usado.

Veredicto UX-0 antes: **REQUIERE CAMBIOS** por ambiguedad `emitir` vs `cobrar`, cierre de pago sin guia persistente y dependencia de clicks en pasos criticos.

## UX-1 - Cambios aplicados

- El CTA principal del carrito ahora dice `Emitir y cobrar` cuando el flujo incluye pago y recibo.
- La confirmacion ahora dice `Confirmar emision y cobro` y el boton primario `Emitir y abrir cobro`.
- Si se cierra el modal de pago con factura emitida pendiente, aparece `Factura emitida exitosamente` con accion primaria `Cobrar ahora`.
- Despues de cerrar el recibo de una factura pagada, aparece una decision clara: imprimir recibo o `Crear otra factura`.
- Se elimino la autoimpresion del caso de factura cero; el recibo queda visible y la impresion es accion explicita.
- `Esc` ya no usa `window.confirm()` para limpiar; abre un dialog accesible de confirmacion.
- `Enter` en paciente enfoca busqueda cuando el nombre ya esta escrito.
- `Ctrl+Enter` valida y abre el flujo de emision solo si la factura esta lista; si falta algo, muestra el motivo.
- `Enter` en monto recibido confirma el pago si el monto es valido.
- Mensajes de bloqueo por paciente/servicios/caja siguen cerca del CTA.
- Los tests y smoke se actualizaron para el camino `emitir y cobrar`.

## Medicion despues

URL usada: `http://127.0.0.1:8000/billing/new`.

Usuario/rol: `admin.validacion / admin`.

Estado de caja: `Caja #1 abierta`.

Servicio usado: `Acido Urico`.

Codigo visible: `LAB-ACIDO-URICO`.

Factura manual generada: `000-001-01-00000082`.

Factura generada por smoke visual: `000-001-01-00000083`.

Flujo medido con viewport `1366x768`:

1. Foco inicial: `patient-name`.
2. Teclas: escribir paciente.
3. `Tab`: cae en `Buscar por nombre, categoria o codigo`.
4. Teclas: escribir `acido`.
5. `Enter`: agrega el primer servicio disponible.
6. Foco vuelve a busqueda.
7. `Ctrl+Enter`: abre `Confirmar emision y cobro`.
8. Foco cae en `Emitir y abrir cobro`.
9. `Enter`: emite factura y abre pago.
10. Foco cae en `payment-amount`.
11. `Ctrl+A`, escribir `1000.00`.
12. `Enter`: confirma cobro.
13. Recibo aparece como siguiente paso natural.
14. Cerrar recibo muestra accion de continuar.
15. `Crear otra factura` limpia estado y enfoca paciente.
16. Historial encuentra `Paciente UX Despues 20260518`.

Medicion despues:

- Clics desde Nueva Factura hasta recibo: **0**.
- Teclas usadas: paciente, `Tab`, busqueda, `Enter`, `Ctrl+Enter`, `Enter`, monto, `Enter`.
- Scroll: **0** en desktop.
- Recibo aparece al final: **si**.
- Factura aparece en historial: **si**.
- Se puede repetir sin refrescar: **si**.
- Consola/red: visual smoke con `consoleIssueCount: 0`, `blockerCount: 0`, `findings: []`. La medicion Playwright directa observo aborts benignos de `/sanctum/csrf-cookie` iguales al filtro existente del smoke real; no hubo 401, 419, CORS ni >=500 inesperados.

## Validacion ejecutada

- `php artisan test --colors=never`: **136 passed, 777 assertions**.
- `vendor/bin/pint --test`: **passed**.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run test`: **27 passed**.
- `npm.cmd run build`: **passed** con warning conocido de chunk grande.
- `npm.cmd run e2e`: **2 passed**.
- `VISUAL_SMOKE_BASE_URL=http://127.0.0.1:8000 node qa/visual-smoke/phase-12-visual-smoke.mjs`: **passed**.

## Smoke visual

Reporte:

- `qa/screenshots/phase-12-visual-smoke/visual-smoke-report.json`
- `blockerCount`: 0.
- `consoleIssueCount`: 0.
- `findings`: [].
- Ultima factura del smoke visual: `000-001-01-00000083`.

Capturas regeneradas:

- `qa/screenshots/phase-12-visual-smoke/dashboard.png`
- `qa/screenshots/phase-12-visual-smoke/billing-new-empty.png`
- `qa/screenshots/phase-12-visual-smoke/billing-new-with-services.png`
- `qa/screenshots/phase-12-visual-smoke/billing-confirm-modal.png`
- `qa/screenshots/phase-12-visual-smoke/receipt-preview.png`
- `qa/screenshots/phase-12-visual-smoke/cashbox.png`
- `qa/screenshots/phase-12-visual-smoke/catalog.png`
- `qa/screenshots/phase-12-visual-smoke/invoices-history.png`
- `qa/screenshots/phase-12-visual-smoke/reports.png`
- `qa/screenshots/phase-12-visual-smoke/backups.png`
- `qa/screenshots/phase-12-visual-smoke/fiscal-settings.png`

## Pendientes fuera de UX-1

- UX-2: caja/cierre/recibo a profundidad.
- UX-3: historial, catalogo, backups y fiscal a profundidad.
- UX-4: reportes/admin/permisos a profundidad.
- UX-5: cierre final de todos los gates como frente completo.
- Validacion fisica: impresora institucional media carta/carta/A5 y cliente LAN real.

## Commit sugerido

`fix(pos): harden keyboard billing flow`

---

# UX-4 - Reportes, administracion y permisos

Decision final de este tramo: **UX-4 APROBADA**.

URL base usada: `http://127.0.0.1:8000`.

Usuarios/roles usados: `admin.validacion / admin`, `supervisor.validacion / supervisor`, `cajero.validacion / cajero`.

## Medicion antes

- `AppShell` mostraba `Reportes` con `reports.view`, `reports.managerial.view` o `reports.cash_session.view`.
- `AppRoutes` permitia `/reports` solo con `reports.view`.
- Usuario con solo `reports.cash_session.view` podia ver acceso a reportes de caja pero quedaba bloqueado por ruta.
- Las tabs Diario, Rango, Servicios, Auditoria y Caja generaban CSV local con `Blob` en frontend.
- La UI condicionaba el boton por `reports.export`, pero la descarga no usaba `/api/reports/export`.

Reportes revisados: diario, rango, servicios, auditoria y caja.
Filtros revisados: fecha diaria, desde/hasta, categoria, metodo, estado, cajero ID y caja ID.
Exportaciones probadas: CSV de reportes para admin/supervisor y ausencia de boton para cajero sin permiso.

## Cambios realizados

- `/reports` ahora permite `reports.view` o `reports.cash_session.view`.
- Usuario con solo `reports.cash_session.view` entra a la tab `Caja` y no ve tabs gerenciales.
- Las tabs gerenciales se ocultan si falta `reports.managerial.view`.
- `Exportar CSV` usa `apiClient.downloadReportExport()` contra `/api/reports/export`.
- Se elimino CSV local desde frontend en reportes.
- Se agregaron tests frontend para export backend y rol con solo reporte de caja.

## Medicion despues

- Admin: ve reportes gerenciales, Caja y exporta CSV desde backend.
- Supervisor: ve reportes y exporta si tiene `reports.export`; no ve Backups.
- Cajero: no ve Reportes/Backups/Fiscal si no tiene permisos; con `reports.cash_session.view` ve solo Caja.
- Ruta no permitida muestra pantalla humana, sin JSON crudo.
- No se observaron 401/419/CORS/500 inesperados ni errores rojos de consola.

## Seguridad y permisos

Backend mantiene la fuente de verdad para `reports.export`, 403 sin permiso y 401 para invitado. Frontend ya no ofrece descarga CSV sensible generada localmente.

## Validacion ejecutada

- `php artisan test --colors=never`: **passed**.
- `vendor/bin/pint --test`: **passed**.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run test`: **passed**.
- `npm.cmd run build`: **passed**.
- `npm.cmd run e2e`: **passed**.
- `VISUAL_SMOKE_BASE_URL=http://127.0.0.1:8000 node qa/visual-smoke/phase-12-visual-smoke.mjs`: **passed**.

## Commit sugerido

`fix(reports): harden admin permissions and exports UX`
