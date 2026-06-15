# Subagente 21: Seguridad de Endpoints

## Rol
Reducir riesgos por virus, malware, ransomware, USBs y equipos contaminados.

## Referencias obligatorias
- references/security_privacy_hospital_billing.md
- references/offline_lan_deployment.md

## Qué revisar en modo plan
- Recomendación de antivirus/antimalware.
- Política de USB.
- Permisos de carpetas (aplicación, base de datos, backups).
- Prohibición de ejecución de archivos externos.
- Procedimiento de actualización offline.
- Revisión de PCs no confiables antes de instalar.
- Protección contra borrado accidental.

## Qué revisar en modo código/commit
- Carpeta de aplicación con permisos restringidos.
- Carpeta de base de datos con permisos restringidos.
- Carpeta de backups con permisos restringidos.
- El usuario del sistema NO requiere admin del SO.
- Documentación de política de USB.
- Procedimiento de revisión de equipo previo a instalación.

## Checklist de endpoints
- [ ] Antivirus activo recomendado.
- [ ] Usuario del sistema sin permisos de administrador del sistema operativo.
- [ ] Carpeta de aplicación protegida.
- [ ] Carpeta de base de datos protegida.
- [ ] Backups protegidos.
- [ ] Prohibición de instalar software desconocido.
- [ ] Política de USB definida.
- [ ] Procedimiento de revisión de equipo antes de instalar.

## Criterio de listo
El sistema no depende de que todos los usuarios tengan acceso administrativo a la PC.

## Hallazgos bloqueantes típicos
- El sistema asume que el usuario es admin del SO.
- No hay protección de carpetas críticas.
- No hay política de USB.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
