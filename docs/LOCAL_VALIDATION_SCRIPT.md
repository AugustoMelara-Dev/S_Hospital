# Guion de validacion local - Sistema de Caja Hospitalaria

## Objetivo

Recorrer el flujo operativo completo sin depender de internet: login local, caja, factura, regla de eritropoyetina, cobro, recibo institucional, historial, reportes y respaldo local.

## Datos sugeridos

Usuarios de validacion:

- Administrador temporal creado con `php artisan auth:create-initial-admin`.
- Cajero temporal creado desde Administracion de Usuarios.
- Supervisor temporal creado desde Administracion de Usuarios.

Estas cuentas deben exigir cambio de contrasena cuando corresponda y no deben quedar activas con contrasenas conocidas al finalizar la prueba.

Pacientes sugeridos:

- Maria Lopez.
- Jose Perez.
- Ana Rivera.

Servicios sugeridos:

- Eritropoyetina, precio normal L.25.
- Eritropoyetina con receta de dialisis marcada, precio L.0 segun regla del backend.
- Glucosa.
- Hemograma Completo.

Configuracion institucional:

- Hospital: Hospital San Isidro.
- RTN, CAI y secuencia: usar los datos autorizados por administracion o marcar la configuracion como pendiente mientras no se opere en produccion.
- Recibo por defecto: media carta, con opciones carta y A5.

## Guion principal

1. Login local
   - Entrar con una cuenta de cajero autorizada.
   - Confirmar que la pantalla no requiere servicios cloud ni internet.
   - Confirmar que solo aparecen opciones operativas del cajero.
   - Confirmar sidebar izquierdo, topbar con usuario/caja y cero errores visibles.

2. Abrir caja
   - Ir a Caja.
   - Abrir caja con L.500.00.
   - Confirmar estado "Caja abierta".
   - Confirmar que Nueva factura avisa y ofrece acceso a Caja si no hay caja abierta.

3. Crear factura con Eritropoyetina normal
   - Ir a Nueva factura.
   - Paciente: Maria Lopez.
   - Seleccionar categoria `Medicamentos` o buscar `Eritropoyetina`.
   - No marcar receta de dialisis.
   - Confirmar vista previa con precio normal L.25 antes de emitir.
   - Emitir factura con caja abierta.
   - Registrar pago e imprimir/visualizar recibo institucional.

4. Crear factura con Eritropoyetina con receta de dialisis
   - Paciente: Jose Perez.
   - Seleccionar Eritropoyetina desde categoria o busqueda.
   - Marcar "Receta de dialisis".
   - Confirmar vista previa en L.0 para ese item.
   - Emitir factura con caja abierta y confirmar saldo L.0.00.

5. Cobrar factura
   - En la factura emitida, usar metodo Efectivo.
   - Cobrar el saldo.
   - Confirmar estado Pagada y saldo L.0.00.
   - Si el monto recibido es menor que el total, confirmar que el sistema bloquea el pago completo o registra parcial solo si la configuracion lo permite.

6. Ver recibo institucional
   - Confirmar vista previa institucional en media carta.
   - Cambiar a carta y A5 para validar margenes.
   - Usar Imprimir solo en entorno con impresora o impresora virtual autorizada.
   - Confirmar que el recibo no contiene QR, codigo de barras, codigos internos ni datos tecnicos.

7. Reimprimir
   - Ir a Historial.
   - Abrir la factura pagada.
   - Agregar motivo de reimpresion.
   - Reimprimir en media carta, carta o A5.
   - Confirmar que usa snapshots historicos.

8. Anular factura sin pagos
   - Crear una factura nueva sin cobrarla.
   - Ir a Historial como administrador o supervisor con permiso.
   - Abrir la factura emitida sin pagos.
   - Escribir motivo de anulacion.
   - Confirmar anulacion.
   - Confirmar estado Anulada y que no se borra la factura.

9. Ver historial
   - Filtrar por fecha de hoy.
   - Buscar por paciente o numero de factura.
   - Confirmar pagadas, emitidas, parciales y anuladas.

10. Ver reportes gerenciales
    - Entrar como supervisor o administrador.
    - Ir a Reportes.
    - Ver reporte diario.
    - Ver rango de fechas con filtros de caja, cajero, categoria, metodo y estado.
    - Confirmar ingresos por metodo de pago.
    - Confirmar ingresos por categoria.
    - Confirmar grafico de servicios mas vendidos.
    - Confirmar auditoria operativa: anulaciones, reimpresiones, respaldos y cajeros con ingreso.
    - Ver resumen de caja por numero de caja.
    - Exportar CSV del rango cuando haya datos y el usuario tenga `reports.export`.

11. Crear respaldo local
    - Entrar como administrador.
    - Ir a Respaldos.
    - Crear respaldo.
    - Confirmar estado Pendiente.
    - Confirmar que el worker local lo cambia a Protegido si existe `mariadb-dump` o `mysqldump`.
    - Descargar solo respaldos protegidos.

## Validaciones que se deben mencionar

- El backend valida permisos; ocultar botones no es la seguridad real.
- El frontend solo previsualiza totales; el backend recalcula y guarda snapshots.
- No existe restauracion por UI para evitar acciones destructivas accidentales.
- Paciente es solo nombre, no expediente clinico.
- Respaldos son locales y no cloud.
- Cada modulo vive en su ruta: caja, nueva factura, catalogo, historial, reportes, respaldos y configuracion.
- El camino principal exige caja abierta antes de emitir y cobrar.
- Los reportes salen del backend, aplican filtros y exigen permisos para exportar.

## Pendientes que no se deben presentar como cerrados

- Restore real: pendiente hasta probar con MySQL/MariaDB real o Docker descartable.
- Impresion fisica: pendiente hasta validar impresora media carta/carta/A5.
- Concurrencia real MySQL/MariaDB: validar antes de produccion final.
- LAN fisica desde cliente: validar por IP fija/nombre servidor antes de produccion final.
- E2E Playwright local: disponible con `npm.cmd run e2e`; no reemplaza restore/concurrencia/hardware real.
- Smoke real con consola limpia: usar `npm.cmd run smoke:real` con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`.
