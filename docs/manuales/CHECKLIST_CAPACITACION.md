# Checklist de capacitacion y entrega

Use esta lista para capacitar a personal de caja, supervision y administracion.

Antes de empezar, revise `docs\manuales\GUIA_CAPACITACION_SEGURA.md`. La
capacitacion debe hacerse en una instalacion separada o base descartable; no en
la base real de produccion.

## Preparacion

- [ ] Entorno de capacitacion separado de produccion.
- [ ] Usuarios de practica creados y marcados como temporales.
- [ ] Datos fiscales temporales o ficticios identificados como no reales.
- [ ] Impresora de practica o previsualizacion acordada.
- [ ] Instructor confirma que no se usaran datos reales de pacientes.
- [ ] Participantes saben que no deben repetir facturas ni cobros a ciegas.

## Cajero

- [ ] Abre el sistema con el acceso directo.
- [ ] Inicia sesion con usuario propio.
- [ ] Abre caja con efectivo inicial.
- [ ] Busca servicios por nombre.
- [ ] Usa categoria **Todos**.
- [ ] Agrega y quita servicios.
- [ ] Revisa total antes de emitir.
- [ ] Entiende que el paciente solo requiere nombre, no ficha pre-registrada.
- [ ] Entiende que la receta de diálisis se marca en la factura solo con permiso.
- [ ] Cobra en efectivo.
- [ ] Cobra con tarjeta o transferencia y registra referencia.
- [ ] Reconoce cambio (cambio/vuelto).
- [ ] Reconoce saldo pendiente y entiende que el pago menor no marca pagado completo (bloqueo si el monto recibido es menor al total).
- [ ] Imprime recibo institucional.
- [ ] Reimprime desde historial si tiene permiso.
- [ ] Cierra caja y revisa diferencia.
- [ ] Usa **Ayuda > Preparar resumen** para reportar un error sin compartir secretos.
- [ ] Sabe no repetir facturas ni cobros despues de un error o reinicio.

## Supervisor

- [ ] Revisa estado operativo al inicio del turno.
- [ ] Confirma que cada cajero usa su propia cuenta.
- [ ] Sabe que hacer si el servidor no abre.
- [ ] Sabe que hacer si cae la red local.
- [ ] Sabe que hacer si la impresora no responde.
- [ ] Sabe recopilar evidencia local para soporte.
- [ ] Sabe pedir al cajero el resumen seguro de **Ayuda**.
- [ ] Autoriza reimpresiones solo con motivo.
- [ ] Revisa factura, pago y motivo antes de una anulacion.
- [ ] Sabe validar receta de dialisis si tiene el permiso `patients.mark_dialysis_prescription`.
- [ ] Revisa facturas pendientes antes de cierre.
- [ ] Documenta diferencias de caja.
- [ ] No restaura backups ni borra datos por cuenta propia.

## Administrador

- [ ] Configura datos reales del hospital.
- [ ] Deja CAI/serie/rango como pendiente si no hay datos reales.
- [ ] Revisa vista previa del recibo.
- [ ] Revisa reporte diario: facturado, cobrado y saldo pendiente.
- [ ] Revisa metodos de pago.
- [ ] Identifica parciales y anuladas.
- [ ] Autoriza anulaciones con motivo.
- [ ] Revisa quien puede usar `patients.mark_dialysis_prescription`.
- [ ] Entiende que una factura L.0 por regla autorizada no crea pago artificial L.0.
- [ ] Crea respaldo manual.
- [ ] Verifica ultimo respaldo.
- [ ] Conoce la guia de soporte de primer nivel.
- [ ] Revisa un resumen seguro antes de escalar un incidente tecnico.
- [ ] Sabe a quien llamar ante error tecnico.
- [ ] Sabe preparar capacitacion sin tocar la base real.
- [ ] Sabe restaurar solo en base descartable autorizada.

## Prueba final del flujo

- [ ] Confirmar que la practica se hara fuera de datos reales.
- [ ] Confirmar respaldo antes de cualquier simulacro supervisado.
- [ ] Login.
- [ ] Caja cerrada bloquea facturacion.
- [ ] Abrir caja.
- [ ] Crear factura.
- [ ] Cobrar.
- [ ] Imprimir.
- [ ] Reimprimir.
- [ ] Revisar reporte del dia.
- [ ] Crear respaldo.
- [ ] Cerrar caja.
- [ ] Revisar reporte del dia.
- [ ] Preparar resumen seguro desde Ayuda.
- [ ] Explicar que hacer si falla red, impresora, sesion o permisos.
