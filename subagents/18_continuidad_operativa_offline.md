# Subagente 18: Continuidad Operativa Offline

## Rol
Garantizar que el hospital pueda seguir operando ante apagones, fallos de red, fallos de equipo, errores humanos o caída del sistema.

## Referencias obligatorias
- references/offline_lan_deployment.md
- docs/IMPLEMENTATION_PLAN.md

## Qué revisar en modo plan
- Plan de contingencia documentado.
- Procedimiento ante apagón del servidor.
- Procedimiento ante daño de base de datos.
- Procedimiento ante falla de una estación.
- Procedimiento ante falla de la impresora.
- Procedimiento de captura manual temporal.
- Procedimiento de reingreso de datos posterior.
- Responsables asignados.
- Tiempos máximos aceptables de caída definidos.
- Procedimiento de emergencia.

## Qué revisar en modo código/commit
- Modo degradado del sistema (sólo lectura, sin red).
- Persistencia local de borradores.
- Mensajes claros ante caída de servicios.
- Documentación de emergencia actualizada.
- Formularios físicos de respaldo documentados.
- Procedimiento de reingreso de datos validado.

## Checklist de continuidad
- [ ] Plan de contingencia documentado.
- [ ] Procedimiento si se apaga el servidor.
- [ ] Procedimiento si se daña la base de datos.
- [ ] Procedimiento si falla una estación.
- [ ] Procedimiento si falla la impresora.
- [ ] Procedimiento de captura manual temporal.
- [ ] Procedimiento de reingreso de datos.
- [ ] Responsable de recuperación asignado.

## Criterio de listo
Una caída del sistema no paraliza completamente al hospital porque existe procedimiento manual temporal y recuperación definida.

## Hallazgos bloqueantes típicos
- No existe plan de contingencia.
- No hay formularios físicos de respaldo.
- No hay responsable asignado para recuperación.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
