# Manual Del Administrador

Este manual es para usuarios autorizados a configurar el sistema y revisar operacion.

## Configuracion Del Hospital

Revise en **Configuracion fiscal/hospitalaria**:

- Nombre del hospital.
- RTN si aplica.
- Direccion.
- Lugar del recibo.
- Texto de Gobierno y Secretaria.
- Serie y numeracion autorizada.
- Plantilla del recibo.

No invente CAI, serie, rango o fecha de vencimiento. Estos datos deben validarse con administracion, Contaduria, SAR o SEFIN.

## Usuarios Y Permisos

Use cuentas separadas para cada persona.

- Cajero: abre caja, factura, cobra e imprime.
- Supervisor/Admin: configura, revisa reportes, autoriza anulaciones y respaldos.
- Auditor: consulta reportes e historial sin modificar.

No comparta usuarios entre turnos.

## Anulaciones

Una anulacion debe tener motivo y permiso. No se deben borrar facturas. Si una factura ya fue pagada y no existe flujo de reverso autorizado, debe bloquearse o revisarse por administracion.

## Reportes

Revise diariamente:

- Total facturado.
- Total cobrado.
- Cobros por metodo.
- Facturas parciales.
- Facturas anuladas.
- Cierre de caja y diferencias.

## Respaldos

Confirme que exista respaldo reciente antes de cambios importantes. Mantenga copia externa segura. Una buena practica es conservar varias copias en diferentes medios.

## Cambios Criticos

Antes de migraciones, actualizaciones o cambios de configuracion fiscal:

1. Cree respaldo.
2. Verifique que el respaldo aparezca como completado.
3. Registre quien hizo el cambio y por que.
4. Pruebe el flujo principal despues del cambio.

## Capacitacion Segura

El administrador prepara el entorno de entrenamiento. No use la base real para
practicar anulaciones, restauraciones, cobros ficticios, cierres de caja ni
comandos tecnicos.

Use `docs\manuales\GUIA_CAPACITACION_SEGURA.md` para preparar la sesion. Si no
existe un modo practica aislado dentro del producto, use una instalacion
separada o una base descartable con datos temporales claramente marcados.
