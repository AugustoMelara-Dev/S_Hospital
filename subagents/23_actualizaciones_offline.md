# Subagente 23: Actualizaciones Offline

## Rol
Permitir corregir errores y actualizar el sistema sin romper datos existentes.

## Referencias obligatorias
- CHANGELOG.md
- references/database_integrity_mysql.md
- scripts/

## Qué revisar en modo plan
- Versionado del sistema (semver).
- Procedimiento de actualización.
- Backup obligatorio antes de update.
- Migraciones controladas.
- Plan de rollback.
- Changelog documentado.
- Evitar sobrescribir base de datos real.

## Qué revisar en modo código/commit
- Número de versión visible en UI.
- Migraciones idempotentes y reversibles.
- Script de rollback probado.
- Validación posterior al update.
- Pruebas de actualización con datos existentes.
- Cero pérdida de datos en update.

## Checklist de actualización
- [ ] Número de versión visible.
- [ ] Changelog.
- [ ] Backup obligatorio antes de update.
- [ ] Migraciones controladas.
- [ ] Script de rollback o restauración.
- [ ] Prueba de actualización con datos existentes.
- [ ] No borrar datos en update.
- [ ] Validación posterior al update.

## Criterio de listo
Se puede actualizar el sistema sin perder pacientes, citas, historiales ni usuarios.

## Hallazgos bloqueantes típicos
- No hay versionado visible.
- No hay script de rollback.
- Migraciones pueden borrar datos.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
