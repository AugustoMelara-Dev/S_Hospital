# Manual De Usuario - Sistema De Caja Hospitalaria

Este manual resume el uso diario del Sistema de Caja Hospitalaria en la red
local del hospital. Esta pensado para caja, supervision, administracion y
soporte de primer nivel.

El sistema funciona en una computadora servidor y se abre desde las computadoras
cliente por navegador usando la direccion LAN indicada por administracion.

## 1. Abrir El Sistema

1. Encienda la computadora servidor.
2. Abra el sistema con el acceso directo **Abrir Sistema de Caja Hospitalaria**.
3. Desde una computadora cliente use la direccion local del servidor, por
   ejemplo `https://192.168.1.10`.
4. No use `localhost` desde una computadora cliente.
5. Inicie sesion con su usuario asignado.

No comparta cuentas. Toda factura, cobro, cierre, anulacion o respaldo queda
asociado al usuario que lo ejecuta.

## 2. Caja Y Facturacion

Antes de facturar, el cajero debe abrir caja con el efectivo inicial autorizado.

Flujo normal:

1. Entrar a **Caja**.
2. Abrir caja.
3. Entrar a **Nueva factura**.
4. Escribir el nombre del paciente.
5. Buscar y agregar servicios.
6. Revisar total.
7. Emitir factura.
8. Cobrar una sola vez.
9. Imprimir recibo.

Si el navegador se cierra o la computadora se reinicia, revise **Caja** e
**Historial** antes de repetir una factura o un cobro.

## 3. Recibos E Impresion

1. Despues de cobrar, abra la vista de recibo.
2. Revise paciente, numero, total, cajero y metodo de pago.
3. Imprima en el formato autorizado por administracion.
4. Si no imprime, no repita la factura ni el cobro. Revise impresora, papel y
   conexion, y reimprima desde **Historial** cuando el supervisor lo autorice.

## 4. Anulaciones Y Reimpresiones

Las facturas no se borran de la base de datos.

- Una anulacion requiere permiso, motivo y auditoria.
- Una reimpresion debe registrar motivo y quedar auditada.
- Si hay pago registrado, siga el flujo aprobado de reversion/anulacion; no
  intente corregir borrando datos.

## 5. Cierre De Caja

Al terminar el turno:

1. Entre a **Caja**.
2. Revise pagos por metodo.
3. Cuente el efectivo real.
4. Ingrese el monto contado.
5. Registre diferencia y nota si aplica.
6. Confirme cierre.

Si hay diferencia, avise al supervisor antes de cerrar o antes de abrir otro
turno.

## 6. Respaldos

Los respaldos protegen la informacion ante fallas de energia, disco o errores
operativos.

El administrador debe:

1. Entrar a **Respaldos**.
2. Revisar si el estado dice **Protegido**, **Pendiente** o **Error**.
3. Crear respaldo manual antes de cambios importantes.
4. Confirmar que el respaldo pase de **Pendiente** a **Protegido**.
5. Guardar copias externas segun la politica del hospital.

No restaure una base real sin probar primero en una base descartable.

## 7. Si Algo Falla

Use **Ayuda** dentro del sistema.

1. Abra **Ayuda**.
2. Presione **Preparar resumen**.
3. Entregue ese resumen al supervisor o responsable de soporte.
4. Si el sistema no abre, avise a soporte local desde la computadora servidor
   y no repita facturas ni cobros mientras se revisa el incidente.
5. Si soporte necesita mas evidencia, use solo la opcion indicada por soporte
   local o **Ayuda > Preparar resumen** cuando la pantalla lo permita.

No envie archivos de configuracion, respaldos de base de datos, contrasenas,
tokens ni mensajes tecnicos completos por canales no autorizados.

## 8. Capacitacion Segura

No practique anulaciones, restauraciones, cobros ficticios ni pruebas de base de
datos en produccion.

Si no existe un modo practica aislado, capacite en una instalacion separada o
una base descartable autorizada. La base real del hospital solo se usa para
operacion real.

Para preparar una sesion de entrenamiento, use
`docs\manuales\GUIA_CAPACITACION_SEGURA.md`.

## 9. Acciones Prohibidas En Produccion

- Ejecutar comandos de limpieza o reinicio de base de datos.
- Cargar datos de prueba en la base real.
- Borrar facturas, pagos o carpetas de datos.
- Borrar volumenes de base de datos.
- Usar cuentas compartidas.
- Repetir facturas o cobros para probar si algo fallo.
- Restaurar backups sobre la base real sin autorizacion y prueba previa.

## 10. Cierre De Incidente

Antes de dar un problema por resuelto:

1. Abra el sistema.
2. Inicie sesion.
3. Revise caja.
4. Revise historial si habia factura o pago en proceso.
5. Revise respaldos.
6. Anote que accion resolvio el problema.
