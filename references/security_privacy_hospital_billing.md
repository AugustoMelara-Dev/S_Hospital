# Referencia: seguridad y privacidad

## Datos sensibles
Aunque el cliente pidió solo nombre del paciente, sigue siendo dato personal. Limitar acceso por roles y evitar exposición innecesaria.

## Roles recomendados
- admin: configuración, usuarios, reportes, servicios, anulaciones, backups.
- cajero: facturar, cobrar, reimprimir propias facturas del día.
- supervisor: reportes, cierre de caja, autorizar anulaciones.

## Backend
- Laravel Sanctum para auth si frontend separado.
- Spatie Permission para roles/permisos.
- Spatie Activitylog o audit_logs propia para trazabilidad.
- Validación con Form Requests.
- Policies/Gates en acciones sensibles.

## Frontend
- Nunca incluir claves secretas.
- No confiar en ocultar botones como seguridad. Backend valida todo.

## LAN
- App expuesta solo en red local.
- Cambiar contraseñas por defecto.
- Backup protegido.
- Config .env fuera de repositorio.
