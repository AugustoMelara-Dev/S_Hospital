# Migracion, Exportacion e Importacion de Datos - S_Hospital (subagente 27)

## Proposito

Evitar el encierro de datos y permitir rescatar informacion si el sistema cambia, se migra de version o se mueve de servidor.

## Formatos soportados

| Tipo | Formato | Uso |
|------|---------|-----|
| Backup completo de base | `.sql.enc` (cifrado con `APP_KEY`) | Restore total, archivo del hospital |
| Exportacion de pacientes | CSV | Reportes administrativos, auditoria |
| Exportacion de facturas | CSV | Reportes contables, declaraciones |
| Exportacion de pagos | CSV | Cuadres de caja, conciliaciones |
| Exportacion de catalogos | CSV | Importar a otro sistema |
| Reportes PDF/HTML | PDF | Comprobantes para imprimir o archivar |
| Exportacion de auditoria | CSV | Revisiones de control interno |

## Endpoints existentes

- `GET /api/reports/export` (reporte en CSV/XLSX segun filtros) requiere permiso `reports.view`.
- `GET /api/reports/{id}/pdf` requiere permiso `reports.view`.
- `GET /api/audits/export` (si existe) requiere permiso `audit.view`.

## Exportar datos

### Pacientes y facturas

- Desde la UI: Historial de Facturas > Filtros > Boton `Exportar`.
- Seleccionar rango de fechas y formato (CSV o Excel).
- El archivo se descarga al equipo del usuario; el sistema NO retiene el archivo.
- Toda exportacion queda registrada en `audit_logs` con accion `report.exported`, usuario, IP, fecha/hora y parametros del filtro.

### Auditoria

- Desde Reportes > Auditoria > Seleccionar rango > Boton `Exportar`.
- Permiso requerido: `audit.view` o `audit.export`.
- La exportacion incluye usuario, accion, entidad, fecha/hora, IP. NO incluye contrasenas, tokens ni datos de sesion.

### Backups SQL

- Los backups completos se generan desde la UI de Respaldos o con `php artisan hospital:backup --type=manual`.
- Resultado: archivo `.sql.enc` bajo `backend/storage/app/private/backups/`.
- Cifrado con `APP_KEY` (Laravel Crypt). Solo el sistema puede descifrar.
- SHA256 del archivo cifrado queda en `backup_logs.checksum_sha256`.

## Importar datos

### Demo o iniciales

- `php artisan db:seed --class=DemoSeeder` solo en entorno `local` o `testing`.
- En produccion, los seeders de demo estan deshabilitados; los datos demo no entran a la base real.

### Restore desde backup

- Usar `scripts/restore_hospital_windows.ps1` con `-TargetDatabase hospital_restore_validation` (base descartable).
- Validar SHA256 con `-ExpectedSha256`.
- Si la validacion pasa, restaurar sobre la base activa SOLO con autorizacion escrita del responsable tecnico.

## Permisos de exportacion

| Rol | Exportar reportes | Exportar auditoria | Crear backup | Descargar backup |
|-----|-------------------|--------------------|--------------|------------------|
| `cajero` | No | No | No | No |
| `supervisor` | Si (reportes) | No | Si | Si |
| `admin` | Si (todos) | Si | Si | Si |
| `auditor` | Si (auditoria) | Si | No | No |
| `soporte_tecnico` | No | No | No | No (solo diagnostico) |

## Auditoria de exportaciones

- Toda exportacion genera un evento en `audit_logs`:
  - `action`: `report.exported`, `audit.exported`, `backup.downloaded`, `backup.created`.
  - `user_id`: quien exporto.
  - `entity_type` y `entity_id`: tipo y rango.
  - `ip_address` y `user_agent`: origen.
  - `new_values`: parametros del filtro o ID del backup.
- Las exportaciones masivas (>1000 filas) requieren doble confirmacion en la UI.

## Manual de migracion entre versiones

1. Revisar `CHANGELOG.md` para cambios de esquema.
2. Crear backup fresco de la base actual.
3. Detener servicios.
4. Aplicar migraciones Laravel (`php artisan migrate --force`).
5. Si hay cambios incompatibles, ejecutar scripts de transformacion documentados.
6. Validar `/up`, login, y consultas a tablas afectadas.
7. Documentar fecha, version anterior, version nueva, responsable.

## Migracion a otra maquina

1. Crear backup fresco de la base actual.
2. Copiar `.env` real y el paquete `offline-release/` actualizado a USB.
3. Instalar la misma version en la maquina destino con `setup.bat`.
4. Restaurar `.env` y backup `.sql.enc` con `restore_hospital_windows.ps1`.
5. Validar checksum, conteos minimos, login admin.
6. Documentar en `qa/MIGRATION-YYYY-MM-DD.md`: maquina origen, maquina destino, fecha, responsable, SHA256, resultado.

## Criterio de listo

- Los datos pueden exportarse en formatos abiertos (CSV, SQL) desde la UI o CLI.
- Los backups completos son `.sql.enc` con SHA256 verificable.
- Las exportaciones quedan auditadas y limitadas por rol.
- La migracion entre maquinas o entre versiones es posible y esta documentada.
