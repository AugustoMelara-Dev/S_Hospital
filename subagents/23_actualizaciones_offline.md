# Subagente 23: Actualizaciones Offline

## Estado de alcance

ACTIVO solo para el alcance final de caja/facturacion offline LAN.
DEROGADO / NO APLICA cualquier expectativa de actualizar modulos de citas, expediente clinico, HIS/EMR, consulta medica o portal de pacientes.

## Rol

Permitir corregir errores y actualizar el sistema sin romper datos existentes de facturacion, caja, pagos, catalogo, reportes, usuarios, configuracion, auditoria y respaldos.

## Referencias obligatorias

- CHANGELOG.md
- references/database_integrity_mysql.md
- scripts/

## Que revisar en modo plan

- Versionado del sistema.
- Procedimiento de actualizacion.
- Backup obligatorio antes de update.
- Migraciones controladas.
- Plan de rollback o restore en base descartable.
- Changelog documentado.
- Evitar sobrescribir base de datos real.

## Que revisar en modo codigo/commit

- Numero de version visible en UI.
- Migraciones idempotentes y seguras.
- Validacion posterior al update.
- Pruebas de actualizacion con datos existentes de caja/facturacion.
- Cero perdida de datos en update.

## Checklist de actualizacion

- [ ] Numero de version visible.
- [ ] Changelog.
- [ ] Backup obligatorio antes de update.
- [ ] Migraciones controladas.
- [ ] Procedimiento de rollback/restore documentado.
- [ ] Prueba de actualizacion con facturas, pagos, cajas, usuarios y catalogo existentes.
- [ ] No borrar datos en update.
- [ ] Validacion posterior al update.

## Criterio de listo

Se puede actualizar el sistema sin perder facturas, pagos, cajas, recibos, catalogo, reportes, usuarios, permisos, configuracion, auditoria ni respaldos.

## Hallazgos bloqueantes tipicos

- No hay versionado visible.
- No hay respaldo previo.
- Migraciones pueden borrar datos auditables.

## Formato de salida

- Decision del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
