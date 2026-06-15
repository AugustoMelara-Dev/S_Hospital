# Alcance Final - Facturacion Hospitalaria Offline LAN

## Definicion oficial

S_Hospital se entrega como sistema hospitalario local/offline para caja, facturacion, pagos, recibos institucionales, catalogo de servicios facturables, historial de facturas, reportes administrativos/financieros, usuarios/permisos, configuracion, respaldos y ayuda/soporte.

Definicion final obligatoria: "S_Hospital se entrega como sistema hospitalario offline LAN para caja, facturacion, pagos, recibos institucionales, catalogo, historial, reportes, usuarios, configuracion, respaldos, auditoria y ayuda. No incluye expediente clinico, citas, consulta medica, triage, admisiones, hospitalizacion, laboratorio clinico, farmacia clinica, recetas clinicas ni portal de pacientes."

Opera en una red LAN sin requerir internet para login, facturacion, caja, reportes, recibos ni respaldos. El servidor local aloja la API Laravel, el frontend compilado y MySQL/MariaDB. Las estaciones cliente acceden por navegador usando IP local.

## Modulos finales autorizados

1. Inicio
2. Nueva factura
3. Caja
4. Catalogo
5. Historial
6. Reportes
7. Respaldos
8. Configuracion
9. Usuarios
10. Ayuda

## Fuera de alcance

No incluye expediente clinico, EMR, HIS clinico integral, citas, consulta medica, triage, admisiones clinicas, camas, enfermeria, roles clinicos, recetas clinicas, laboratorio clinico, farmacia clinica ni hospitalizacion.

Si aparecen nombres clinicos en categorias o servicios, se consideran conceptos facturables heredados del listado del hospital, no modulos clinicos ni promesas de atencion medica.

## Estado de cierre

El producto queda cerrado para demo/UAT y entrega tecnica segun los gates ejecutados. No debe declararse PRODUCTION_READY hasta validar en campo servidor real, segunda PC LAN, impresora fisica, backup worker/tarea programada, restore final y configuracion production.
