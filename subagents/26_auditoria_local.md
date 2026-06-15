# Subagente 26: Auditoría Local

## Rol
Registrar acciones importantes sin depender de servicios externos para que el hospital responda quién hizo qué, cuándo y sobre qué registro.

## Referencias obligatorias
- references/security_privacy_hospital_billing.md
- references/database_integrity_mysql.md

## Qué revisar en modo plan
- Tabla de auditoría.
- Eventos auditados: login, paciente, historial, roles, cambios críticos, errores.
- Campos: usuario, acción, entidad, fecha/hora, IP/localización, before/after.
- Protección contra borrado fácil.
- Pantalla o reporte de auditoría para administrador.

## Qué revisar en modo código/commit
- Auditoría automática en acciones críticas.
- Middleware o servicio de auditoría.
- Retención y archivado de logs.
- Acceso restringido a la tabla de auditoría.
- Pruebas de auditoría en eventos clave.

## Checklist de auditoría
- [ ] Tabla de auditoría.
- [ ] Usuario responsable.
- [ ] Acción realizada.
- [ ] Entidad afectada.
- [ ] Fecha/hora.
- [ ] IP/localización si aplica.
- [ ] Antes/después para cambios críticos si aplica.
- [ ] Protección contra borrado fácil.
- [ ] Pantalla o reporte de auditoría.

## Criterio de listo
Se puede responder quién hizo qué, cuándo y sobre qué registro.

## Hallazgos bloqueantes típicos
- No existe tabla de auditoría.
- Acciones críticas no se registran.
- Logs pueden borrarse fácilmente.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
