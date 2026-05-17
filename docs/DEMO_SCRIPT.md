# Demo vendible - Hospital Billing OS Offline

## Objetivo

Mostrar el flujo operativo completo sin depender de internet: login local, caja, factura, regla de eritropoyetina, cobro, recibo termico, historial, reportes y backup local.

## Datos demo sugeridos

Usuarios de desarrollo/testing:

- Admin: `admin.demo`
- Supervisor: `supervisor.demo`
- Cajero: `cajero.demo`
- Password demo local: `Password123!`

Estos usuarios son creados solo en entornos `local` o `testing`. Produccion debe usar `php artisan auth:create-initial-admin` con password temporal y `must_change_password=true`.

Pacientes sugeridos:

- Maria Lopez
- Jose Perez
- Ana Rivera

Servicios sugeridos:

- Eritropoyetina, precio normal L.25.
- Eritropoyetina con receta de dialisis marcada, precio L.0 segun regla del backend.
- Glucosa.
- Hemograma Completo.

Configuracion demo:

- Hospital: Hospital Demo.
- RTN: 08011999123456.
- CAI: DEMO-CAI.
- Secuencia activa: `000-001-01`.
- Recibo por defecto: 80mm, con opcion 58mm.

## Guion principal

1. Login local
   - Entrar como `cajero.demo`.
   - Confirmar que la pantalla no requiere servicios cloud ni internet.
   - Confirmar que solo aparecen opciones operativas del cajero.

2. Abrir caja
   - Ir a Caja.
   - Abrir caja con L.500.00.
   - Confirmar estado "Caja abierta".

3. Crear factura con Eritropoyetina normal
   - Ir a Nueva factura.
   - Paciente: Maria Lopez.
   - Buscar y seleccionar Eritropoyetina.
   - No marcar receta de dialisis.
   - Confirmar preview con precio normal L.25 antes de emitir.
   - Emitir factura.

4. Crear factura con Eritropoyetina con receta de dialisis
   - Paciente: Jose Perez.
   - Seleccionar Eritropoyetina.
   - Marcar "Receta de dialisis".
   - Confirmar preview en L.0 para ese item.
   - Emitir factura.

5. Cobrar factura
   - En la factura emitida, usar metodo Efectivo.
   - Cobrar el saldo.
   - Confirmar estado `paid` y saldo L.0.00.

6. Ver recibo termico
   - Confirmar preview termico 80mm.
   - Cambiar a 58mm y confirmar que el ancho cambia.
   - Usar Imprimir solo en entorno con impresora o impresora virtual.

7. Reimprimir
   - Ir a Historial.
   - Abrir la factura pagada.
   - Agregar motivo de reimpresion.
   - Reimprimir en 80mm o 58mm.
   - Confirmar que usa snapshots historicos.

8. Anular factura sin pagos
   - Crear una factura nueva sin cobrarla.
   - Ir a Historial como admin o supervisor con permiso.
   - Abrir la factura emitida sin pagos.
   - Escribir motivo de anulacion.
   - Confirmar anulacion.
   - Confirmar estado Anulada y que no se borra la factura.

9. Ver historial
   - Filtrar por fecha de hoy.
   - Buscar por paciente o numero de factura.
   - Confirmar pagadas, emitidas y anuladas.

10. Ver reportes
    - Entrar como `supervisor.demo` o `admin.demo`.
    - Ir a Reportes.
    - Ver reporte diario.
    - Ver rango de fechas.
    - Ver resumen de caja por numero de caja.

11. Crear backup local
    - Entrar como `admin.demo`.
    - Ir a Backups.
    - Crear backup.
    - Confirmar estado `pending`.
    - Confirmar que el worker local lo cambia a `success` si existe `mariadb-dump` o `mysqldump`.
    - Descargar solo backups con `success`.

## Validaciones que se deben mencionar en demo

- El backend valida permisos; ocultar botones no es la seguridad real.
- El frontend solo previsualiza totales; el backend recalcula y guarda snapshots.
- No existe restore por UI para evitar restauraciones destructivas accidentales.
- Paciente es solo nombre, no expediente clinico.
- Backups son locales y no cloud.

## Pendientes no vendibles como completados

- Restore real: `PENDING_ENVIRONMENT_VALIDATION` hasta probar con MySQL/MariaDB real o Docker.
- Impresion fisica termica: pendiente hasta tener impresora 80mm/58mm.
- Concurrencia real MySQL/MariaDB: validar antes de produccion final.
- LAN fisica desde cliente: validar por IP fija/nombre servidor antes de produccion final.
- E2E Playwright local de Fase 10: disponible con `npm.cmd run e2e`; no reemplaza restore/concurrencia/hardware real.
