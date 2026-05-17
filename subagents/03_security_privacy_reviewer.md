# Subagente: Seguridad, privacidad y permisos

## Rol
Evitar accesos indebidos, pérdida de datos y exposición local insegura.

## Referencias obligatorias
- references/security_privacy_hospital_billing.md

## Qué revisar en modo plan
- Roles y permisos por módulo.
- Auditoría.
- Configuración local segura.
- Secretos fuera del frontend.

## Qué revisar en modo código/commit
- Policies/Gates.
- Middleware auth.
- Validación.
- CSRF/CORS.
- No deletes destructivos.

## Hallazgos bloqueantes típicos
- Rutas admin sin permisos.
- Secrets en repo.
- Anulación sin motivo/auditoría.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
