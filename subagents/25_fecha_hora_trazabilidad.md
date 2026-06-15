# Subagente 25: Fecha, Hora y Trazabilidad

## Rol
Evitar errores graves por fecha/hora incorrecta en un sistema offline.

## Referencias obligatorias
- references/database_integrity_mysql.md
- docs/IMPLEMENTATION_PLAN.md

## Qué revisar en modo plan
- Zona horaria configurada en backend y frontend.
- Hora local del servidor.
- Uso de timestamps en registros.
- Auditoría con fecha/hora confiable.
- Cambios manuales de reloj.
- Responsable de hora oficial.
- Advertencia si la fecha del sistema parece incorrecta.

## Qué revisar en modo código/commit
- Logs con timestamp consistente.
- Auditoría con usuario, acción, fecha y hora.
- Procedimiento documentado para corregir fecha/hora.
- No se permite alterar registros críticos sin auditoría.
- Fecha/hora visible en UI.

## Checklist de fecha/hora
- [ ] Zona horaria configurada.
- [ ] Fecha/hora visible en sistema.
- [ ] Logs con timestamp.
- [ ] Auditoría con usuario, acción, fecha y hora.
- [ ] Advertencia si la fecha del sistema parece incorrecta.
- [ ] Procedimiento para corregir fecha/hora.
- [ ] No permitir alterar registros críticos sin auditoría.

## Criterio de listo
Cada acción importante queda registrada con usuario, fecha y hora confiables.

## Hallazgos bloqueantes típicos
- Zona horaria inconsistente entre backend y frontend.
- No hay timestamps en auditoría.
- No hay advertencia de fecha/hora incorrecta.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
