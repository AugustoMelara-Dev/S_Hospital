# Guia de respaldos y restauracion

Los respaldos protegen facturas, pagos, caja, catalogo, usuarios, reportes y configuracion.

## Regla principal

Un respaldo es confiable solo si aparece:

- Completado.
- Con tamano mayor a cero.
- Con huella SHA256.
- Copiado a un medio seguro cuando administracion lo requiera.

## Crear respaldo manual

1. Entre a **Respaldos** como administrador.
2. Presione **Crear respaldo**.
3. Espere que el estado cambie a **Completado**.
4. Revise tamano y huella SHA256.
5. Descargue o copie el respaldo a USB/disco externo autorizado.

Si queda **Pendiente** por mucho tiempo, avise al responsable tecnico.

## Respaldos automaticos

El sistema debe tener respaldos automaticos:

- Diario fuera del horario de caja.
- Al cerrar caja, si el servidor esta configurado para procesarlo.
- Manual antes de cambios importantes.

El administrador debe revisar el historial todos los dias.

## Restauracion segura

Restaurar puede reemplazar informacion. No se hace directo desde la pantalla de respaldos.

Antes de restaurar:

1. Detener facturacion y avisar al personal.
2. Crear respaldo nuevo del estado actual.
3. Confirmar archivo a restaurar.
4. Verificar huella SHA256.
5. Restaurar primero en una base descartable.
6. Revisar login, usuarios, servicios, facturas, pagos, caja, reportes y respaldos.
7. Solo despues de validar, decidir restauracion de produccion.

## Evidencia minima

Anote:

- Fecha y hora.
- Responsable.
- Archivo usado.
- Huella SHA256.
- Base descartable usada para prueba.
- Resultado de login.
- Conteos revisados: usuarios, servicios, facturas, pagos, cajas y respaldos.
- Firma o aprobacion de administracion.

## Senales de alerta

Avise si ve:

- Respaldo fallido.
- Muchos respaldos pendientes.
- Tamano cero.
- Sin respaldo reciente.
- La huella SHA256 no aparece.
- Mensaje de disco lleno o permisos.
