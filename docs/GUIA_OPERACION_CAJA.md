# Guia de Operacion de Caja

## Flujo principal

1. Iniciar sesion con usuario activo.
2. Abrir caja si no hay sesion abierta.
3. Ir a Nueva factura.
4. Ingresar nombre del paciente como texto obligatorio.
5. Seleccionar servicios facturables desde Catalogo.
6. Revisar subtotal, impuesto, descuento y total.
7. Emitir factura.
8. Registrar pago con metodo autorizado.
9. Generar o imprimir recibo institucional.
10. Consultar Historial para reimpresion, pagos, anulaciones o reversos segun permisos.
11. Revisar Reporte diario.
12. Cerrar caja al terminar turno.

## Reglas operativas

- No se usa expediente clinico; paciente es solo nombre en factura.
- Toda factura pagada debe quedar asociada a caja, cajero, metodo y fecha.
- Anulaciones/reversos requieren permiso, motivo y auditoria.
- No borrar facturas historicas.
- Evitar doble submit esperando la respuesta del sistema antes de repetir acciones.

## Criterio de demo/UAT

El flujo login, apertura de caja, factura, pago, recibo, historial, reporte diario, cierre de caja y backup manual debe demostrarse sin internet.
