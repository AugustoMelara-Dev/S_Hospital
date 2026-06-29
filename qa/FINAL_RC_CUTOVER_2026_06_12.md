# Final RC Cutover - 2026-06-12

## Veredicto final

FINAL RC READY.

La rama `codex/final-rc-scope-cutover` parte de `main` en `38d2e6e1`. El cierre mantuvo el alcance operativo, retiro una superficie duplicada de ayuda guiada y fortalecio los smokes de caja/facturacion para que no acepten falsos positivos de caja abierta. No se cambiaron contratos API, stack, dependencias ni flujos fiscales.

## KEEP

- Login funcional con usuario de validacion.
- Navegacion institucional principal: Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios, Ayuda, Acerca de.
- Dashboard operativo con resumen de caja/facturacion.
- Nueva factura, seleccion de servicios, emision y cobro.
- Caja abierta/cerrada y bloqueo claro cuando no hay caja abierta.
- Pago, recibo institucional y reimpresion desde historial.
- Catalogo de servicios.
- Configuracion fiscal/hospitalaria.
- Usuarios/roles basicos.
- Respaldos.
- Ayuda minima y Acerca de institucional.
- 404 validado.
- Reportes se mantienen porque cargan, muestran evidencia operativa y no quedaron como pantalla vacia.
- Estados de loading/error/toasts/modales existentes se conservan por F4/F5.

## HIDE

- Se oculto la ayuda guiada duplicada del topbar. El boton de ayuda ahora apunta directamente a `/help`, que es la superficie institucional estable para RC.

Razon: el tour guiado era una segunda superficie de ayuda, no necesaria para cobrar/facturar ni para administracion minima. Evita ruido y reduce percepcion de producto en entrenamiento.

## DELETE

- `frontend/src/features/onboarding/GuidedTour.tsx`

Razon: componente no esencial para RC despues de redirigir la ayuda visible a `/help`. No era necesario para caja, facturacion, catalogo, recibos, usuarios, configuracion fiscal ni respaldos.

No se eliminaron assets o estilos del frente visual anterior por defecto. Solo se retiro codigo referenciado por la superficie duplicada indicada.

## DOCUMENT ONLY

- Impresion termica fisica 80mm/58mm: flujo y preview validados en navegador, pero queda pendiente prueba con impresora real.
- Operacion LAN multi-PC fisica: arquitectura local conservada, pero esta corrida uso servidor local en `127.0.0.1`.
- Backups: pantalla y estado operativo validados; programacion/restore fisico en produccion queda como verificacion operativa del sitio.
- Smokes visuales usan SQLite temporal local para evidencia automatizada; la entrega real debe usar MySQL/MariaDB segun instalacion.

## Decisiones

- No se ocultaron reportes: estan activos, aportan consulta operativa y pasaron evidencia visual.
- No se ocultaron usuarios/roles: estan activos y son parte del nucleo RC.
- No se tocaron contratos API ni migraciones de producto.
- No se mezclo ninguna rama de diseno no mergeada.
- `stash@{0}` no fue aplicado ni modificado.

## Riesgos residuales

- Validacion de impresora termica real pendiente.
- Validacion LAN desde una segunda PC pendiente.
- Restore fisico de backup y agenda del worker deben verificarse en instalacion final.
- Windows/Laravel `artisan serve` corre con un worker en esta maquina; los smokes fueron endurecidos para esperar sesiones y evitar falsos positivos.

## Validaciones ejecutadas

- `npm.cmd run lint`: PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test`: PASS, 55 archivos y 246 tests.
- `npm.cmd run build`: PASS.
- `php artisan test`: PASS, 438 passed, 5 skipped, 2847 assertions.
- `node --check qa/visual-smoke/f4-billing-cashbox-flow.mjs`: PASS.
- `node --check qa/visual-smoke/f5-visual-ux-audit.mjs`: PASS.
- `node --check qa/visual-smoke/final-rc-smoke.mjs`: PASS.
- `node qa/visual-smoke/f4-billing-cashbox-flow.mjs`: PASS.
- `node qa/visual-smoke/f5-visual-ux-audit.mjs`: PASS.
- `node qa/visual-smoke/final-rc-smoke.mjs`: PASS.

## Capturas finales

- F4: `qa/screenshots/after/f4-billing-cashbox-flow-report.json`.
- F5: `qa/screenshots/after/f5-visual-ux-audit-report.json`.
- Final RC: `qa/screenshots/final-rc/final-rc-smoke-report.json`.
- Capturas principales Final RC:
  - `qa/screenshots/final-rc/final-rc-login.png`
  - `qa/screenshots/final-rc/final-rc-dashboard.png`
  - `qa/screenshots/final-rc/final-rc-cashbox-open.png`
  - `qa/screenshots/final-rc/final-rc-new-invoice-service-selected.png`
  - `qa/screenshots/final-rc/final-rc-payment-modal.png`
  - `qa/screenshots/final-rc/final-rc-receipt-after-payment.png`
  - `qa/screenshots/final-rc/final-rc-invoice-history-paid-search.png`
  - `qa/screenshots/final-rc/final-rc-receipt-reprint.png`
  - `qa/screenshots/final-rc/final-rc-catalog.png`
  - `qa/screenshots/final-rc/final-rc-settings-fiscal.png`
  - `qa/screenshots/final-rc/final-rc-backups.png`
  - `qa/screenshots/final-rc/final-rc-users.png`
  - `qa/screenshots/final-rc/final-rc-help.png`
  - `qa/screenshots/final-rc/final-rc-about.png`
  - `qa/screenshots/final-rc/final-rc-not-found.png`

## Estado F4/F5 despues de limpieza

- F4 sigue validando caja, nueva factura, pago, recibo, historial y reimpresion.
- F5 sigue validando login, vistas principales, matriz desktop/dark/laptop/tablet/mobile, branding prohibido, overflow y controles sin nombre.
- Final RC smoke valida 19 capturas, 0 rutas omitidas, 0 console issues, 0 overflow findings y 0 unnamed control findings.

## Confirmacion RC

El sistema queda mas pequeno y claro: se retiro la ayuda guiada duplicada, se conserva el nucleo operativo y las validaciones finales pasan. Listo para RC con las limitaciones fisicas documentadas.
