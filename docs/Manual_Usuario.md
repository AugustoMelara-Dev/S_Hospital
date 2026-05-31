# Manual de Usuario - Hospital San Isidro

Este manual resume la operacion diaria del Sistema de Caja Hospitalaria del Hospital San Isidro. El sistema trabaja en la red local del hospital y no necesita internet para facturar, cobrar, imprimir recibos, consultar reportes o crear respaldos.

## Acceso al sistema

1. Encienda la computadora servidor.
2. Abra el acceso directo del sistema o espere el arranque automatico.
3. Desde una computadora cliente conectada a la misma red, abra el navegador e ingrese la direccion local indicada por soporte, por ejemplo `http://192.168.1.10`.
4. Inicie sesion con su usuario real.
5. Si el sistema solicita cambio de contrasena, hagalo antes de operar caja.

## Operacion de caja

1. Abra caja con el monto inicial.
2. En **Nueva factura**, escriba primero el nombre del paciente.
3. Busque servicios por nombre, categoria o codigo si administracion habilito lector.
4. Revise el carrito, total, monto recibido, cambio y saldo pendiente.
5. Confirme la factura solo una vez y espere la respuesta del sistema.
6. Registre pago completo o parcial segun la configuracion autorizada.
7. Imprima el recibo institucional y entregue la copia correspondiente.
8. Al terminar el turno, cierre caja con el efectivo contado y comentarios si hay diferencias.

## Anulaciones

Las facturas no se borran. Una anulacion requiere permiso de supervisor o administrador, motivo claro y registro de auditoria. Si un cajero detecta un error, debe avisar antes de cerrar caja.

## Recibos

El recibo debe mostrar el encabezado institucional, numero, paciente, conceptos, valor, cajero, fecha y area de firma o sello. El recibo para paciente no debe mostrar QR, codigos de barra ni codigos internos del catalogo.

## Respaldos

El administrador debe revisar respaldos todos los dias.

1. Entre a **Respaldos**.
2. Revise que el ultimo respaldo este completado.
3. Cree respaldo manual cuando administracion lo solicite.
4. Descargue y copie el archivo a un medio seguro.
5. Si un respaldo queda pendiente o fallido, avise a soporte antes de declarar cerrado el dia.

## Restauracion

Nunca restaure directamente sobre la base activa del hospital como primer paso.

1. Verifique el archivo de respaldo.
2. Pruebe la restauracion en una base descartable.
3. Valide que el sistema abre, permite iniciar sesion y muestra facturas, caja, reportes y respaldos.
4. Solo con autorizacion administrativa, respaldo final reciente y usuarios fuera del sistema se puede recuperar el servidor activo.

## Si algo falla

- No abre el sistema: espere dos minutos y use el acceso directo otra vez.
- No abre desde otra computadora: revise que el servidor este encendido, la red funcione y la direccion IP sea correcta.
- No imprime: revise impresora predeterminada, papel y permisos de impresion.
- No aparece un servicio: revise categoria **Todos** y busqueda; si persiste, avise a administracion.
- No puede cobrar: confirme que su caja este abierta.
- El respaldo falla: avise al administrador o soporte local.

## Responsabilidades

- Cajero: facturar, cobrar, imprimir recibos y cerrar caja.
- Supervisor: revisar cierres, diferencias, anulaciones y reimpresiones.
- Administrador: usuarios, catalogo, configuracion fiscal, reportes, respaldos y coordinacion de soporte.
- Soporte local: instalacion, arranque Windows, red LAN, base de datos, restauracion y mantenimiento tecnico.
