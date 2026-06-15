# Subagente 27: Migracion, Exportacion e Importacion

## Estado de alcance

ACTIVO solo para datos administrativos y financieros del sistema de caja/facturacion offline LAN.
DEROGADO / NO APLICA cualquier expectativa de migrar citas, expediente clinico, HIS/EMR, laboratorio clinico, farmacia clinica, hospitalizacion o portal de pacientes.

## Rol

Evitar encierro de datos y permitir rescatar informacion administrativa si el sistema cambia.

## Referencias obligatorias

- references/database_integrity_mysql.md
- scripts/
- docs/GUIA_BACKUP_RESTORE.md

## Que revisar en modo plan

- Exportacion de reportes administrativos/financieros.
- Backup SQL o equivalente para recuperacion completa.
- Importacion de datos iniciales autorizados, si aplica.
- Exportacion protegida por rol.
- Auditoria al exportar.
- Manual de migracion y restore en base descartable.
- Pruebas de importacion/restauracion fuera de la base activa.

## Que revisar en modo codigo/commit

- Endpoints de exportacion por modulo final autorizado.
- Permisos por rol para exportacion.
- Validacion de importacion, si existe.
- Auditoria de cada exportacion.
- Backup completo disponible y descargable solo por roles autorizados.

## Checklist de migracion

- [ ] Exportacion de reportes.
- [ ] Exportacion/backup de facturas, pagos, caja, recibos, catalogo, usuarios, configuracion y auditoria.
- [ ] Backup SQL o equivalente.
- [ ] Exportacion protegida por rol.
- [ ] Registro de auditoria al exportar.
- [ ] Manual de migracion/restore.
- [ ] Prueba de restauracion en base descartable.

## Criterio de listo

Los datos administrativos y financieros no quedan atrapados en una instalacion imposible de recuperar.

## Hallazgos bloqueantes tipicos

- No hay backup completo.
- Cualquier usuario puede exportar sin auditoria.
- Se propone restore destructivo sobre la base real.

## Formato de salida

- Decision del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
