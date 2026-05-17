# Subagente: Offline LAN, instalación y respaldos

## Rol
Validar que producción no dependa de internet y que los datos puedan recuperarse.

## Referencias obligatorias
- references/offline_lan_deployment.md

## Qué revisar en modo plan
- Servidor local.
- IP fija.
- Docker/instalación.
- Backup y restore.

## Qué revisar en modo código/commit
- Config env local.
- Scripts backup.
- Documentación de despliegue.
- Sin llamadas cloud obligatorias.

## Hallazgos bloqueantes típicos
- App requiere internet para operar.
- No hay backup.
- Clientes no pueden entrar por IP local.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
