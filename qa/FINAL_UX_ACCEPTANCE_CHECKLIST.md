# Final UX Acceptance Checklist

Estado: **BLOQUEADO** desde la revision de seis subagentes del 2026-05-17.

Este checklist no debe marcarse como aprobado hasta cerrar `docs/12_CORRECTED_FINAL_PRODUCT_PLAN.md`.

## App shell
- [x] Sidebar visible.
- [x] Topbar con usuario, caja, fecha/hora local y estado servidor/LAN visible.
- [x] Rutas separadas.
- [x] Layout tablet/movil sin enterrar el contenido despues de una pantalla completa de navegacion.
- [x] Errores operativos visibles inline o toast, no solo en footer/status.
- [x] App.tsx reducido a composicion de providers/router.

## Facturacion
- [x] Categorias visibles.
- [x] Buscador visible.
- [x] Scanner input visible.
- [x] Carrito visible.
- [x] No lista interminable por defecto.
- [x] Eritropoyetina clara.
- [x] Confirmacion antes de emitir.
- [x] Confirmacion antes de cobrar.
- [x] Flujo principal claro: cobrar y emitir con caja abierta, o emitir pendiente como accion secundaria explicita.
- [x] CTA claro para abrir caja si no hay caja abierta.

## Caja
- [x] Cierre de caja con esperado, contado, diferencia, pagos/movimientos y confirmacion.
- [x] Diferencia distinta de cero exige nota o confirmacion reforzada.
- [x] Pagos no pueden operar sobre facturas ajenas por ID.

## Catalogo
- [ ] Tabla profesional basada en componente compartido.
- [x] Filtros.
- [x] Crear/editar por permisos.
- [x] Barcode/QR fields.
- [ ] Estados de error/empty/loading consistentes.

## Reportes
- [x] KPIs gerenciales completos.
- [x] Filtros por fecha, cajero, categoria, metodo, estado y caja.
- [x] Tablas exportables con permiso `reports.export`.
- [x] Anulaciones con motivo/usuario/fecha.
- [x] Reimpresiones con usuario/factura/fecha.
- [x] Backups ejecutados/fallidos/ultima verificacion.
- [x] Grafico con Recharts para servicios mas vendidos.

## Diseno
- [ ] Componentes base consistentes en pantallas principales.
- [x] Tipografia base consistente.
- [x] Colores base consistentes.
- [ ] Estados vacios/loading/error por modulo.
- [ ] Responsive validado en navegador para desktop/tablet/mobile.

## QA
- [x] Unit/feature tests backend.
- [x] Frontend tests.
- [x] E2E mockeado de demo.
- [x] Smoke real contra Laravel/API definido como gate separado del mock.
- [x] Browser smoke con cero `console.error`, `pageerror` y requests fallidas inesperadas.
- [x] Build.
- [x] Demo script actualizado con evidencia honesta.
