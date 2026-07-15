# Revisión visual — Caja

Fecha: 2026-07-14

## Criterios verificados

- La cabecera operativa reúne estado, apertura, efectivo esperado, pendiente y acciones sin repetir un aviso verde.
- Movimientos muestra una sola tabla en escritorio y una lista dedicada en móvil; no agrega paginación interna.
- `opening` se presenta como `Apertura`.
- La referencia fiscal permanece visible y el Drawer accesible conserva referencia, pago y nota completos.
- Cada bloqueo del cierre tiene su propia acción `Resolver en Historial`.
- El formulario de cierre abre el diálogo auditado aunque la nota por diferencia aún esté vacía; el diálogo conserva la validación obligatoria.
- No se detectó desbordamiento horizontal a 1366, 768 ni 390 px.

## Evidencia

- `after/cashbox-1366.png`
- `after/cashbox-movements-1366.png`
- `after/cashbox-close-768.png`
- `after/cashbox-movements-390.png`
- `after/cashbox-movement-detail-390.png`

## Pruebas automatizadas

- Vitest: `CashBoxView`, `CashClosingPanel`, `CashMovementsTable`.
- Playwright: cierre con diferencia, bloqueo por recibo y adaptación de cabecera/movimientos/cierre entre viewports.
