# Guia De Capacitacion Segura

Esta guia sirve para capacitar cajeros, supervisores y administradores sin
poner en riesgo la base real del Hospital San Isidro.

## Regla Principal

No use la base de produccion para practicar. Las pruebas de facturas, cobros,
anulaciones, reimpresiones, cierres de caja, respaldos y restauraciones deben
hacerse en un entorno aislado preparado por administracion o soporte.

Si no existe un modo practica aislado dentro del producto, use una de estas
opciones:

1. Una computadora separada con una instalacion de capacitacion.
2. Una base descartable creada solo para entrenamiento.
3. Un respaldo restaurado en una base de prueba con nombre claro, nunca sobre la
   base real.

El entorno de capacitacion debe decir claramente que no es produccion.

## Antes De Capacitar

- Confirmar que la capacitacion no usa la direccion LAN de produccion.
- Confirmar que el usuario de practica no es una cuenta real de turno.
- Confirmar que no hay impresora fiscal o recibo real seleccionado para pruebas
  salvo que administracion lo autorice.
- Confirmar que los datos fiscales, CAI y rangos usados son temporales o
  ficticios y no se entregaran como facturas reales.
- Confirmar que existe respaldo reciente de produccion antes de cualquier
  preparacion tecnica.

## Ejercicios Para Cajero

1. Abrir el sistema desde el acceso institucional.
2. Iniciar sesion con usuario propio de practica.
3. Abrir caja con monto inicial ficticio.
4. Crear factura con paciente de ejemplo.
5. Agregar y quitar servicios.
6. Cobrar una sola vez.
7. Imprimir o previsualizar recibo.
8. Buscar factura en Historial.
9. Reimprimir con motivo si el rol lo permite.
10. Cerrar caja con conteo ficticio.

Mensaje clave para el cajero: si el sistema falla, no repita facturas ni cobros
sin revisar Caja e Historial.

## Ejercicios Para Supervisor

1. Revisar que cada cajero use su propia cuenta.
2. Revisar una diferencia de caja.
3. Autorizar una reimpresion con motivo.
4. Revisar una anulacion con motivo antes de confirmar.
5. Simular impresora sin respuesta y practicar el mensaje al cajero.
6. Simular red local caida y detener nuevas facturas desde clientes.
7. Preparar evidencia desde **Ayuda > Preparar resumen**.

Mensaje clave para el supervisor: no arregle errores borrando datos ni abriendo
otra caja para ocultar una diferencia.

## Ejercicios Para Administrador

1. Revisar usuarios y permisos.
2. Revisar configuracion fiscal sin inventar datos reales.
3. Crear respaldo manual en el entorno de capacitacion.
4. Revisar el estado operativo en **Respaldos**.
5. Generar un paquete de soporte seguro si el sistema no abre.
6. Restaurar un respaldo solo en base descartable.
7. Confirmar que el sistema no muestra secretos, rutas locales ni variables
   crudas en pantallas normales.

Mensaje clave para el administrador: una restauracion nunca se practica sobre la
base real del hospital.

## Fallos Que Deben Practicarse

- Servidor no disponible.
- Red local caida.
- Impresora no responde.
- Caja quedo abierta.
- Respaldo fallido.
- Sesion vencida.
- Error de permisos.
- Navegador cerrado durante factura o cobro.
- Reinicio de la computadora por falla de energia.

En cada caso, el instructor debe pedir al participante:

1. Decir que paso en palabras simples.
2. Identificar que no debe repetir facturas ni cobros a ciegas.
3. Revisar la pantalla correcta.
4. Preparar resumen seguro para soporte.
5. Escalar al rol correcto.

## Acciones Prohibidas Durante Capacitacion

- Usar usuarios reales de produccion.
- Usar datos reales de pacientes para practicar.
- Emitir recibos que puedan confundirse con documentos reales.
- Ejecutar seeders o comandos de prueba en el servidor real.
- Ejecutar `migrate:fresh` en produccion.
- Restaurar backups sobre la base real.
- Borrar facturas, pagos, respaldos o volumenes.
- Compartir `.env`, passwords, tokens o respaldos SQL.

## Cierre De Capacitacion

Antes de terminar:

1. Confirmar que todos practicaron abrir sistema, facturar, cobrar, imprimir,
   reimprimir, cerrar caja y pedir soporte.
2. Confirmar que el entorno usado fue aislado.
3. Eliminar o archivar cuentas de practica segun indique administracion.
4. Registrar dudas frecuentes para mejorar el manual.
5. Confirmar que nadie usara la base real para seguir practicando.
