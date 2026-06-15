# Current Release Truth

## Verdad de producto

S_Hospital queda cerrado como sistema hospitalario offline LAN para caja, facturacion, pagos, recibos institucionales, catalogo, historial, reportes, usuarios, configuracion, respaldos, ayuda/soporte y auditoria.

No incluye expediente clinico, citas, consulta medica, triage, admisiones, laboratorio clinico, farmacia clinica, enfermeria, hospitalizacion ni HIS/EMR.

## Menu final autorizado

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

## Estado tecnico actual

- Rama diagnosticada: main.
- Stack: Laravel API, React + TypeScript, MySQL/MariaDB local, Docker Compose.
- La validacion de gates frescos se registra en `reports/BILLING_OFFLINE_READINESS_REPORT.md`.

## Regla de release

No se permite declarar PRODUCTION_READY sin evidencia de servidor final, segunda PC LAN, impresora fisica, backup worker/tarea programada, restore final y configuracion production.
