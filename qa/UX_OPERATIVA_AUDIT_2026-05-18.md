# Auditoria UX operativa - 2026-05-18

Decision final: UX OPERATIVA APROBADA para demo operativa.

Estado de release recomendado: DEMO_READY / PRODUCTION_CANDIDATE. No declarar PRODUCTION_READY hasta validar cliente LAN real, impresora termica fisica 80mm/58mm y configuracion final del servidor.

## Alcance auditado

- Dashboard.
- Nueva Factura / POS.
- Caja.
- Catalogo.
- Historial de facturas.
- Reportes.
- Backups.
- Configuracion fiscal.
- Recibo termico.
- Modales de confirmacion, pago y recibo.
- Estados de carga, empty states, errores, acciones deshabilitadas, permisos visibles, tabulacion y consola.

## Flujo POS medido

Objetivo: factura simple con caja abierta en `http://127.0.0.1:8000`.

Resultado de pasada manual con Playwright:

- Foco inicial: `patient-name`.
- Despues de paciente + `Tab`: `Buscar por nombre, categoria o codigo`.
- Despues de escribir servicio + `Enter`: servicio agregado y foco vuelve a busqueda.
- Confirmacion: `Ctrl+Enter` abre confirmar factura.
- Pago: el modal enfoca `payment-amount`.
- Final: recibo visible.
- Clicks manuales usados: 1 (`Confirmar emision`).
- Secuencia principal: paciente -> Tab -> busqueda -> Enter -> Ctrl+Enter -> confirmar -> pago -> Enter -> recibo.
- Factura creada en smoke manual: `000-001-01-00000048`.
- Consola y red: sin `console.error`, `pageerror`, `401`, `419` ni `>=500`.

## Problemas corregidos

- POS conectaba refs de foco que no estaban adjuntos a inputs reales.
- `Tab` desde paciente caia en categorias antes que busqueda.
- `Enter` podia perderse si el usuario lo presionaba mientras la busqueda aun cargaba.
- Despues de agregar un servicio, el foco no volvia de forma confiable a busqueda.
- Factura de eritropoyetina gratis podia quedar `issued` con total `0.00`, sin ruta usable para recibo.
- Botones `+/-` de cantidad rompian cantidades decimales.
- Errores de paciente y pago no estaban asociados con `aria-describedby`.
- Pago no enfocaba monto al abrir ni al fallar validacion.
- `Esc` global podia interferir con modales del POS.
- Caja mostraba abrir/cerrar sin validar permisos `cash.open` / `cash.close`.
- Cerrar caja podia abrir confirmacion con monto contado vacio.
- Abrir caja con `0.00` estaba bloqueado en UI aunque el backend lo acepta.
- Historial mostraba `Ver Recibo` aunque el backend podia negar por permisos.
- Quick action de nueva factura no usaba el mismo gate compuesto que la ruta.
- Configuracion fiscal permitia editar localmente aunque el usuario no pudiera guardar.
- Backups mostraba resumen de pagina sin explicarlo.
- Acciones icon-only de catalogo/cantidad tenian labels incompletos.

## Pendientes no bloqueantes

- Reportes: extraer un `ReportFilterBar` compartido para que filtros activos sean visibles en todas las pestañas.
- Reportes: mover exportaciones CSV generadas en frontend al endpoint backend o agregar escaping CSV robusto.
- Historial: migrar el menu manual de acciones a Radix DropdownMenu con roles/flechas/Escape completos.
- Backups: crear endpoint de resumen global por ultimo exito, ultimo fallo y pendientes, en vez de depender de la pagina cargada.
- Prueba fisica: validar impresora termica real 80mm/58mm.
- Prueba LAN: validar desde otra computadora cliente en la red local.

## Validacion ejecutada

- `php artisan test --colors=never`: 133 passed, 762 assertions.
- `php artisan config:cache`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run test`: 26 passed.
- `npm.cmd run build`: passed con warning de chunk grande.
- `npm.cmd run e2e`: 2 passed.
- `/up`: 200.
- `/login`: 200.
- `/verify-email`: 200.
- `npm.cmd run visual:smoke` contra `http://127.0.0.1:8000`: passed.

## Smoke visual

Reporte final:

- `qa/screenshots/phase-12-visual-smoke/visual-smoke-report.json`
- `blockerCount`: 0.
- `consoleIssueCount`: 0.
- `findings`: [].
- Ultima factura del smoke visual: `000-001-01-00000049`.

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

## Demo

Recomendacion: se puede ensenar el demo operativo del flujo principal.

Condicion al presentarlo: describirlo como demo operativa / candidata a produccion local, no como produccion final instalada. La validacion fisica de LAN e impresora sigue pendiente.

## Commit sugerido

`fix(pos): harden operational keyboard flow and receipt edge cases`
