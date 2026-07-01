# Refactor QA final

Fecha: 2026-07-01  
Branch: `refactor/ux-system-overhaul`

## Facturacion

- OK - Facturar con mouse: cubierto por `pnpm test:e2e`.
- OK - Facturar con teclado: campos tienen labels accesibles; `NewInvoiceView.test.tsx` usa roles/labels y submit por formulario.
- OK - 1 servicio y 2+ servicios: screenshots `billing-new-cart.png` usa dos servicios; E2E release factura un servicio real.
- OK - Sin paciente: `NewInvoiceView.test.tsx` valida que no emite.
- OK - Sin servicios: `NewInvoiceView.test.tsx` valida que no emite.
- OK - Doble click / doble emision: `NewInvoiceView.test.tsx` valida un solo submit; backend conserva idempotencia.
- OK - Error 422 no pierde carrito: `NewInvoiceView.test.tsx`.
- OK - Servicio inactivo/caja cerrada/error de red: backend bloquea y UI mantiene alertas de error sin limpiar carrito.
- OK - Exito: muestra numero, paciente, total, estado, `Imprimir`, `Nueva factura`, `Ver detalle`.

## Recibos e impresion

- OK - Usuario normal sin `receipt_settings.advanced` no ve campos manuales ni bloque de soporte tecnico.
- OK - UI normal no envia `width_mm`, `height_mm`, `margin_*_mm`, `font_family`, `font_scale`.
- OK - Request manual con campos avanzados sin permiso devuelve 403 y audita (`ReceiptPrintProfileAdvancedFieldsTest`).
- OK - Usuario soporte con `receipt_settings.advanced` ve acordeon avanzado para perfil personalizado.
- OK - Perfiles probados visualmente: Carta, Media carta, A5, Ticket 80mm, Ticket 58mm.
- OK - Preview cambia por perfil y el CSS de impresion excluye chrome de app.
- OK - `Imprimir prueba` genera PDF de prueba sin reservar correlativo fiscal.

## Caja

- OK - Abrir caja, estado abierta y resumen por metodo visibles.
- OK - Movimientos compactos visibles.
- OK - Cerrar sin diferencia y con diferencia cubierto por backend tests.
- OK - Si diferencia != 0, motivo obligatorio.
- OK - Doble cierre devuelve error claro.
- OK - Caja cerrada no editable sin permiso especial.

## Reportes

- OK - Solo tres vistas: `Ejecutivo`, `Caja`, `Auditoria`.
- OK - No hay 13 tabs.
- OK - Metodos de pago usan tabla + barras horizontales.
- OK - Tendencia y top servicios son legibles.
- OK - Filtros compactos arriba.
- OK - Exportacion PDF/Excel pasa por permisos y filtros.
- OK - Auditoria requiere permiso de auditoria/managerial.

## Catalogo

- OK - Tabla compacta con Servicio, Categoria, Area, Precio, Estado, Acciones.
- OK - Edicion dividida en Datos basicos, Precio, Reglas, Estado.
- OK - Cambiar precio exige motivo, audit y guarda historial.
- OK - Servicio ya facturado no se borra como flujo operativo; se desactiva.
- OK - Servicio inactivo no factura; facturas historicas conservan snapshot.

## Historial

- OK - Busqueda por numero/paciente.
- OK - Filtros avanzados compactos.
- OK - Resultados recientes primero.
- OK - Reimprimir disponible segun permiso.
- OK - Anular solo con permiso, motivo y audit.
- OK - Factura anulada sigue visible como anulada.
- OK - No existe borrar factura emitida.

## Fiscal

- OK - Institucion, fiscal y branding separados.
- OK - CAI/rango/prefijo/correlativo piden motivo.
- OK - Cambios fiscales auditan before/after.
- OK - `current_number` fuera de rango devuelve 422.
- OK - Reset sin `fiscal.sequences.reset` devuelve 403/422 segun payload.
- OK - Si existen facturas, UI normal no reinicia correlativo.
- OK - Rutas `/settings/fiscal` y `/settings/institutional-receipts` validadas.

## Respaldos

- OK - No hay boton `Restaurar` directo/inseguro.
- OK - Estado de salud y tabla simple visibles.
- OK - Crear/descargar respaldo requieren permiso y auditan.
- OK - Hash/ruta/detalles tecnicos quedan fuera del flujo principal.
- OK - Restore queda fuera hasta implementar flujo seguro con permiso, motivo, SHA256, backup previo y audit.

## Usuarios y permisos

- OK - Roles visibles y agrupados por tarea: Administrador, Cajero, Auditor, Catalogo, Soporte.
- OK - Cambios de rol/permisos auditan before/after.
- OK - No se puede dejar el sistema sin admin activo.
- OK - Admin no puede autoquitarse el ultimo permiso administrativo.
- OK - Usuario no puede conceder permisos que no posee.
- OK - Frontend oculta acciones y backend bloquea.

## Accesibilidad

- OK - Inputs criticos tienen label.
- OK - Modales de motivo usan dialog/focus y textarea con descripcion.
- OK - Estados criticos usan texto + color + icono.
- OK - Focus visible en nav, botones y formularios.
- OK - No hay botones flotantes tapando contenido.

## Seguridad

- OK - Sin `dangerouslySetInnerHTML`, `console.log`, `debugger` ni TODO/FIXME operativo.
- OK - Tokens/password no se guardan en localStorage; localStorage solo se usa para preferencias/diagnostico local.
- OK - Endpoints sensibles protegidos por auth, permisos y throttles.
- OK - Acciones criticas tienen audit log.
- OK - No hay restore inseguro.

## Evidencia ejecutada

- `pnpm lint` OK.
- `pnpm typecheck` OK.
- `pnpm test` OK: 94 files, 507 tests.
- `pnpm build` OK.
- `pnpm test:e2e` OK: 2 tests.
- `php artisan test` OK: 744 passed, 12 skipped.
- `php artisan test --filter=PruneCommandsTest` OK.
- `php artisan test --filter=CloseCashSessionTest` OK.
- `php artisan test --filter=ReceiptPrintProfileAdvancedFieldsTest` OK.
- `php artisan test --filter=FiscalSequenceTest` OK.
- `php artisan test --filter=UpdateFiscalSequenceReasonTest` OK.
