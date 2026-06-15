# Subagente 27: Migración, Exportación e Importación

## Rol
Evitar encierro de datos y permitir rescatar información si el sistema cambia.

## Referencias obligatorias
- references/database_integrity_mysql.md
- scripts/

## Qué revisar en modo plan
- Exportación de pacientes, citas, reportes, backups.
- Formatos: CSV, Excel, PDF, SQL.
- Importación de datos demo o iniciales.
- Exportación protegida por rol.
- Auditoría al exportar.
- Manual de migración.
- Pruebas de importación/restauración.

## Qué revisar en modo código/commit
- Endpoints de exportación por módulo.
- Permisos por rol para exportación.
- Validación de importación (esquema, duplicados).
- Auditoría de cada exportación.
- Backup SQL completo disponible.

## Checklist de migración
- [ ] Exportación de pacientes.
- [ ] Exportación de citas.
- [ ] Exportación de reportes.
- [ ] Backup SQL o equivalente.
- [ ] Exportación protegida por rol.
- [ ] Registro de auditoría al exportar.
- [ ] Manual de migración.
- [ ] Prueba de importación/restauración.

## Criterio de listo
Los datos no quedan atrapados en una instalación imposible de recuperar.

## Hallazgos bloqueantes típicos
- No hay exportación de datos clave.
- No hay backup SQL completo.
- Cualquier usuario puede exportar sin auditoría.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
