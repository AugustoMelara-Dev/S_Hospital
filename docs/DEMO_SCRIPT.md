# Demo vendible - Sistema de Caja Hospitalaria

## Objetivo

Mostrar el flujo operativo completo sin depender de internet: login local, caja, factura, regla de eritropoyetina, cobro, recibo institucional, historial, reportes y backup local.

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

## Guion principal premium

1. Login local
   - Entrar como `cajero.demo`.
   - Confirmar que la pantalla no requiere servicios cloud ni internet.
   - Confirmar que solo aparecen opciones operativas del cajero.
   - Confirmar sidebar izquierdo, topbar con usuario/caja y cero errores visibles.

2. Abrir caja
   - Ir a Caja.
   - Abrir caja con L.500.00.
   - Confirmar estado "Caja abierta".
   - Confirmar que Nueva factura avisa y ofrece CTA a Caja si no hay caja abierta.

3. Crear factura con Eritropoyetina normal
   - Ir a Nueva factura.
   - Paciente: Maria Lopez.
   - Seleccionar categoria `Medicamentos` o buscar `Eritropoyetina`.
   - No marcar receta de dialisis.
   - Confirmar preview con precio normal L.25 antes de emitir.
   - Emitir factura con caja abierta.
   - Registrar pago e imprimir/visualizar recibo institucional.

4. Crear factura con Eritropoyetina con receta de dialisis
   - Paciente: Jose Perez.
   - Seleccionar Eritropoyetina desde categoria o scanner/codigo.
   - Marcar "Receta de dialisis".
   - Confirmar preview en L.0 para ese item.
   - Emitir factura con caja abierta y confirmar saldo L.0.00.

5. Escanear codigo o QR
   - En Nueva factura, usar "Scanner USB o codigo manual".
   - Escribir o escanear un `scan_code`, `barcode` o `qr_code` de un servicio activo.
   - Confirmar que se agrega al carrito.
   - Intentar un codigo inexistente y confirmar error claro.
   - Recalcar que el backend busca el codigo y calcula el precio final.

6. Cobrar factura
   - En la factura emitida, usar metodo Efectivo.
   - Cobrar el saldo.
   - Confirmar estado Pagada y saldo L.0.00.

7. Ver recibo institucional
   - Confirmar vista previa institucional 80mm.
   - Cambiar a 58mm y confirmar que el ancho cambia.
   - Usar Imprimir solo en entorno con impresora o impresora virtual.

8. Reimprimir
   - Ir a Historial.
   - Abrir la factura pagada.
   - Agregar motivo de reimpresion.
   - Reimprimir en media carta, carta o A5.
   - Confirmar que usa snapshots historicos.

9. Anular factura sin pagos
   - Crear una factura nueva sin cobrarla.
   - Ir a Historial como admin o supervisor con permiso.
   - Abrir la factura emitida sin pagos.
   - Escribir motivo de anulacion.
   - Confirmar anulacion.
   - Confirmar estado Anulada y que no se borra la factura.

10. Ver historial
   - Filtrar por fecha de hoy.
   - Buscar por paciente o numero de factura.
   - Confirmar pagadas, emitidas y anuladas.

11. Ver reportes gerenciales
    - Entrar como `supervisor.demo` o `admin.demo`.
    - Ir a Reportes.
    - Ver reporte diario.
    - Ver rango de fechas con filtros de caja, cajero, categoria, metodo y estado.
    - Confirmar ingresos por metodo de pago.
    - Confirmar ingresos por categoria.
    - Confirmar grafico de servicios mas vendidos.
    - Confirmar auditoria operativa: anulaciones, reimpresiones, backups y cajeros con ingreso.
    - Ver resumen de caja por numero de caja.
    - Exportar CSV del rango cuando haya datos y el usuario tenga `reports.export`.

12. Crear backup local
    - Entrar como `admin.demo`.
    - Ir a Backups.
    - Crear backup.
    - Confirmar estado Pendiente.
    - Confirmar que el worker local lo cambia a Completado si existe `mariadb-dump` o `mysqldump`.
    - Descargar solo backups Completados.

## Validaciones que se deben mencionar en demo

- El backend valida permisos; ocultar botones no es la seguridad real.
- El frontend solo previsualiza totales; el backend recalcula y guarda snapshots.
- No existe restore por UI para evitar restauraciones destructivas accidentales.
- Paciente es solo nombre, no expediente clinico.
- Backups son locales y no cloud.
- La UI ya no es una pagina interminable: cada modulo vive en su ruta.
- El POS no carga los 122 servicios de golpe: categoria, busqueda y scanner son el flujo normal.
- El camino principal del POS exige caja abierta antes de emitir y cobrar.
- Los reportes avanzados salen del backend, aplican filtros y exigen permisos para exportar.

## Pendientes no vendibles como completados

- Restore real: `PENDING_ENVIRONMENT_VALIDATION` hasta probar con MySQL/MariaDB real o Docker.
- Impresion fisica termica: pendiente hasta tener impresora media carta/carta/A5.
- Concurrencia real MySQL/MariaDB: validar antes de produccion final.
- LAN fisica desde cliente: validar por IP fija/nombre servidor antes de produccion final.
- E2E Playwright local: disponible con `npm.cmd run e2e`; no reemplaza restore/concurrencia/hardware real.
- Smoke real con consola limpia: usar `npm.cmd run smoke:real` con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`.
