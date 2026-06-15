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

- Rama diagnosticada: `v1.1-critical-hardening-after-offline`.
- HEAD observado al cierre F21: `bd39cbeaedfed48a5a8f76d01b127d4ec9a53f1b`.
- Stack: Laravel API, React + TypeScript, MySQL/MariaDB local, Docker Compose.
- Estado permitido de este cierre: `TECHNICAL_DELIVERY_READY`.
- Validacion de gates: registrada en `reports/BILLING_OFFLINE_READINESS_REPORT.md`.

## Regla de release

No se permite declarar `PRODUCTION_READY` sin evidencia de servidor final, segunda PC LAN, impresora fisica, backup worker/tarea programada, restore final y configuracion production.

## Bloqueos para estados superiores

- `READY_FOR_REAL_LAN_INSTALLATION_TEST`: requiere paquete offline final limpio y checklist de instalacion en hardware real.
- `PRODUCTION_CANDIDATE`: requiere instalacion real ejecutada y aceptacion operativa en curso.
- `PRODUCTION_READY`: bloqueado hasta evidencia fisica final de servidor, segunda PC LAN, impresora, backup worker, restore y production config.
