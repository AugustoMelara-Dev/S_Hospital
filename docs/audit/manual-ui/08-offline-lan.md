# Operación Offline y Despliegue LAN - 08 Offline LAN

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Verificación de Autonomía Local y LAN

1. **Cero Dependencias CDN / SaaS**: Todos los activos (fuentes Geist empaquetadas en `@fontsource-variable/geist`, iconos Lucide localmente compilados, bundle React JS/CSS) se sirven directamente desde el servidor local.
2. **Acceso LAN por IP**: Configuración en Nginx/Docker para responder a solicitudes por IP local (ej. `http://192.168.1.10:8282` o `http://127.0.0.1:8282`).
3. **Persistencia de Base de Datos y Respaldos**: MariaDB local persistida en volúmenes Docker con tareas programadas para respaldos diarios automáticos y respaldo manual desde el panel de administración.
