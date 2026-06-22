# External Operational Acceptance Report

## Estado del desarrollo

- DESARROLLO DE SOFTWARE: CERRADO
- CÓDIGO EN MAIN: INTEGRADO Y VALIDADO
- REFACTORIZACIÓN VISUAL: COMPLETA
- VALIDACIÓN INTERNA: APROBADA
- ACEPTACIÓN OPERATIVA EXTERNA: DIFERIDA — NO EJECUTADA
- GO-LIVE FÍSICO: NO AUTORIZADO
- SHA BASE EVALUADO: de0fa18ff840053a15028003423d8e7863133fce

ESTADO DE ACEPTACIÓN EXTERNA: DIFERIDA — NO EJECUTADA

> Los gates descritos en este documento requieren infraestructura,
> hardware y operadores externos. Su estado diferido no representa un
> defecto conocido ni trabajo de software incompleto. No deben marcarse
> como PASS sin evidencia física real.

Fecha de apertura: 2026-06-22
Rama base: `main`
SHA probado esperado: `de0fa18ff840053a15028003423d8e7863133fce`
Alcance: aceptación física y operativa externa de S_Hospital ya integrado en `main`.

Este reporte distingue los gates internos reproducibles ya aprobados de la aceptación física externa. No autoriza despliegue físico ni tag de producción mientras la aceptación operativa externa no haya sido ejecutada por operaciones.

## Resumen de gates

| Gate | Estado | Motivo |
| --- | --- | --- |
| Segunda PC LAN real | DIFERIDO — NO EJECUTADO | Requiere operador, segunda estación LAN y entorno físico. |
| Flujo crítico desde dos PCs | DIFERIDO — NO EJECUTADO | Requiere dos equipos reales y usuarios de testing separados. |
| Impresión física | DIFERIDO — NO EJECUTADO | Requiere impresora real y revisión física de formatos disponibles. |
| Backup/restore MySQL/MariaDB descartable | DIFERIDO — NO EJECUTADO | Requiere entorno descartable con herramientas operativas reales. |
| Carga/concurrencia LAN real | DIFERIDO — NO EJECUTADO | Requiere clientes LAN reales o herramienta acordada por operaciones. |

## Instrucciones generales de evidencia

- Usar solo datos sintéticos.
- No registrar credenciales, secretos, tokens, contenido de `.env`, datos reales de pacientes ni IPs públicas.
- Fotografías permitidas solo si no contienen datos reales.
- No probar restore sobre base productiva.
- No cambiar firewall/red sin documentar acción, responsable y hora.
- No declarar PASS sin evidencia observada por operador.
- Si aparece un defecto reproducible, registrar el gate afectado y crear una rama `fix/external-acceptance-<descripcion>` desde `origin/main`.

## Gate 1 - Segunda PC LAN real

- Fecha y hora:
- Operador:
- Equipo utilizado:
- Sistema operativo:
- Navegador:
- URL LAN:
- SHA probado: `de0fa18ff840053a15028003423d8e7863133fce`
- Datos sintéticos utilizados:
- Resultado esperado: segunda PC accede por LAN, autentica, navega módulos permitidos, respeta permisos, sincroniza cambios y no muestra errores inesperados.
- Resultado observado:
- Evidencia:
- Estado: DIFERIDO — NO EJECUTADO
- Incidencias:

### Pasos a ejecutar

1. Abrir el sistema desde segunda PC mediante la URL LAN configurada.
2. Verificar HTTP/HTTPS según configuración prevista.
3. Login correcto con usuario sintético.
4. Login inválido.
5. Sesión expirada.
6. Cambio obligatorio de contraseña.
7. Menú correcto por rol.
8. Ruta restringida devuelve acceso denegado.
9. Dashboard carga.
10. Catálogo carga.
11. Nueva factura carga.
12. Caja carga.
13. Historial carga.
14. Reportes cargan.
15. Backups cargan según permisos.
16. Usuarios cargan según permisos.
17. Soporte muestra estado real.
18. Logout funciona.
19. Primera PC y segunda PC reciben cambios LAN previstos.
20. Sin pantallas en blanco, errores de consola ni requests fallidos inesperados.
21. Reconectar tras interrupción breve de LAN y verificar contrato actual.

### Mediciones pendientes

- Tiempo aproximado de carga:
- Errores de red:
- Errores de consola:
- Requests 4xx esperados:
- Requests 4xx/5xx inesperados:
- Estado de sincronización entre equipos:
- Acciones de firewall/red realizadas:

## Gate 2 - Flujo crítico desde dos PCs

- Fecha y hora:
- Operador:
- Equipo utilizado:
- Sistema operativo:
- Navegador:
- URL LAN:
- SHA probado: `de0fa18ff840053a15028003423d8e7863133fce`
- Datos sintéticos utilizados:
- Resultado esperado: una sola caja abierta cuando corresponde, un solo pago efectivo, un solo movimiento contable, sin correlativos ni recibos duplicados.
- Resultado observado:
- Evidencia:
- Estado: DIFERIDO — NO EJECUTADO
- Incidencias:

### Pasos a ejecutar

PC 1:

1. Abrir caja con usuario de testing.
2. Crear factura sintética.
3. Registrar pago.

PC 2:

1. Verificar actualización del dashboard.
2. Verificar historial.
3. Verificar estado de caja según permisos.
4. Verificar recibo.
5. Verificar que no se dupliquen movimientos.

Casos concurrentes:

1. Dos intentos de abrir caja concurrentemente para el mismo usuario.
2. Dos envíos del mismo pago.
3. Dos clicks rápidos sobre registrar.
4. Refresh durante una operación.
5. Reconectar después de pérdida temporal de LAN.

### Validaciones pendientes

- Caja duplicada:
- Pago duplicado:
- Movimiento contable duplicado:
- Número fiscal duplicado:
- Recibo duplicado:
- Mensajes funcionales sin SQL/stack trace/códigos internos:

## Gate 3 - Impresión física

- Fecha y hora:
- Operador:
- Equipo utilizado:
- Sistema operativo:
- Navegador:
- URL LAN:
- SHA probado: `de0fa18ff840053a15028003423d8e7863133fce`
- Impresora(s):
- Datos sintéticos utilizados:
- Resultado esperado: formatos disponibles imprimen con márgenes, orientación, escala y legibilidad correctas, sin QR/barcode no autorizado ni IDs internos.
- Resultado observado:
- Evidencia:
- Estado: DIFERIDO — NO EJECUTADO
- Incidencias:

### Formatos

| Formato | Hardware disponible | Estado | Evidencia | Incidencias |
| --- | --- | --- | --- | --- |
| Letter | Pendiente | DIFERIDO — NO EJECUTADO | | |
| Media carta | Pendiente | DIFERIDO — NO EJECUTADO | | |
| A5 | Pendiente | DIFERIDO — NO EJECUTADO | | |
| 80 mm | Pendiente | DIFERIDO — NO EJECUTADO; usar DIFERIDO — HARDWARE NO DISPONIBLE si no existe impresora compatible | | |
| 58 mm | Pendiente | DIFERIDO — NO EJECUTADO; usar DIFERIDO — HARDWARE NO DISPONIBLE si no existe impresora compatible | | |

### Escenarios a ejecutar

1. Documento con un ítem.
2. Documento con varios ítems.
3. Documento multipágina.
4. Descripción larga.
5. Nombre de paciente largo.
6. Con logo.
7. Sin logo.
8. Total cero donde el contrato lo permita.
9. Totales grandes.
10. Documento anulado.
11. Primera impresión.
12. Reimpresión con motivo.

### Revisión física pendiente

- Márgenes:
- Orientación:
- Tamaño real:
- Nitidez:
- Escala:
- Encabezado:
- Tabla:
- Alineación de montos:
- Saltos de página:
- Repetición del encabezado:
- Pie de página:
- Texto legal existente:
- Legibilidad en escala de grises:
- Contenido cortado:
- Espacios en blanco anormales:
- Papel desperdiciado:
- Corte térmico:
- Ausencia de QR/barcode no autorizado:
- Ausencia de IDs internos:

## Gate 4 - Backup y restore MySQL/MariaDB descartable

- Fecha y hora:
- Operador:
- Equipo utilizado:
- Sistema operativo:
- Navegador:
- URL LAN o URL aislada:
- SHA probado: `de0fa18ff840053a15028003423d8e7863133fce`
- Entorno descartable:
- Datos sintéticos utilizados:
- Resultado esperado: backup real generado y restaurado en base descartable con integridad de conteos, relaciones, secuencias y consultas críticas.
- Resultado observado:
- Evidencia:
- Estado: DIFERIDO — NO EJECUTADO
- Incidencias:

### Procedimiento a ejecutar

1. Crear entorno descartable: contenedor independiente, proyecto Docker exclusivo, volumen temporal, base exclusiva y credenciales de testing.
2. Crear datos sintéticos: usuarios, servicios, configuración fiscal, caja, facturas, pagos y recibos.
3. Ejecutar backup mediante flujo real.
4. Verificar archivo, tamaño mayor que cero, nombre esperado, permisos de descarga y ausencia de secretos en logs.
5. Destruir base descartable.
6. Crear base descartable vacía.
7. Ejecutar restore mediante procedimiento operativo oficial.
8. Ejecutar migraciones o validaciones documentadas.
9. Comparar antes/después.
10. Iniciar frontend/backend contra base restaurada.
11. Verificar login y consultas críticas.
12. Destruir entorno temporal.

### Comparación pendiente

- Conteos tablas críticas:
- Facturas:
- Pagos:
- Movimientos:
- Recibos:
- Usuarios/roles:
- Secuencias fiscales:
- Estados:
- Relaciones:
- Checksums/hashes:
- Login post-restore:
- Consultas críticas post-restore:

## Gate 5 - Carga y concurrencia LAN

- Fecha y hora:
- Operador:
- Equipo utilizado:
- Sistema operativo:
- Navegador/herramienta:
- URL LAN o URL aislada:
- SHA probado: `de0fa18ff840053a15028003423d8e7863133fce`
- Datos sintéticos utilizados:
- Resultado esperado: sin corrupción, duplicados, 500 inesperados o pérdida de usabilidad tras carga razonable.
- Resultado observado:
- Evidencia:
- Estado: DIFERIDO — NO EJECUTADO
- Incidencias:

### Escenarios a ejecutar

1. Aperturas concurrentes de caja.
2. Creación concurrente de facturas.
3. Reserva concurrente de correlativos.
4. Pagos duplicados.
5. Idempotency keys repetidas.
6. Reimpresiones concurrentes.
7. Consultas simultáneas de dashboard/historial/reportes.
8. Reconexión LAN.
9. Carga sostenida razonable para operadores esperados.

### Métricas pendientes

- Número de clientes:
- Duración:
- Requests totales:
- Latencia mediana:
- Latencia p95:
- Errores 4xx esperados:
- Errores 5xx inesperados:
- Timeouts:
- Duplicados:
- Deadlocks:
- Estado de la base al terminar:
- Sistema utilizable después de la prueba:

## Registro de defectos

| ID | Gate | Severidad | Resumen | Reproducción | Evidencia | Responsable | Acción siguiente | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

## Decisión final

- Segunda PC LAN: DIFERIDO — NO EJECUTADO
- Flujo crítico dos PCs: DIFERIDO — NO EJECUTADO
- Impresión física de formatos disponibles: DIFERIDO — NO EJECUTADO
- Formatos sin hardware: pendientes de aceptación explícita por operaciones o registrar DIFERIDO — HARDWARE NO DISPONIBLE
- Backup/restore descartable: DIFERIDO — NO EJECUTADO
- Concurrencia/carga real: DIFERIDO — NO EJECUTADO
- Bugs P0/P1: ninguno registrado en este reporte al momento de cierre de software
- Evidencia externa completa: no
- SHA probado coincide con origin/main al crear este documento: sí
- Tag de release: no creado

Producción física aprobada: NO

Recomendación operativa: el desarrollo de software queda cerrado; operaciones debe ejecutar los gates externos cuando existan equipos, hardware y responsables disponibles. Solo se debe reabrir desarrollo si una prueba física reproduce un defecto real.
