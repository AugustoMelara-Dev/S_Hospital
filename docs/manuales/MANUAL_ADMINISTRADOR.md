# Manual del administrador

Guia para administracion, supervision y soporte operativo local del Hospital San Isidro.

## Responsabilidades

- Mantener datos del hospital y recibo institucional.
- Administrar usuarios y permisos.
- Revisar reportes, caja, anulaciones y reimpresiones.
- Verificar respaldos.
- Coordinar instalacion, impresora, red local y restauraciones seguras.

## Configuracion del hospital

Revise en **Configuracion fiscal/hospitalaria**:

- Nombre oficial del hospital.
- RTN si aplica.
- Direccion y lugar de emision.
- Lineas de Gobierno, Secretaria y Hospital.
- Serie, rango, CAI y fecha limite si existen datos reales.
- Tamano de papel autorizado: carta, media carta o A5.

No invente CAI, serie, rango ni fecha limite. Si faltan datos reales, el sistema debe indicar configuracion pendiente.

## Usuarios y permisos

Use una cuenta por persona.

- Cajero: abrir/cerrar caja propia, facturar, cobrar e imprimir.
- Supervisor: revisar caja, historial, reportes, reimpresiones y anulaciones autorizadas.
- Administrador: configurar sistema, usuarios, reportes, respaldos y datos fiscales.
- Auditor/Consulta: revisar reportes, historial, auditoria y respaldos sin operar caja.
- Soporte tecnico: revisar diagnostico tecnico sin manipular caja, facturas, fiscal ni respaldos.

Desactive usuarios que ya no trabajen en caja. No reutilice cuentas entre turnos.

## Catalogo

Revise periodicamente:

- Servicios activos.
- Precio vigente.
- Categoria correcta.
- Regla de eritropoyetina.
- Servicios inactivos que no deben venderse.

Los recibos y facturas historicas conservan snapshot de nombre y precio. Cambiar catalogo no debe alterar facturas anteriores.

## Caja y anulaciones

- Toda factura pagada queda asociada a caja, cajero, metodo y fecha.
- Toda anulacion requiere permiso, motivo y auditoria.
- Toda reversion de pago requiere permiso, motivo y auditoria.
- No borre facturas.
- Si hay saldo parcial, resuelva el saldo antes de cerrar caja.
- Tarjeta y transferencia se revisan por reportes; no se cuentan como efectivo en gaveta.

## Auditoria

Revise **Reportes > Auditoria** para consultar:

- aperturas y cierres de caja;
- diferencias de caja;
- facturas emitidas y anuladas;
- pagos registrados y revertidos;
- reimpresiones;
- cambios de configuracion fiscal;
- cambios de usuarios;
- respaldos creados, fallidos o descargados.

Use el rango de fechas del turno o dia. Si aparece una accion inesperada, compare usuario, motivo, hora y origen antes de cerrar administrativamente.

## Reportes diarios

Revise:

- Facturado.
- Cobrado.
- Saldo pendiente.
- Pagadas, parciales, emitidas y anuladas.
- Cobros por metodo.
- Diferencias de caja.
- Reimpresiones y anulaciones.
- Eventos de control y reversos de pago.

Use estos reportes para cierre del dia y conciliacion con caja fisica.

## Respaldos

Todos los dias confirme:

1. Existe respaldo reciente.
2. Esta completado.
3. Tiene tamano mayor a cero.
4. Muestra huella SHA256.
5. Hay copia externa segura cuando corresponda.

Antes de actualizaciones o cambios de configuracion importante:

1. Cree respaldo.
2. Verifique que el respaldo aparezca como completado.
3. Registre quien hizo el cambio y por que.
4. Pruebe el flujo principal despues del cambio.

## Eritropoyetina Y Facturas L.0

El sistema no usa expediente clinico completo ni exige paciente pre-registrado
para facturar. La factura requiere solo el nombre del paciente.

La receta de dialisis se marca en la factura mediante el campo operativo
`dialysis_prescription` (`patient_has_dialysis_prescription` en algunos
formularios/documentacion). Solo usuarios con el permiso
`patients.mark_dialysis_prescription` pueden aplicar esa marca.

Cuando la factura queda en L. 0.00 por una regla autorizada, el sistema la deja
`paid` y registra auditoria `invoice.zero_amount_registered`. No debe crearse ni
esperarse un pago artificial L. 0.00. Esa factura no aumenta efectivo esperado,
recaudacion ni arqueo.

El administrador debe revisar periodicamente quien tiene el permiso
`patients.mark_dialysis_prescription` y confirmar que la politica del hospital
define quien puede validar la receta fisica.

## Capacitacion Segura

El administrador prepara el entorno de entrenamiento. No use la base real para
practicar anulaciones, restauraciones, cobros ficticios, cierres de caja ni
comandos tecnicos.

Use `docs\manuales\GUIA_CAPACITACION_SEGURA.md` para preparar la sesion. Si no
existe un modo practica aislado dentro del producto, use una instalacion
separada o una base descartable con datos temporales claramente marcados.
